import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { eq, and, desc } from 'drizzle-orm';
import { NodeHandler, NodeContext } from './handler.interface';
import { wfTask, wfInstance } from '../../../database/schema/workflow';
import { AssignmentService } from '../assignment.service';

@Injectable()
export class ReviewHandler implements NodeHandler {
  private readonly logger = new Logger(ReviewHandler.name);

  constructor(private readonly assignmentService: AssignmentService) {}

  async onEnter(ctx: NodeContext): Promise<void> {
    // Get projectId for assignment avoidance
    let projectId = (ctx.instance.variables as Record<string, any>)
      ?.projectId ?? null;
    if (projectId == null && ctx.instance.bizType === 'PROJECT_REGISTER') {
      projectId = ctx.instance.bizId;
    }

    // ── Variable-driven assignment (for PROJECT_REVIEW pool/fallback) ──────
    const vars = (ctx.instance.variables as Record<string, any>) || {};
    let reviewerRoleCode: string | undefined = vars.reviewerRoleCode;
    let isPoolReview: boolean = vars.isPoolReview === true;

    let assigneeId: number | null = null;

    if (isPoolReview && reviewerRoleCode) {
      // Pool mode: verify target role has at least one enabled user
      const hasUsers =
        await this.assignmentService.hasActiveRoleUsers(reviewerRoleCode);

      if (!hasUsers) {
        // Fallback: pool target has no active users → single-assign to super_admin
        this.logger.warn(
          `Pool role "${reviewerRoleCode}" has no active users at node "${ctx.nodeDef.nodeKey}", falling back to super_admin single-assign`,
        );
        reviewerRoleCode = 'super_admin';
        isPoolReview = false;

        // Persist the fallback decision so findPage / notifications see it
        const currentVars =
          (ctx.instance.variables as Record<string, any>) || {};
        await ctx.db
          .update(wfInstance)
          .set({
            variables: { ...currentVars, reviewerRoleCode, isPoolReview },
            updatedAt: new Date(),
          })
          .where(eq(wfInstance.id, ctx.instance.id));

        assigneeId = await this.assignmentService.resolveAssignee(
          ctx.nodeDef.nodeKey,
          null,
          projectId,
          [],
          'super_admin',
        );
      } else {
        // Pool: leave assigneeId NULL so all active users of the role can see it
        assigneeId = null;
      }
    } else if (reviewerRoleCode) {
      // Single-assign mode driven by explicit role
      assigneeId = await this.assignmentService.resolveAssignee(
        ctx.nodeDef.nodeKey,
        null,
        projectId,
        [],
        reviewerRoleCode,
      );
    } else {
      // Legacy path: no variables set (historical data / other flows)
      // → fall back to the rule-table default behavior
      assigneeId = await this.assignmentService.resolveAssignee(
        ctx.nodeDef.nodeKey,
        null,
        projectId,
        [],
      );
    }

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
      // Atomic claim: update only if still PENDING (prevents double-approval
      // in pool mode when multiple reviewers click at the same time).
      const updated = await ctx.db
        .update(wfTask)
        .set({
          status: 'COMPLETED',
          result: 'APPROVED',
          remark,
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(eq(wfTask.id, taskId), eq(wfTask.status, 'PENDING')),
        )
        .returning({ id: wfTask.id });

      if (updated.length === 0) {
        throw new BadRequestException('该任务已被他人处理');
      }
      return true;
    }

    if (action === 'REVIEW') {
      if (!remark || remark.trim().length === 0) {
        throw new BadRequestException('复核时意见为必填项');
      }

      const updated = await ctx.db
        .update(wfTask)
        .set({
          status: 'PENDING_RECTIFICATION',
          result: 'REVIEW',
          remark,
          updatedAt: new Date(),
        })
        .where(
          and(eq(wfTask.id, taskId), eq(wfTask.status, 'PENDING')),
        )
        .returning({ id: wfTask.id });

      if (updated.length === 0) {
        throw new BadRequestException('该任务已被他人处理');
      }
      return false; // Node NOT completed — stays at current node
    }

    if (action === 'REJECT') {
      if (!remark || remark.trim().length === 0) {
        throw new BadRequestException('驳回时备注为必填项');
      }

      const updated = await ctx.db
        .update(wfTask)
        .set({
          status: 'COMPLETED',
          result: 'REJECTED',
          remark,
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(eq(wfTask.id, taskId), eq(wfTask.status, 'PENDING')),
        )
        .returning({ id: wfTask.id });

      if (updated.length === 0) {
        throw new BadRequestException('该任务已被他人处理');
      }
      return true;
    }

    if (action === 'ADJUST') {
      if (!remark || remark.trim().length === 0) {
        throw new BadRequestException('调整时备注为必填项');
      }

      const updated = await ctx.db
        .update(wfTask)
        .set({
          status: 'COMPLETED',
          result: 'ADJUSTED',
          remark,
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(
          and(eq(wfTask.id, taskId), eq(wfTask.status, 'PENDING')),
        )
        .returning({ id: wfTask.id });

      if (updated.length === 0) {
        throw new BadRequestException('该任务已被他人处理');
      }

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
