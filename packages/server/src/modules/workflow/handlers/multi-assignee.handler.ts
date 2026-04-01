import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { eq, and, ne } from 'drizzle-orm';
import { NodeHandler, NodeContext } from './handler.interface';
import { wfTask } from '../../../database/schema/workflow';
import { projectMember } from '../../../database/schema/business';

@Injectable()
export class MultiAssigneeHandler implements NodeHandler {
  private readonly logger = new Logger(MultiAssigneeHandler.name);

  async onEnter(ctx: NodeContext): Promise<void> {
    const config = ctx.nodeDef.config as Record<string, any> | null;
    const source: string = config?.source ?? 'PROJECT_MEMBER';
    const roleTypes: string[] = config?.role_types ?? [];

    if (source.toUpperCase() !== 'PROJECT_MEMBER') {
      throw new BadRequestException(
        `MultiAssignee source "${source}" is not supported yet`,
      );
    }

    // Get projectId from variables, or fallback to bizId for PROJECT_REGISTER instances
    let projectId = (ctx.instance.variables as Record<string, any>)
      ?.projectId ?? null;
    if (projectId == null && ctx.instance.bizType === 'PROJECT_REGISTER') {
      projectId = ctx.instance.bizId;
    }

    if (!projectId) {
      throw new BadRequestException(
        'MultiAssignee requires a projectId in instance variables or bizId',
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

    // Query project members with matching role types
    let members = await ctx.db
      .select()
      .from(projectMember)
      .where(
        and(
          eq(projectMember.projectId, projectId),
          eq(projectMember.status, 'ACTIVE'),
        ),
      );

    if (roleTypes.length > 0) {
      members = members.filter((m) => roleTypes.includes(m.roleType));
    }

    if (members.length === 0) {
      this.logger.warn(
        `No eligible members found for node "${ctx.nodeDef.nodeKey}" ` +
          `in project #${projectId} with role_types=${JSON.stringify(roleTypes)}`,
      );
    }

    for (const member of members) {
      await ctx.db.insert(wfTask).values({
        instanceId: ctx.instance.id,
        nodeKey: ctx.nodeDef.nodeKey,
        slotKey: member.roleType,
        assigneeId: member.userId,
        status: 'PENDING',
      });
    }
  }

  async onTaskAction(
    ctx: NodeContext,
    taskId: number,
    _action: string,
    remark: string | null,
  ): Promise<boolean> {
    await ctx.db
      .update(wfTask)
      .set({
        status: 'COMPLETED',
        result: 'SUBMITTED',
        remark,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(wfTask.id, taskId));

    // Check if all CURRENT round tasks are completed (exclude CANCELLED)
    const currentTasks = await ctx.db
      .select()
      .from(wfTask)
      .where(
        and(
          eq(wfTask.instanceId, ctx.instance.id),
          eq(wfTask.nodeKey, ctx.nodeDef.nodeKey),
          ne(wfTask.status, 'CANCELLED'),
        ),
      );

    return currentTasks.every((t) => t.status === 'COMPLETED');
  }

  async resolveCompletionEvent(_ctx: NodeContext): Promise<string> {
    return 'ALL_COMPLETE';
  }
}
