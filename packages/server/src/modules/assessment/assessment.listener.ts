import { Injectable, Inject, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { eq, and } from 'drizzle-orm';
import { DRIZZLE, DrizzleDB } from '../../database/database.module';
import { projectRegister } from '../../database/schema/business';
import { wfInstance } from '../../database/schema/workflow';
import { WorkflowService } from '../workflow/workflow.service';

@Injectable()
export class AssessmentListener {
  private readonly logger = new Logger(AssessmentListener.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly workflowService: WorkflowService,
  ) {}

  @OnEvent('workflow.node.completed')
  async handleNodeCompleted(payload: {
    bizType: string;
    bizId: number;
    instanceId: number;
    nodeKey: string;
    event: string;
    operatorId: number;
    remark?: string;
  }) {
    if (payload.bizType !== 'PROJECT_REGISTER') return;

    const { nodeKey, event, bizId } = payload;

    // Tech review completed
    if (nodeKey === 'TECH_REVIEW') {
      if (event === 'APPROVE') {
        await this.updateStatus(bizId, 'TECH_APPROVED');
      } else if (event === 'REJECT') {
        await this.updateStatus(bizId, 'TECH_REJECTED');
      }
    }

    // Content review completed (parallel — all approved or any rejected)
    if (nodeKey === 'CONTENT_REVIEW') {
      if (event === 'ALL_APPROVED') {
        await this.updateStatus(bizId, 'CONTENT_APPROVED');
      } else if (event === 'ANY_REJECTED') {
        await this.updateStatus(bizId, 'CONTENT_REJECTED');
      }
    }

    // Final review completed
    if (nodeKey === 'FINAL_REVIEW') {
      if (event === 'APPROVE') {
        await this.updateStatus(bizId, 'FINAL_APPROVED');
      } else if (event === 'ADJUST') {
        await this.updateStatus(bizId, 'FINAL_ADJUST');
      } else if (event === 'REJECT') {
        // REJECT → roll back to ON_SITE_ASSESSMENT (PM sees rejection reason, fixes, re-initiates)
        this.logger.log(
          `FINAL_REVIEW rejected for project #${bizId}, rolling back to ON_SITE_ASSESSMENT`,
        );
        await this.updateStatus(bizId, 'FINAL_REJECTED');
        await this.workflowService.rejectToAssessment(
          payload.instanceId,
          payload.operatorId,
          payload.remark ?? '最终审核驳回，请修改测评成果后重新发起质量审核',
        );
      }
    }

    // Material archive completed — project finished
    if (nodeKey === 'MATERIAL_ARCHIVE' && event === 'SUBMIT') {
      await this.updateStatus(bizId, 'COMPLETED');
    }
  }

  private async updateStatus(bizId: number, status: string) {
    await this.db
      .update(projectRegister)
      .set({ status, updatedAt: new Date() })
      .where(eq(projectRegister.id, bizId));
  }
}
