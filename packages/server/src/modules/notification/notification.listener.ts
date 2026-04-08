import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { eq, and } from 'drizzle-orm';
import { DRIZZLE, DrizzleDB } from '../../database/database.module';
import { contract, projectMember } from '../../database/schema/business';
import { projectRegister } from '../../database/schema/business';
import { wfInstance, wfAssignmentRule } from '../../database/schema/workflow';
import { userRole } from '../../database/schema/iam';
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

  @OnEvent('workflow.task.created')
  async handleTaskCreated(payload: WorkflowTaskCreatedEvent) {
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
      // Pool mode — notify all users with matching roles from assignment rules
      this.logger.log(
        `Pool task at node "${payload.nodeName}", notifying all eligible users`,
      );
      const rules = await this.db
        .select({ roleCode: wfAssignmentRule.roleCode })
        .from(wfAssignmentRule)
        .where(eq(wfAssignmentRule.nodeKey, payload.nodeKey));

      const roleCodes = [...new Set(rules.map((r) => r.roleCode))];
      if (roleCodes.length === 0) return;

      // Find all users with these roles
      const userIds = new Set<number>();
      for (const roleCode of roleCodes) {
        const users = await this.db
          .select({ userId: userRole.userId })
          .from(userRole)
          .where(eq(userRole.roleCode, roleCode));
        users.forEach((u) => userIds.add(u.userId));
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
