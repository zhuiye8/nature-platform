import { Injectable, BadRequestException } from '@nestjs/common';
import { eq, and, desc } from 'drizzle-orm';
import { NodeHandler, NodeContext } from './handler.interface';
import { wfTask, wfInstance } from '../../../database/schema/workflow';
import { AssignmentService } from '../assignment.service';

@Injectable()
export class ReviewHandler implements NodeHandler {
  constructor(private readonly assignmentService: AssignmentService) {}

  async onEnter(ctx: NodeContext): Promise<void> {
    // Get projectId for assignment avoidance
    let projectId = (ctx.instance.variables as Record<string, any>)
      ?.projectId ?? null;
    if (projectId == null && ctx.instance.bizType === 'PROJECT_REGISTER') {
      projectId = ctx.instance.bizId;
    }

    const assigneeId = await this.assignmentService.resolveAssignee(
      ctx.nodeDef.nodeKey,
      null,
      projectId,
      [],
    );

    await ctx.db.insert(wfTask).values({
      instanceId: ctx.instance.id,
      nodeKey: ctx.nodeDef.nodeKey,
      slotKey: null,
      assigneeId,
      status: 'PENDING',
    });
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

      return true;
    }

    if (action === 'REVIEW') {
      if (!remark || remark.trim().length === 0) {
        throw new BadRequestException('复核时意见为必填项');
      }

      await ctx.db
        .update(wfTask)
        .set({
          status: 'PENDING_RECTIFICATION',
          result: 'REVIEW',
          remark,
          updatedAt: new Date(),
        })
        .where(eq(wfTask.id, taskId));

      return false; // Node NOT completed — stays at current node
    }

    if (action === 'REJECT') {
      if (!remark || remark.trim().length === 0) {
        throw new BadRequestException('驳回时备注为必填项');
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

      return true;
    }

    if (action === 'ADJUST') {
      if (!remark || remark.trim().length === 0) {
        throw new BadRequestException('调整时备注为必填项');
      }

      await ctx.db
        .update(wfTask)
        .set({
          status: 'COMPLETED',
          result: 'ADJUSTED',
          remark,
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(wfTask.id, taskId));

      // Set skip_to_final flag in instance variables
      const currentVars = (ctx.instance.variables as Record<string, any>) || {};
      await ctx.db
        .update(wfInstance)
        .set({
          variables: { ...currentVars, skip_to_final: true },
          updatedAt: new Date(),
        })
        .where(eq(wfInstance.id, ctx.instance.id));

      return true;
    }

    throw new BadRequestException(`未知的审核操作: ${action}`);
  }

  async resolveCompletionEvent(ctx: NodeContext): Promise<string> {
    const tasks = await ctx.db
      .select()
      .from(wfTask)
      .where(
        and(
          eq(wfTask.instanceId, ctx.instance.id),
          eq(wfTask.nodeKey, ctx.nodeDef.nodeKey),
        ),
      )
      .orderBy(desc(wfTask.id));

    const lastTask = tasks[0]; // Most recent task (highest id)
    if (lastTask?.result === 'APPROVED') return 'APPROVE';
    if (lastTask?.result === 'REJECTED') return 'REJECT';
    if (lastTask?.result === 'ADJUSTED') return 'ADJUST';
    return 'APPROVE';
  }
}
