import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { WorkflowService } from '../workflow/workflow.service';

/**
 * Assessment 阶段的工作流事件监听器。
 *
 * 设计原则：`project_register.status` 只反映"项目登记环节"自身的状态
 * （DRAFT / SUBMITTED / APPROVED / REJECTED），后续节点（TECH_REVIEW /
 * CONTENT_REVIEW / FINAL_REVIEW / MATERIAL_ARCHIVE）的流转**不**再回写项目状态。
 * 流转历史由 wf_instance.current_node + wf_action_log 承担。
 *
 * 本 listener 仅保留 FINAL_REVIEW REJECT 的工作流回退动作
 * （最终审核驳回 → 工作流回到 ON_SITE_ASSESSMENT 节点）。
 */
@Injectable()
export class AssessmentListener {
  private readonly logger = new Logger(AssessmentListener.name);

  constructor(private readonly workflowService: WorkflowService) {}

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

    // 最终审核驳回 → 回到现场测评（PM 修改测评成果后重新发起质量审核）
    if (payload.nodeKey === 'FINAL_REVIEW' && payload.event === 'REJECT') {
      this.logger.log(
        `FINAL_REVIEW rejected for project #${payload.bizId}, rolling back to ON_SITE_ASSESSMENT`,
      );
      await this.workflowService.rejectToAssessment(
        payload.instanceId,
        payload.operatorId,
        payload.remark ?? '最终审核驳回，请修改测评成果后重新发起质量审核',
      );
    }
  }
}
