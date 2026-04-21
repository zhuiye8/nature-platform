import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { eq, and } from 'drizzle-orm';
import { DRIZZLE, DrizzleDB } from '../../database/database.module';
import { contract, projectMember } from '../../database/schema/business';
import { projectRegister } from '../../database/schema/business';
import { wfInstance, wfAssignmentRule } from '../../database/schema/workflow';
import { userRole } from '../../database/schema/iam';
import { userAccount } from '../../database/schema/user';
import { NotificationService } from './notification.service';

interface WorkflowTaskCreatedEvent {
  taskId: number;
  assigneeId: number | null;
  instanceId: number;
  nodeKey: string;
  nodeName: string;
  bizType: string;
  bizId: number;
}

interface WorkflowNodeCompletedEvent {
  bizType: string;
  bizId: number;
  instanceId: number;
  nodeKey: string;
  event: string;
  operatorId: number;
  remark?: string;
}

@Injectable()
export class NotificationListener {
  private readonly logger = new Logger(NotificationListener.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly notificationService: NotificationService,
  ) {}

  // Nodes that represent the initiator's own action — no need to notify them
  // about a task they just created themselves.
  private static readonly SILENT_NODES = new Set([
    'CONTRACT_CREATE',
    'PROJECT_REGISTER',
  ]);

  @OnEvent('workflow.task.created')
  async handleTaskCreated(payload: WorkflowTaskCreatedEvent) {
    if (NotificationListener.SILENT_NODES.has(payload.nodeKey)) return;

    if (payload.assigneeId) {
      // Direct assignment — notify the assignee
      this.logger.log(
        `Notifying user #${payload.assigneeId} about new task at node "${payload.nodeName}"`,
      );
      const bizName = await this.getBizDisplayName(payload.bizType, payload.bizId);
      const bizLabel = this.getBizTypeLabel(payload.bizType);
      await this.notificationService.createNotification(
        payload.assigneeId,
        `新待办：${payload.nodeName}`,
        `${bizLabel}「${bizName}」需要你处理：${payload.nodeName}`,
        'TASK_CREATED',
        payload.bizType,
        payload.bizId,
      );
    } else {
      // Pool mode — notify eligible users
      this.logger.log(
        `Pool task at node "${payload.nodeName}", notifying eligible users`,
      );

      const userIds = new Set<number>();

      // MATERIAL_ARCHIVE: 拆两种文案
      //   - 归档员 (archiver): 真的要做事 → "你有新的待办任务"
      //   - 销售/PM/部门经理: 知情抄送 → "项目 XXX 已进入归档阶段"
      // 注意: wf_assignment_rule 里 MATERIAL_ARCHIVE 已清理只剩 archiver+super_admin
      // (见 scripts/cleanup-material-archive-rules.sql)，这里的销售/PM/部门经理
      // 通知是独立于 assignment_rule 的硬编码抄送，让他们能通过铃铛知情，
      // 但不会在待办中心业务提醒里看到"池化归档任务"。
      if (payload.nodeKey === 'MATERIAL_ARCHIVE' && payload.bizType === 'PROJECT_REGISTER') {
        const archiverIds = new Set<number>();
        const informationalIds = new Set<number>();

        // 归档员 (真正领任务的人)
        const archivers = await this.db
          .select({ userId: userRole.userId })
          .from(userRole)
          .where(eq(userRole.roleCode, 'archiver'));
        archivers.forEach((u) => archiverIds.add(u.userId));

        // 部门经理 (知情)
        const deptMgrs = await this.db
          .select({ userId: userRole.userId })
          .from(userRole)
          .where(eq(userRole.roleCode, 'dept_manager'));
        deptMgrs.forEach((u) => informationalIds.add(u.userId));

        // 项目 PM (知情)
        const pms = await this.db
          .select({ userId: projectMember.userId })
          .from(projectMember)
          .where(
            and(
              eq(projectMember.projectId, payload.bizId),
              eq(projectMember.roleType, 'PM'),
              eq(projectMember.status, 'ACTIVE'),
            ),
          );
        pms.forEach((p) => informationalIds.add(p.userId));

        // 合同创建者 + 跟单销售 (知情) + 取项目名用于文案
        const proj = await this.db
          .select({
            contractId: projectRegister.contractId,
            applicationName: projectRegister.applicationName,
          })
          .from(projectRegister)
          .where(eq(projectRegister.id, payload.bizId))
          .limit(1);
        const projectName = proj[0]?.applicationName ?? `项目#${payload.bizId}`;
        if (proj[0]?.contractId) {
          const cont = await this.db
            .select({
              createdBy: contract.createdBy,
              salesPersonId: contract.salesPersonId,
            })
            .from(contract)
            .where(eq(contract.id, proj[0].contractId))
            .limit(1);
          if (cont[0]) {
            informationalIds.add(cont[0].createdBy);
            if (cont[0].salesPersonId) informationalIds.add(cont[0].salesPersonId);
          }
        }

        // 发"待办任务"文案给归档员
        for (const userId of archiverIds) {
          await this.notificationService.createNotification(
            userId,
            `你有新的待办任务：${payload.nodeName}`,
            `你有新的待办任务：${payload.nodeName}`,
            'TASK_CREATED',
            payload.bizType,
            payload.bizId,
          );
        }

        // 发"知情抄送"文案给销售/PM/部门经理 (跳过已收到待办的人，避免重复)
        for (const userId of informationalIds) {
          if (archiverIds.has(userId)) continue;
          await this.notificationService.createNotification(
            userId,
            `项目「${projectName}」已进入材料归档阶段`,
            `项目「${projectName}」已进入材料归档阶段，如需协助上传原始材料请前往材料归档详情页`,
            'ARCHIVE_STARTED',
            payload.bizType,
            payload.bizId,
          );
        }

        this.logger.log(
          `MATERIAL_ARCHIVE 通知: ${archiverIds.size} 归档员(待办) + ${informationalIds.size} 知情(抄送)`,
        );
        return;
      } else if (
        (payload.nodeKey === 'DEPT_REVIEW' &&
          payload.bizType === 'PROJECT_REGISTER') ||
        (payload.nodeKey === 'DIRECTOR_REVIEW' &&
          payload.bizType === 'PROJECT_REGISTER') ||
        (payload.nodeKey === 'CONTRACT_REVIEW' &&
          payload.bizType === 'CONTRACT')
      ) {
        // Pool review: notify only the target role
        // - DEPT_REVIEW:     dept_manager
        // - DIRECTOR_REVIEW: project_director
        // - CONTRACT_REVIEW: dept_manager (variables.reviewerRoleCode)
        const inst = await this.db
          .select({ variables: wfInstance.variables })
          .from(wfInstance)
          .where(eq(wfInstance.id, payload.instanceId))
          .limit(1);

        const vars =
          (inst[0]?.variables as Record<string, any> | null) ?? {};
        const nodeDefaultRole: Record<string, string> = {
          DEPT_REVIEW: 'dept_manager',
          DIRECTOR_REVIEW: 'project_director',
        };
        const targetRole: string =
          nodeDefaultRole[payload.nodeKey] ||
          vars.reviewerRoleCode ||
          'dept_manager';

        const poolUsers = await this.db
          .select({ userId: userRole.userId })
          .from(userRole)
          .innerJoin(userAccount, eq(userRole.userId, userAccount.id))
          .where(
            and(
              eq(userRole.roleCode, targetRole),
              eq(userAccount.enabled, true),
            ),
          );
        poolUsers.forEach((u) => userIds.add(u.userId));
      } else {
        // Default: notify all users with matching roles from assignment rules
        const rules = await this.db
          .select({ roleCode: wfAssignmentRule.roleCode })
          .from(wfAssignmentRule)
          .where(eq(wfAssignmentRule.nodeKey, payload.nodeKey));

        const roleCodes = [...new Set(rules.map((r) => r.roleCode))];
        if (roleCodes.length === 0) return;

        for (const roleCode of roleCodes) {
          const users = await this.db
            .select({ userId: userRole.userId })
            .from(userRole)
            .where(eq(userRole.roleCode, roleCode));
          users.forEach((u) => userIds.add(u.userId));
        }
      }

      // Notify each user
      const bizName = await this.getBizDisplayName(payload.bizType, payload.bizId);
      const bizLabel = this.getBizTypeLabel(payload.bizType);
      for (const userId of userIds) {
        await this.notificationService.createNotification(
          userId,
          `新待办：${payload.nodeName}`,
          `${bizLabel}「${bizName}」需要你处理：${payload.nodeName}`,
          'TASK_CREATED',
          payload.bizType,
          payload.bizId,
        );
      }
      this.logger.log(`Notified ${userIds.size} users for pool task`);
    }
  }

  @OnEvent('workflow.task.review')
  async handleTaskReview(payload: {
    instanceId: number;
    taskId: number;
    nodeKey: string;
    bizType: string;
    bizId: number;
    operatorId: number;
    remark: string | null;
  }) {
    if (payload.bizType !== 'PROJECT_REGISTER') return;

    // FINAL_REVIEW REVIEW → notify report writer (report needs revision)
    if (payload.nodeKey === 'FINAL_REVIEW') {
      const writers = await this.db
        .select({ userId: projectMember.userId })
        .from(projectMember)
        .where(
          and(
            eq(projectMember.projectId, payload.bizId),
            eq(projectMember.roleType, 'REPORT_WRITER'),
            eq(projectMember.status, 'ACTIVE'),
          ),
        );

      const projectName = await this.getBizDisplayName('PROJECT_REGISTER', payload.bizId);
      for (const w of writers) {
        this.logger.log(
          `Notifying report writer #${w.userId} about FINAL_REVIEW review`,
        );
        await this.notificationService.createNotification(
          w.userId,
          '编制报告需要修改',
          `项目「${projectName}」的编制报告需要修改，最终审核提出了意见，请前往报告详情页修改后重新提交`,
          'TASK_REVIEW',
          payload.bizType,
          payload.bizId,
        );
      }
      return;
    }

    // Other nodes: notify PM for rectification
    const pmId = await this.getProjectPm(payload.bizId);
    if (!pmId) return;

    const projectName = await this.getBizDisplayName('PROJECT_REGISTER', payload.bizId);
    const nodeLabel = this.getNodeLabel(payload.nodeKey);
    this.logger.log(
      `Notifying PM #${pmId} about review at ${payload.nodeKey}`,
    );
    await this.notificationService.createNotification(
      pmId,
      `质量审核需要整改：${nodeLabel}`,
      `项目「${projectName}」的${nodeLabel}需要整改，请前往现场测评详情页修改测评成果后重新提交`,
      'TASK_REVIEW',
      payload.bizType,
      payload.bizId,
    );
  }

  @OnEvent('workflow.task.resubmitted')
  async handleTaskResubmitted(payload: {
    instanceId: number;
    nodeKey: string;
    bizType: string;
    bizId: number;
    operatorId: number;
    taskIds: number[];
    assigneeIds: number[];
  }) {
    // Notify all original reviewers that the PM has resubmitted
    const bizLabel = this.getBizTypeLabel(payload.bizType);
    const bizName = await this.getBizDisplayName(payload.bizType, payload.bizId);
    for (const assigneeId of payload.assigneeIds) {
      this.logger.log(
        `Notifying reviewer #${assigneeId} about resubmission at ${payload.nodeKey}`,
      );
      await this.notificationService.createNotification(
        assigneeId,
        '整改已重新提交',
        `${bizLabel}「${bizName}」的测评成果已重新提交，请重新审核`,
        'TASK_RESUBMITTED',
        payload.bizType,
        payload.bizId,
      );
    }
  }

  @OnEvent('workflow.node.completed')
  async handleNodeCompleted(payload: WorkflowNodeCompletedEvent) {
    // Determine the business creator to notify
    const creatorId = await this.getBusinessCreator(
      payload.bizType,
      payload.bizId,
    );
    if (!creatorId) return;

    // For CONTRACT, also notify salesPerson (treated same as creator)
    const notifyIds = [creatorId];
    if (payload.bizType === 'CONTRACT') {
      const salesId = await this.getContractSalesPerson(payload.bizId);
      if (salesId && salesId !== creatorId) {
        notifyIds.push(salesId);
      }
    }

    // Contract archived — notify creator + salesPerson
    if (payload.bizType === 'CONTRACT' && payload.nodeKey === 'CONTRACT_ARCHIVE' && payload.event === 'SUBMIT') {
      this.logger.log(`Contract #${payload.bizId} archived, notifying ${notifyIds.join(',')}`);
      const bizName = await this.getBizDisplayName(payload.bizType, payload.bizId);
      for (const uid of notifyIds) {
        await this.notificationService.createNotification(
          uid,
          '合同已归档',
          `合同「${bizName}」已完成归档，可以创建项目登记`,
          'CONTRACT_ARCHIVED',
          payload.bizType,
          payload.bizId,
        );
      }
      return;
    }

    if (payload.event === 'APPROVE') {
      const bizName = await this.getBizDisplayName(payload.bizType, payload.bizId);
      const bizLabel = this.getBizTypeLabel(payload.bizType);
      for (const uid of notifyIds) {
        this.logger.log(`Notifying #${uid} that ${payload.bizType} #${payload.bizId} was approved`);
        await this.notificationService.createNotification(
          uid,
          '审核已通过',
          `您提交的${bizLabel}「${bizName}」审核已通过`,
          'WORKFLOW_APPROVED',
          payload.bizType,
          payload.bizId,
        );
      }

      // CC notification: DEPT_REVIEW approved → notify all project_directors
      // ("有新项目待分配")，因为 DIRECTOR_REVIEW 节点的 task.created 事件已经会通知
      // project_directors，这里其实可省略。但保留一条"已分配到项目主管"的明确抄送，
      // 方便部门经理追踪项目流转。
      if (
        payload.bizType === 'PROJECT_REGISTER' &&
        payload.nodeKey === 'DEPT_REVIEW'
      ) {
        // task.created for DIRECTOR_REVIEW will already notify all project_directors,
        // so no additional CC is needed here. Keep this branch for future expansion.
      }
    } else if (payload.event === 'REJECT') {
      const reason = payload.remark ?? '';
      const bizName = await this.getBizDisplayName(payload.bizType, payload.bizId);
      const bizLabel = this.getBizTypeLabel(payload.bizType);
      for (const uid of notifyIds) {
        this.logger.log(`Notifying #${uid} that ${payload.bizType} #${payload.bizId} was rejected`);
        await this.notificationService.createNotification(
          uid,
          '审核被驳回',
          `您提交的${bizLabel}「${bizName}」被驳回${reason ? '：' + reason : ''}`,
          'WORKFLOW_REJECTED',
          payload.bizType,
          payload.bizId,
        );
      }
    }
  }

  private async getProjectPm(projectRegisterId: number): Promise<number | null> {
    const rows = await this.db
      .select({ userId: projectMember.userId })
      .from(projectMember)
      .where(
        and(
          eq(projectMember.projectId, projectRegisterId),
          eq(projectMember.roleType, 'PM'),
          eq(projectMember.status, 'ACTIVE'),
        ),
      )
      .limit(1);
    return rows[0]?.userId ?? null;
  }

  /**
   * 获取业务对象的可读名称，用于通知文案
   * CONTRACT: 优先 contractName，fallback contractNo，最终 合同#id
   * PROJECT_REGISTER: applicationName，fallback 项目#id
   * 其他: bizType#id
   */
  private async getBizDisplayName(
    bizType: string,
    bizId: number,
  ): Promise<string> {
    try {
      if (bizType === 'CONTRACT') {
        const rows = await this.db
          .select({
            contractName: contract.contractName,
            contractNo: contract.contractNo,
          })
          .from(contract)
          .where(eq(contract.id, bizId))
          .limit(1);
        return (
          rows[0]?.contractName ??
          rows[0]?.contractNo ??
          `合同#${bizId}`
        );
      }
      if (bizType === 'PROJECT_REGISTER') {
        const rows = await this.db
          .select({ applicationName: projectRegister.applicationName })
          .from(projectRegister)
          .where(eq(projectRegister.id, bizId))
          .limit(1);
        return rows[0]?.applicationName ?? `项目#${bizId}`;
      }
    } catch {
      // ignore
    }
    return `${bizType}#${bizId}`;
  }

  private async getContractSalesPerson(bizId: number): Promise<number | null> {
    const rows = await this.db
      .select({ salesPersonId: contract.salesPersonId })
      .from(contract)
      .where(eq(contract.id, bizId))
      .limit(1);
    return rows[0]?.salesPersonId ?? null;
  }

  private async getBusinessCreator(
    bizType: string,
    bizId: number,
  ): Promise<number | null> {
    if (bizType === 'CONTRACT') {
      const rows = await this.db
        .select({ createdBy: contract.createdBy })
        .from(contract)
        .where(eq(contract.id, bizId))
        .limit(1);
      return rows[0]?.createdBy ?? null;
    }

    if (bizType === 'PROJECT_REGISTER') {
      const rows = await this.db
        .select({ createdBy: projectRegister.createdBy })
        .from(projectRegister)
        .where(eq(projectRegister.id, bizId))
        .limit(1);
      return rows[0]?.createdBy ?? null;
    }

    return null;
  }

  private getNodeLabel(nodeKey: string): string {
    const map: Record<string, string> = {
      TECH_REVIEW: '技术审核',
      CONTENT_REVIEW: '内容审核',
      REPORT_ASSIGN: '报告编制分配',
      REPORT_COMPILE: '报告编制',
      FINAL_REVIEW: '最终审核',
    };
    return map[nodeKey] || nodeKey;
  }

  private getBizTypeLabel(bizType: string): string {
    switch (bizType) {
      case 'CONTRACT':
        return '合同';
      case 'PROJECT_REGISTER':
        return '项目立项';
      default:
        return bizType;
    }
  }
}
