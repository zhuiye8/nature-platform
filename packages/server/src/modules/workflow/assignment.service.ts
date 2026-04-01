import { Inject, Injectable, Logger } from '@nestjs/common';
import { eq, and, asc } from 'drizzle-orm';
import { DRIZZLE, DrizzleDB } from '../../database/database.module';
import { wfAssignmentRule } from '../../database/schema/workflow';
import { userRole } from '../../database/schema/iam';
import { projectMember } from '../../database/schema/business';

@Injectable()
export class AssignmentService {
  private readonly logger = new Logger(AssignmentService.name);

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  /**
   * Resolve an assignee for a given node/slot based on wf_assignment_rule.
   *
   * For each rule (by priority ASC):
   *   1. Find users with the matching role_code
   *   2. If avoidance_rule is SAME_PROJECT, exclude users in project_member
   *   3. Exclude already-assigned users
   *   4. Return first eligible user (by sort_order)
   *
   * Returns null if no candidate found.
   */
  async resolveAssignee(
    nodeKey: string,
    slotKey: string | null,
    projectId: number | null,
    alreadyAssigned: number[],
  ): Promise<number | null> {
    // Build the where clause for assignment rules
    const rules = await this.db
      .select()
      .from(wfAssignmentRule)
      .where(
        slotKey
          ? and(
              eq(wfAssignmentRule.nodeKey, nodeKey),
              eq(wfAssignmentRule.slotKey, slotKey),
            )
          : eq(wfAssignmentRule.nodeKey, nodeKey),
      )
      .orderBy(asc(wfAssignmentRule.priority));

    for (const rule of rules) {
      // Find users with this role_code, ordered by sort_order
      const roleUsers = await this.db
        .select()
        .from(userRole)
        .where(eq(userRole.roleCode, rule.roleCode))
        .orderBy(asc(userRole.sortOrder));

      const allCandidates = roleUsers.map((ru) => ru.userId);
      if (allCandidates.length === 0) continue;

      let candidateUserIds = [...allCandidates];

      // Apply avoidance rule: exclude users on the same project
      if (
        rule.avoidanceRule === 'SAME_PROJECT' &&
        projectId != null
      ) {
        const members = await this.db
          .select()
          .from(projectMember)
          .where(
            and(
              eq(projectMember.projectId, projectId),
              eq(projectMember.status, 'ACTIVE'),
            ),
          );

        const memberUserIds = new Set(members.map((m) => m.userId));
        candidateUserIds = candidateUserIds.filter(
          (uid) => !memberUserIds.has(uid),
        );

        // Fallback: if avoidance leaves no one, use original list (first person of this role)
        if (candidateUserIds.length === 0) {
          this.logger.warn(
            `Avoidance left no candidates for node="${nodeKey}" slot="${slotKey}" role="${rule.roleCode}", falling back to first candidate`,
          );
          candidateUserIds = [...allCandidates];
        }
      }

      // Exclude already assigned users
      if (alreadyAssigned.length > 0) {
        const excludeSet = new Set(alreadyAssigned);
        candidateUserIds = candidateUserIds.filter(
          (uid) => !excludeSet.has(uid),
        );
      }

      if (candidateUserIds.length > 0) {
        return candidateUserIds[0];
      }
    }

    this.logger.warn(
      `No eligible assignee found for node="${nodeKey}" slot="${slotKey}"`,
    );
    return null;
  }
}
