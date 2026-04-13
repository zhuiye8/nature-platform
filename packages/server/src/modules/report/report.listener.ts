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

        // Set REPORT_COMPILE task assignee to the designated writer.
        // The workflow creates a PENDING pool task asynchronously — use a
        // retry loop instead of a fragile setTimeout(1000) to avoid races.
        this.assignReportCompileTask(
          payload.bizId,
          reportWriterIds[0],
        );
      }
    }
  }

  /**
   * Retry-based assignment of the REPORT_COMPILE task to the designated writer.
   * The task may not exist yet when this listener fires (event ordering),
   * so we poll up to 5 times with 500 ms intervals.
   */
  private async assignReportCompileTask(
    projectRegisterId: number,
    writerId: number,
  ): Promise<void> {
    const { wfInstance } = await import('../../database/schema/workflow');
    const MAX_RETRIES = 5;
    const RETRY_DELAY = 500;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      await new Promise((r) => setTimeout(r, RETRY_DELAY));

      try {
        const instances = await this.db
          .select({ id: wfInstance.id })
          .from(wfInstance)
          .where(
            and(
              eq(wfInstance.bizType, 'PROJECT_REGISTER'),
              eq(wfInstance.bizId, projectRegisterId),
            ),
          )
          .limit(1);

        if (!instances[0]) continue;

        const updated = await this.db
          .update(wfTask)
          .set({ assigneeId: writerId })
          .where(
            and(
              eq(wfTask.instanceId, instances[0].id),
              eq(wfTask.nodeKey, 'REPORT_COMPILE'),
              eq(wfTask.status, 'PENDING'),
            ),
          )
          .returning({ id: wfTask.id });

        if (updated.length > 0) {
          this.logger.log(
            `Set REPORT_COMPILE assignee to user #${writerId} (attempt ${attempt + 1})`,
          );
          return;
        }
      } catch (e) {
        this.logger.warn(
          `assignReportCompileTask attempt ${attempt + 1} failed`,
          e,
        );
      }
    }

    this.logger.warn(
      `Failed to assign REPORT_COMPILE task for project #${projectRegisterId} after ${MAX_RETRIES} retries`,
    );
  }
}
