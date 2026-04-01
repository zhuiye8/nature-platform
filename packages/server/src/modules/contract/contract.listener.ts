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

    if (payload.nodeKey === 'CONTRACT_REVIEW') {
      if (payload.event === 'APPROVE') {
        this.logger.log(
          `Contract #${payload.bizId} review approved — updating status to APPROVED`,
        );
        await this.db
          .update(contract)
          .set({
            reviewStatus: 'APPROVED',
            updatedAt: new Date(),
          })
          .where(eq(contract.id, payload.bizId));
      } else if (payload.event === 'REJECT') {
        this.logger.log(
          `Contract #${payload.bizId} review rejected — updating status to REJECTED`,
        );
        await this.db
          .update(contract)
          .set({
            reviewStatus: 'REJECTED',
            updatedAt: new Date(),
          })
          .where(eq(contract.id, payload.bizId));
      }
    }
  }
}
