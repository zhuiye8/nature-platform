import { Inject, Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { eq, and } from 'drizzle-orm';
import { DRIZZLE, DrizzleDB } from '../../database/database.module';
import { policeRegister } from '../../database/schema/business';
import { fileAttachment } from '../../database/schema/common';
import { wfTask, wfInstance } from '../../database/schema/workflow';
import { WorkflowService } from '../workflow/workflow.service';

interface WorkflowNodeCompletedEvent {
  bizType: string;
  bizId: number;
  instanceId: number;
  nodeKey: string;
  event: string;
  operatorId: number;
}

interface FileUploadedEvent {
  bizType: string;
  bizId: number;
  uploaderId: number;
  fileId: number;
}

@Injectable()
export class PoliceListener {
  private readonly logger = new Logger(PoliceListener.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly workflowService: WorkflowService,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────
  // Auto-create police_register when PROJECT_REVIEW is approved.
  // This replaces the manual "新建登记" button + PoliceForm popup.
  // ─────────────────────────────────────────────────────────────────────────
  @OnEvent('workflow.node.completed')
  async handleNodeCompleted(payload: WorkflowNodeCompletedEvent) {
    if (
      payload.bizType !== 'PROJECT_REGISTER' ||
      payload.nodeKey !== 'PROJECT_REVIEW' ||
      payload.event !== 'APPROVE'
    ) {
      return;
    }

    // Check if a police_register already exists for this project (idempotent)
    const existing = await this.db
      .select({ id: policeRegister.id })
      .from(policeRegister)
      .where(eq(policeRegister.projectRegisterId, payload.bizId))
      .limit(1);

    if (existing.length > 0) {
      this.logger.log(
        `Police register already exists for project #${payload.bizId}, skipping auto-create`,
      );
      return;
    }

    await this.db.insert(policeRegister).values({
      projectRegisterId: payload.bizId,
      status: 'DRAFT',
      createdBy: payload.operatorId,
    });

    this.logger.log(
      `Auto-created police register for project #${payload.bizId}`,
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Auto-complete police_register when a scan file is uploaded.
  // Once status transitions to COMPLETED the workflow advances to
  // ON_SITE_ASSESSMENT — this is irreversible (deleting all files later does
  // NOT revert to DRAFT).
  // ─────────────────────────────────────────────────────────────────────────
  @OnEvent('file.uploaded')
  async handleFileUploaded(payload: FileUploadedEvent) {
    if (payload.bizType !== 'POLICE') return;

    const rows = await this.db
      .select({
        id: policeRegister.id,
        status: policeRegister.status,
        projectRegisterId: policeRegister.projectRegisterId,
      })
      .from(policeRegister)
      .where(eq(policeRegister.id, payload.bizId))
      .limit(1);

    const record = rows[0];
    if (!record || record.status !== 'DRAFT') return;

    // Verify at least one non-deleted file exists (defensive check)
    const files = await this.db
      .select({ id: fileAttachment.id })
      .from(fileAttachment)
      .where(
        and(
          eq(fileAttachment.bizType, 'POLICE'),
          eq(fileAttachment.bizId, payload.bizId),
          eq(fileAttachment.deleted, false),
        ),
      )
      .limit(1);

    if (files.length === 0) return;

    // Transition status
    await this.db
      .update(policeRegister)
      .set({
        status: 'COMPLETED',
        updatedBy: payload.uploaderId,
        updatedAt: new Date(),
      })
      .where(eq(policeRegister.id, record.id));

    this.logger.log(
      `Police register #${record.id} auto-completed after file upload`,
    );

    // Signal workflow to advance from POLICE_REGISTER to ON_SITE_ASSESSMENT
    try {
      const policeTasks = await this.db
        .select({ taskId: wfTask.id, instanceId: wfTask.instanceId })
        .from(wfTask)
        .innerJoin(wfInstance, eq(wfTask.instanceId, wfInstance.id))
        .where(
          and(
            eq(wfInstance.bizType, 'PROJECT_REGISTER'),
            eq(wfInstance.bizId, record.projectRegisterId),
            eq(wfTask.nodeKey, 'POLICE_REGISTER'),
            eq(wfTask.status, 'PENDING'),
          ),
        )
        .limit(1);

      if (policeTasks.length > 0) {
        await this.workflowService.signal(
          policeTasks[0].instanceId,
          policeTasks[0].taskId,
          'SUBMIT',
          '电子扫描件已上传，公安登记自动完成',
          payload.uploaderId,
        );
        this.logger.log(
          `Workflow signaled: POLICE_REGISTER → ON_SITE_ASSESSMENT for project #${record.projectRegisterId}`,
        );
      }
    } catch (e) {
      this.logger.error(
        `Failed to signal workflow for police #${record.id}: ${e}`,
      );
    }
  }
}
