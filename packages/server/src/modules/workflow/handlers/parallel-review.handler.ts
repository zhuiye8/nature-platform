import { Injectable, BadRequestException } from '@nestjs/common';
import { eq, and, ne, inArray } from 'drizzle-orm';
import { NodeHandler, NodeContext } from './handler.interface';
import { wfTask } from '../../../database/schema/workflow';
import { AssignmentService } from '../assignment.service';

@Injectable()
export class ParallelReviewHandler implements NodeHandler {
  constructor(private readonly assignmentService: AssignmentService) {}

  async onEnter(ctx: NodeContext): Promise<void> {
    const config = ctx.nodeDef.config as Record<string, any> | null;
    const slots: string[] = config?.slots ?? [];

    if (slots.length === 0) {
      throw new BadRequestException(
        `ParallelReview node "${ctx.nodeDef.nodeKey}" has no slots configured`,
      );
    }

    // Cancel all previous tasks for this node (from prior rounds)
    await ctx.db
      .update(wfTask)
      .set({ status: 'CANCELLED', updatedAt: new Date() })
      .where(
        and(
          eq(wfTask.instanceId, ctx.instance.id),
          eq(wfTask.nodeKey, ctx.nodeDef.nodeKey),
          ne(wfTask.status, 'CANCELLED'),
        ),
      );

    // Get projectId from variables, or fallback to bizId for PROJECT_REGISTER instances
    let projectId = (ctx.instance.variables as Record<string, any>)
      ?.projectId ?? null;
    if (projectId == null && ctx.instance.bizType === 'PROJECT_REGISTER') {
      projectId = ctx.instance.bizId;
    }

    const alreadyAssigned: number[] = [];

    for (const slotKey of slots) {
      const assigneeId = await this.assignmentService.resolveAssignee(
        ctx.nodeDef.nodeKey,
        slotKey,
        projectId,
        alreadyAssigned,
      );

      if (assigneeId != null) {
        alreadyAssigned.push(assigneeId);
      }

      await ctx.db.insert(wfTask).values({
        instanceId: ctx.instance.id,
        nodeKey: ctx.nodeDef.nodeKey,
        slotKey,
        assigneeId,
        status: 'PENDING',
      });
    }
  }

  async onTaskAction(
    ctx: NodeContext,
    taskId: number,
    action: string,
    remark: string | null,
  ): Promise<boolean> {
    if (action === 'APPROVE') {
      await ctx.db
        .update(wfTask)
        .set({
          status: 'COMPLETED',
          result: 'APPROVED',
          remark,
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(wfTask.id, taskId));
    } else if (action === 'REVIEW') {
      if (!remark || remark.trim().length === 0) {
        throw new BadRequestException('复核时意见为必填项');
      }

      // Any reviewer triggers REVIEW → ALL tasks go to PENDING_RECTIFICATION
      await ctx.db
        .update(wfTask)
        .set({
          status: 'PENDING_RECTIFICATION',
          result: 'REVIEW',
          remark,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(wfTask.instanceId, ctx.instance.id),
            eq(wfTask.nodeKey, ctx.nodeDef.nodeKey),
            inArray(wfTask.status, ['PENDING', 'COMPLETED']),
          ),
        );

      return false; // Node NOT completed — all reviewers must re-review after resubmit

    } else if (action === 'REJECT') {
      if (!remark || remark.trim().length === 0) {
        throw new BadRequestException(
          'Remark is required when rejecting a task',
        );
      }
      await ctx.db
        .update(wfTask)
        .set({
          status: 'COMPLETED',
          result: 'REJECTED',
          remark,
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(wfTask.id, taskId));
    } else {
      throw new BadRequestException(
        `Unknown parallel review action: ${action}`,
      );
    }

    // Check if all CURRENT round tasks are completed (exclude CANCELLED and PENDING_RECTIFICATION)
    const currentTasks = await this.getCurrentRoundTasks(ctx);
    return currentTasks.every((t) => t.status === 'COMPLETED');
  }

  async resolveCompletionEvent(ctx: NodeContext): Promise<string> {
    const currentTasks = await this.getCurrentRoundTasks(ctx);

    const anyRejected = currentTasks.some((t) => t.result === 'REJECTED');
    if (anyRejected) return 'ANY_REJECTED';

    return 'ALL_APPROVED';
  }

  // Get only current round tasks (exclude CANCELLED from prior rounds and PENDING_RECTIFICATION)
  private async getCurrentRoundTasks(ctx: NodeContext) {
    return ctx.db
      .select()
      .from(wfTask)
      .where(
        and(
          eq(wfTask.instanceId, ctx.instance.id),
          eq(wfTask.nodeKey, ctx.nodeDef.nodeKey),
          ne(wfTask.status, 'CANCELLED'),
          ne(wfTask.status, 'PENDING_RECTIFICATION'),
        ),
      );
  }
}
