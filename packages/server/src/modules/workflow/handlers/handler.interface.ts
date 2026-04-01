import { DrizzleDB } from '../../../database/database.module';
import { WfInstanceRow, WfNodeRow } from '../../../database/schema/workflow';

export interface NodeContext {
  db: DrizzleDB;
  instance: WfInstanceRow;
  nodeDef: WfNodeRow;
  currentUserId: number;
}

export interface NodeHandler {
  /** Called when workflow enters this node. Creates tasks. */
  onEnter(ctx: NodeContext): Promise<void>;

  /** Called when a task action occurs. Returns true if node is complete. */
  onTaskAction(
    ctx: NodeContext,
    taskId: number,
    action: string,
    remark: string | null,
  ): Promise<boolean>;

  /** Returns the event to fire when node completes. */
  resolveCompletionEvent(ctx: NodeContext): Promise<string>;
}
