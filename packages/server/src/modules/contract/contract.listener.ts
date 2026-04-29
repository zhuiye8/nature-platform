import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { eq } from 'drizzle-orm';
import { DRIZZLE, DrizzleDB } from '../../database/database.module';
import { contract } from '../../database/schema/business';

interface WorkflowNodeCompletedEvent {
  bizType: string;
  bizId: number;
  instanceId: number;
  nodeKey: string;
  event: string;
  operatorId: number;
}

@Injectable()
export class ContractListener {
  private readonly logger = new Logger(ContractListener.name);

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  @OnEvent('workflow.node.completed')
  async handleNodeCompleted(payload: WorkflowNodeCompletedEvent) {
    if (payload.bizType !== 'CONTRACT') return;
    if (payload.nodeKey !== 'CONTRACT_REVIEW') return;

    const newStatus =
      payload.event === 'APPROVE' ? 'APPROVED' :
      payload.event === 'REJECT' ? 'REJECTED' : null;
    if (!newStatus) return;

    // try/catch 包裹: UPDATE 失败时记录详细日志，避免被 EventEmitter 吞掉。
    // wf_instance 已 commit 但业务表 status 未推进时，运维可通过日志中的
    // contractId + nodeKey + event 快速定位并补偿（手工 UPDATE）。
    try {
      this.logger.log(
        `Contract #${payload.bizId} ${payload.event} — updating reviewStatus → ${newStatus}`,
      );
      const result = await this.db
        .update(contract)
        .set({ reviewStatus: newStatus, updatedAt: new Date() })
        .where(eq(contract.id, payload.bizId));
      if (!result) {
        this.logger.warn(
          `Contract #${payload.bizId} UPDATE returned no result — row may not exist`,
        );
      }
    } catch (err) {
      // 致命错误：业务表未推进但 wf_instance 已推进，需人工补偿
      this.logger.error(
        `[FATAL] Contract #${payload.bizId} status update failed (instance ${payload.instanceId}, ` +
          `event ${payload.event}, target ${newStatus}). 需人工补偿: ` +
          `UPDATE contract SET review_status='${newStatus}' WHERE id=${payload.bizId};`,
        err as Error,
      );
      // 不再 throw — EventEmitter 会吞，没有意义；保留日志让运维感知
    }
  }
}
