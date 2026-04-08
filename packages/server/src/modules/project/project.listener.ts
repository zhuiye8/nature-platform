import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { eq } from 'drizzle-orm';
import { DRIZZLE, DrizzleDB } from '../../database/database.module';
import { projectRegister, projectMember } from '../../database/schema/business';

interface WorkflowNodeCompletedEvent {
  bizType: string;
  bizId: number;
  instanceId: number;
  nodeKey: string;
  event: string;
  operatorId: number;
  extraData?: Record<string, any>;
}

@Injectable()
export class ProjectListener {
  private readonly logger = new Logger(ProjectListener.name);

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  @OnEvent('workflow.node.completed')
  async handleNodeCompleted(payload: WorkflowNodeCompletedEvent) {
    if (payload.bizType !== 'PROJECT_REGISTER') return;

    if (payload.nodeKey === 'PROJECT_REVIEW') {
      if (payload.event === 'APPROVE') {
        this.logger.log(
          `Project #${payload.bizId} review approved — updating status`,
        );
        await this.db
          .update(projectRegister)
          .set({ status: 'APPROVED', updatedAt: new Date() })
          .where(eq(projectRegister.id, payload.bizId));

        // Insert PM from extraData
        const pmUserId: number | undefined = payload.extraData?.pmUserId;
        if (pmUserId) {
          this.logger.log(`Assigning PM #${pmUserId} to project #${payload.bizId}`);
          await this.db.insert(projectMember).values({
            projectId: payload.bizId,
            userId: pmUserId,
            roleType: 'PM',
            assignedBy: payload.operatorId,
            assignedAt: new Date(),
          });
        }

        // Insert assessors from extraData
        const assessorUserIds: number[] =
          payload.extraData?.assessorUserIds ?? [];
        if (assessorUserIds.length > 0) {
          this.logger.log(
            `Assigning ${assessorUserIds.length} assessor(s) to project #${payload.bizId}`,
          );
          for (const userId of assessorUserIds) {
            await this.db.insert(projectMember).values({
              projectId: payload.bizId,
              userId,
              roleType: 'ASSESSOR',
              assignedBy: payload.operatorId,
              assignedAt: new Date(),
            });
          }
        }
      } else if (payload.event === 'REJECT') {
        this.logger.log(
          `Project #${payload.bizId} review rejected — updating status`,
        );
        await this.db
          .update(projectRegister)
          .set({ status: 'REJECTED', updatedAt: new Date() })
          .where(eq(projectRegister.id, payload.bizId));
      }
    }
  }
}
