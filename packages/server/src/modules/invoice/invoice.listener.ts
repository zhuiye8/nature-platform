import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { eq } from 'drizzle-orm';
import { DRIZZLE, DrizzleDB } from '../../database/database.module';
import { financeInvoiceApplication } from '../../database/schema/business';
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
 * 开票申请工作流监听:
 *
 *   FIN_INVOICE_REVIEW + APPROVE → 业务表 status=APPROVED ("已开票")
 *                                  + 抄送通知给 dept_manager (知情)
 *   FIN_INVOICE_REVIEW + REJECT  → 业务表 status=REJECTED ("需修改")
 *                                  + 通知申请人去修改
 *
 * 重新提交 (REJECTED→编辑→DRAFT→提交) 时, invoice.service.submit() 会启动新的
 * wf_instance, roundNo+1, 完整审计链。
 */
@Injectable()
export class InvoiceListener {
  private readonly logger = new Logger(InvoiceListener.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly notificationService: NotificationService,
  ) {}

  @OnEvent('workflow.node.completed')
  async handleNodeCompleted(payload: WorkflowNodeCompletedEvent) {
    if (payload.bizType !== 'INVOICE') return;
    if (payload.nodeKey !== 'FIN_INVOICE_REVIEW') return;

    const id = payload.bizId;

    if (payload.event === 'APPROVE') {
      this.logger.log(`Invoice #${id} approved (已开票)`);
      await this.db
        .update(financeInvoiceApplication)
        .set({ status: 'APPROVED', updatedAt: new Date() })
        .where(eq(financeInvoiceApplication.id, id));

      // 抄送给申请人本人 (告知已开票)
      await this.sendNotifyToApplicant(id, '开票申请已通过', '财务已审核通过，请关注后续开票进度');
    } else if (payload.event === 'REJECT') {
      this.logger.log(`Invoice #${id} rejected (需修改)`);
      await this.db
        .update(financeInvoiceApplication)
        .set({ status: 'REJECTED', updatedAt: new Date() })
        .where(eq(financeInvoiceApplication.id, id));

      await this.sendNotifyToApplicant(id, '开票申请需修改', '财务审核未通过，请编辑申请后重新提交');
    }
  }

  private async sendNotifyToApplicant(invoiceId: number, title: string, content: string) {
    const [app] = await this.db
      .select({ createdBy: financeInvoiceApplication.createdBy })
      .from(financeInvoiceApplication)
      .where(eq(financeInvoiceApplication.id, invoiceId))
      .limit(1);
    if (!app) return;
    try {
      await this.notificationService.createNotification(
        app.createdBy,
        title,
        content,
        'INVOICE_REVIEW',
        'INVOICE',
        invoiceId,
      );
    } catch (err) {
      this.logger.error(`Failed to send notification for invoice #${invoiceId}`, err as Error);
    }
  }
}
