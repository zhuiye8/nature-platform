import { Inject, Injectable } from '@nestjs/common';
import { eq, and, desc } from 'drizzle-orm';
import { DRIZZLE, DrizzleDB } from '../../database/database.module';
import {
  wfTransition,
  WfTransitionRow,
  WfInstanceRow,
} from '../../database/schema/workflow';

@Injectable()
export class TransitionResolver {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  /**
   * Find the highest-priority transition matching the given event from a node.
   * Evaluates guard expressions against instance variables.
   * Returns the first transition whose guard passes (or has no guard).
   */
  async resolve(
    definitionId: number,
    fromNodeKey: string,
    event: string,
    instance?: WfInstanceRow | null,
  ): Promise<WfTransitionRow | null> {
    const rows = await this.db
      .select()
      .from(wfTransition)
      .where(
        and(
          eq(wfTransition.definitionId, definitionId),
          eq(wfTransition.fromNodeKey, fromNodeKey),
          eq(wfTransition.event, event),
        ),
      )
      .orderBy(desc(wfTransition.priority));

    // Evaluate guards: highest priority first
    for (const row of rows) {
      if (!row.guardExpr) {
        // No guard = default/fallback transition
        return row;
      }

      // Evaluate guard against instance variables
      if (this.evaluateGuard(row.guardExpr, instance)) {
        return row;
      }
    }

    // No matching transition (all guards failed and no default)
    return rows.find((r) => !r.guardExpr) ?? null;
  }

  /**
   * Simple guard evaluator: checks if a variable name is truthy in instance.variables.
   *
   * 当前支持的 guard 表达式（写在 wf_transition.guard_expr）：
   * - "skip_dept_review" → 项目登记审核时，合同已归档跳过部门经理确认节点
   *
   * （后续如需基于 project_member 等业务表查询的 guard，应改为 async 实现）
   */
  private evaluateGuard(
    guardExpr: string,
    instance?: WfInstanceRow | null,
  ): boolean {
    if (!instance) return false;
    const vars = (instance.variables as Record<string, any>) || {};

    // Simple variable check: guard_expr is a variable name, check if truthy
    return !!vars[guardExpr];
  }
}
