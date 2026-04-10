import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { eq, and } from 'drizzle-orm';
import { DRIZZLE, DrizzleDB } from '../../database/database.module';
import { projectRegister, projectMember } from '../../database/schema/business';
import { wfTask } from '../../database/schema/workflow';

@Injectable()
export class ReportListener {
  private readonly logger = new Logger(ReportListener.name);

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  @OnEvent('workflow.node.completed')
  async handleNodeCompleted(payload: {
    bizType: string;
    bizId: number;
    instanceId: number;
    nodeKey: string;
    event: string;
    operatorId: number;
    extraData?: Record<string, any>;
  }) {
    if (payload.bizType !== 'PROJECT_REGISTER') return;

    // REPORT_ASSIGN approved → assign report writers
    if (payload.nodeKey === 'REPORT_ASSIGN' && payload.event === 'APPROVE') {
      const reportWriterIds: number[] =
        payload.extraData?.reportWriterIds ?? [];

      if (reportWriterIds.length > 0) {
        this.logger.log(
          `Assigning ${reportWriterIds.length} report writer(s) to project #${payload.bizId}`,
        );

        // Set compiledBy to the first writer (for visibility filtering)
        await this.db
          .update(projectRegister)
          .set({
            compiledBy: reportWriterIds[0],
            updatedAt: new Date(),
          })
          .where(eq(projectRegister.id, payload.bizId));

        // Insert as project members with REPORT_WRITER role
        for (const userId of reportWriterIds) {
          // Check if already a member with this role
          const existing = await this.db
            .select()
            .from(projectMember)
            .where(
              and(
                eq(projectMember.projectId, payload.bizId),
                eq(projectMember.userId, userId),
                eq(projectMember.roleType, 'REPORT_WRITER'),
              ),
            )
            .limit(1);

          if (existing.length === 0) {
            await this.db.insert(projectMember).values({
              projectId: payload.bizId,
              userId,
              roleType: 'REPORT_WRITER',
              assignedBy: payload.operatorId,
              assignedAt: new Date(),
            });
          }
        }

        // Set REPORT_COMPILE task assignee to the designated writer
        // (workflow creates a PENDING pool task, we convert it to direct assignment)
        setTimeout(async () => {
          try {
            const { wfInstance } = await import('../../database/schema/workflow');
            const instances = await this.db
              .select({ id: wfInstance.id })
              .from(wfInstance)
              .where(and(eq(wfInstance.bizType, 'PROJECT_REGISTER'), eq(wfInstance.bizId, payload.bizId)))
              .limit(1);
            if (instances[0]) {
              await this.db
                .update(wfTask)
                .set({ assigneeId: reportWriterIds[0] })
                .where(and(
                  eq(wfTask.instanceId, instances[0].id),
                  eq(wfTask.nodeKey, 'REPORT_COMPILE'),
                  eq(wfTask.status, 'PENDING'),
                ));
              this.logger.log(`Set REPORT_COMPILE assignee to user #${reportWriterIds[0]}`);
            }
          } catch (e) {
            this.logger.warn('Failed to set REPORT_COMPILE assignee', e);
          }
        }, 1000);
      }
    }
  }
}
