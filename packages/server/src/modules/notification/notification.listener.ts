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
      await this.notificationService.createNotification(
        payload.assigneeId,
        `你有新的待办任务：${payload.nodeName}`,
        `你有新的待办任务：${payload.nodeName}`,
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

      // MATERIAL_ARCHIVE: limit to relevant people only
      if (payload.nodeKey === 'MATERIAL_ARCHIVE' && payload.bizType === 'PROJECT_REGISTER') {
        // All archivers + all dept_managers
        for (const roleCode of ['archiver', 'dept_manager']) {
          const users = await this.db
            .select({ userId: userRole.userId })
            .from(userRole)
            .where(eq(userRole.roleCode, roleCode));
          users.forEach((u) => userIds.add(u.userId));
        }
        // Project PM
        const pms = await this.db
          .select({ userId: projectMember.userId })
          .from(projectMember)
          .where(and(eq(projectMember.projectId, payload.bizId), eq(projectMember.roleType, 'PM'), eq(projectMember.status, 'ACTIVE')));
        pms.forEach((p) => userIds.add(p.userId));
        // Contract creator + salesPerson
        const proj = await this.db
          .select({ contractId: projectRegister.contractId })
          .from(projectRegister)
          .where(eq(projectRegister.id, payload.bizId))
          .limit(1);
        if (proj[0]?.contractId) {
          const cont = await this.db
            .select({ createdBy: contract.createdBy, salesPersonId: contract.salesPersonId })
            .from(contract)
            .where(eq(contract.id, proj[0].contractId))
            .limit(1);
          if (cont[0]) {
            userIds.add(cont[0].createdBy);
            if (cont[0].salesPersonId) userIds.add(cont[0].salesPersonId);
          }
        }
      } else if (
        (payload.nodeKey === 'PROJECT_REVIEW' &&
          payload.bizType === 'PROJECT_REGISTER') ||
        (payload.nodeKey === 'CONTRACT_REVIEW' &&
          payload.bizType === 'CONTRACT')
      ) {
        // Pool review: notify only the target role from wf_instance.variables.
        // - PROJECT_REVIEW: project_director (contract fully archived) OR dept_manager
        // - CONTRACT_REVIEW: dept_manager (fixed), or super_admin if fallback kicked in
        // This bypasses the default assignment-rule driven notification which would
        // otherwise spam every role pool listed in wf_assignment_rule.
        const inst = await this.db
          .select({ variables: wfInstance.variables })
          .from(wfInstance)
          .where(eq(wfInstance.id, payload.instanceId))
          .limit(1);

        const vars =
          (inst[0]?.variables as Record<string, any> | null) ?? {};
        const targetRole: string = vars.reviewerRoleCode || 'dept_manager';

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
      for (const userId of userIds) {
        await this.notificationService.createNotification(
          userId,
          `你有新的待办任务：${payload.nodeName}`,
          `你有新的待办任务：${payload.nodeName}`,
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

      for (const w of writers) {
        this.logger.log(
          `Notifying report writer #${w.userId} about FINAL_REVIEW review`,
        );
        await this.notificationService.createNotification(
          w.userId,
          '编制报告需要修改',
          '最终审核对编制报告提出了修改意见，请修改后重新提交',
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

    this.logger.log(
      `Notifying PM #${pmId} about review at ${payload.nodeKey}`,
    );
    await this.notificationService.createNotification(
      pmId,
      `质量审核需要整改：${this.getNodeLabel(payload.nodeKey)}`,
      `有一条${this.getNodeLabel(payload.nodeKey)}需要整改，请前往现场测评详情页修改测评成果后重新提交`,
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
    for (const assigneeId of payload.assigneeIds) {
      this.logger.log(
        `Notifying reviewer #${assigneeId} about resubmission at ${payload.nodeKey}`,
      );
      await this.notificationService.createNotification(
        assigneeId,
        '整改已重新提交',
        `${bizLabel}的测评成果已重新提交，请重新审核`,
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

    // Get node display name from instance
    const nodeName = payload.nodeKey;

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
      for (const uid of notifyIds) {
        await this.notificationService.createNotification(
          uid,
          '合同已归档',
          '您的合同已完成归档，可以创建项目登记',
          'CONTRACT_ARCHIVED',
          payload.bizType,
          payload.bizId,
        );
      }
      return;
    }

    if (payload.event === 'APPROVE') {
      for (const uid of notifyIds) {
        this.logger.log(`Notifying #${uid} that ${payload.bizType} #${payload.bizId} was approved`);
        await this.notificationService.createNotification(
          uid,
          '审核已通过',
          `您提交的${this.getBizTypeLabel(payload.bizType)}审核已通过`,
          'WORKFLOW_APPROVED',
          payload.bizType,
          payload.bizId,
        );
      }

      // CC notification: when project registration was approved via the
      // project_director pool (i.e. contract was fully archived), send a
      // carbon-copy to all enabled dept_managers so they stay informed.
      if (
        payload.bizType === 'PROJECT_REGISTER' &&
        payload.nodeKey === 'PROJECT_REVIEW'
      ) {
        await this.sendProjectReviewCcIfNeeded(
          payload.instanceId,
          payload.bizId,
        );
      }
    } else if (payload.event === 'REJECT') {
      const reason = payload.remark ?? '';
      for (const uid of notifyIds) {
        this.logger.log(`Notifying #${uid} that ${payload.bizType} #${payload.bizId} was rejected`);
        await this.notificationService.createNotification(
          uid,
          `被驳回：${reason}`,
          `您提交的${this.getBizTypeLabel(payload.bizType)}被驳回：${reason}`,
          'WORKFLOW_REJECTED',
          payload.bizType,
          payload.bizId,
        );
      }
    }
  }

  /**
   * Send a carbon-copy notification to all enabled dept_managers when a project
   * registration has just been approved via the project_director pool.
   *
   * When the contract is NOT fully archived, the approval is already handled
   * by dept_manager pool (so CC would notify themselves). We only CC when the
   * approval came from the project_director pool, detected via
   * wf_instance.variables.reviewerRoleCode.
   */
  private async sendProjectReviewCcIfNeeded(
    instanceId: number,
    projectRegisterId: number,
  ): Promise<void> {
    const instRows = await this.db
      .select({ variables: wfInstance.variables })
      .from(wfInstance)
      .where(eq(wfInstance.id, instanceId))
      .limit(1);

    const vars =
      (instRows[0]?.variables as Record<string, any> | null) ?? {};
    if (vars.reviewerRoleCode !== 'project_director') {
      return; // dept_manager approved — no need to CC themselves
    }

    const deptManagers = await this.db
      .select({ userId: userRole.userId })
      .from(userRole)
      .innerJoin(userAccount, eq(userRole.userId, userAccount.id))
      .where(
        and(
          eq(userRole.roleCode, 'dept_manager'),
          eq(userAccount.enabled, true),
        ),
      );

    if (deptManagers.length === 0) return;

    const projRows = await this.db
      .select({ applicationName: projectRegister.applicationName })
      .from(projectRegister)
      .where(eq(projectRegister.id, projectRegisterId))
      .limit(1);
    const appName =
      projRows[0]?.applicationName ?? `#${projectRegisterId}`;

    this.logger.log(
      `CC-notifying ${deptManagers.length} dept_managers about project #${projectRegisterId} approval`,
    );
    for (const dm of deptManagers) {
      await this.notificationService.createNotification(
        dm.userId,
        '一条项目登记审批通过（抄送）',
        `项目登记「${appName}」已由项目主管审批通过`,
        'CC_NOTIFICATION',
        'PROJECT_REGISTER',
        projectRegisterId,
      );
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
        .select({ createdBy: contract.createdBy, salesPersonId: contract.salesPersonId })
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
