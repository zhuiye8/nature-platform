import { Injectable } from '@nestjs/common';
import { eq, and } from 'drizzle-orm';
import { NodeHandler, NodeContext } from './handler.interface';
import { wfTask } from '../../../database/schema/workflow';

@Injectable()
export class SimpleHandler implements NodeHandler {
  async onEnter(ctx: NodeContext): Promise<void> {
    const config = (ctx.nodeDef.config as any) || {};
    const isPool = config.assignMode === 'pool';

    await ctx.db.insert(wfTask).values({
      instanceId: ctx.instance.id,
      nodeKey: ctx.nodeDef.nodeKey,
      slotKey: null,
      assigneeId: isPool ? null : ctx.instance.startedBy,
      status: 'PENDING',
    });
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

    return true;
  }

  async resolveCompletionEvent(_ctx: NodeContext): Promise<string> {
    return 'SUBMIT';
  }
}
