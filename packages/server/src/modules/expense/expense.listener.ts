import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { eq } from 'drizzle-orm';
import { DRIZZLE, DrizzleDB } from '../../database/database.module';
import { financeExpenseRequest } from '../../database/schema/business';
import { userRole } from '../../database/schema/iam';
import { userAccount } from '../../database/schema/user';
import { NotificationService } from '../notification/notification.service';

interface WorkflowNodeCompletedEvent {
  bizType: string;
  bizId: number;
  instanceId: number;
  nodeKey: string;
  event: string;
  operatorId: number;
}

/**
 * 费用请款工作流监听:
 *
 *   FIN_EXPENSE_DEPT_REVIEW + APPROVE → status=DEPT_APPROVED (流程进入财务节点，无需额外通知)
 *   FIN_EXPENSE_DEPT_REVIEW + REJECT  → status=REJECTED + 通知申请人
 *   FIN_EXPENSE_FIN_REVIEW + APPROVE  → status=APPROVED + 通知申请人 + 抄送 chairman
 *   FIN_EXPENSE_FIN_REVIEW + REJECT   → status=REJECTED + 通知申请人
 */
@Injectable()
export class ExpenseListener {
  private readonly logger = new Logger(ExpenseListener.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly notificationService: NotificationService,
  ) {}

  @OnEvent('workflow.node.completed')
  async handleNodeCompleted(payload: WorkflowNodeCompletedEvent) {
    if (payload.bizType !== 'EXPENSE') return;

    const id = payload.bizId;

    if (payload.nodeKey === 'FIN_EXPENSE_DEPT_REVIEW') {
      if (payload.event === 'APPROVE') {
        this.logger.log(`Expense #${id} dept approved → DEPT_APPROVED`);
        await this.db
          .update(financeExpenseRequest)
          .set({ status: 'DEPT_APPROVED', updatedAt: new Date() })
          .where(eq(financeExpenseRequest.id, id));
      } else if (payload.event === 'REJECT') {
        this.logger.log(`Expense #${id} dept rejected → REJECTED`);
        await this.db
          .update(financeExpenseRequest)
          .set({ status: 'REJECTED', updatedAt: new Date() })
          .where(eq(financeExpenseRequest.id, id));
        await this.sendNotifyToApplicant(id, '费用请款被驳回（部门审核）', '部门负责人未通过，请编辑后重新提交');
      }
    } else if (payload.nodeKey === 'FIN_EXPENSE_FIN_REVIEW') {
      if (payload.event === 'APPROVE') {
        this.logger.log(`Expense #${id} fin approved → APPROVED`);
        await this.db
          .update(financeExpenseRequest)
          .set({ status: 'APPROVED', updatedAt: new Date() })
          .where(eq(financeExpenseRequest.id, id));
        await this.sendNotifyToApplicant(id, '费用请款已通过', '财务已审核通过，可联系出纳付款');
        await this.sendNotifyToChairman(id, '费用请款已通过（抄送）', '一笔费用请款已通过财务审核');
      } else if (payload.event === 'REJECT') {
        this.logger.log(`Expense #${id} fin rejected → REJECTED`);
        await this.db
          .update(financeExpenseRequest)
          .set({ status: 'REJECTED', updatedAt: new Date() })
          .where(eq(financeExpenseRequest.id, id));
        await this.sendNotifyToApplicant(id, '费用请款被驳回（财务审核）', '财务未通过，请编辑后重新提交');
      }
    }
  }

  private async sendNotifyToApplicant(expenseId: number, title: string, content: string) {
    const [app] = await this.db
      .select({ createdBy: financeExpenseRequest.createdBy })
      .from(financeExpenseRequest)
      .where(eq(financeExpenseRequest.id, expenseId))
      .limit(1);
    if (!app) return;
    try {
      await this.notificationService.createNotification(
        app.createdBy,
        title,
        content,
        'EXPENSE_REVIEW',
        'EXPENSE',
        expenseId,
      );
    } catch (err) {
      this.logger.error(`Failed to send notification for expense #${expenseId}`, err as Error);
    }
  }

  private async sendNotifyToChairman(expenseId: number, title: string, content: string) {
    // 找到所有 chairman 角色用户
    const chairmen = await this.db
      .select({ userId: userRole.userId })
      .from(userRole)
      .innerJoin(userAccount, eq(userAccount.id, userRole.userId))
      .where(eq(userRole.roleCode, 'chairman'));

    for (const c of chairmen) {
      try {
        await this.notificationService.createNotification(
          c.userId,
          title,
          content,
          'EXPENSE_REVIEW_CC',
          'EXPENSE',
          expenseId,
        );
      } catch (err) {
        this.logger.error(`Failed to send chairman cc for expense #${expenseId}`, err as Error);
      }
    }
  }
}
