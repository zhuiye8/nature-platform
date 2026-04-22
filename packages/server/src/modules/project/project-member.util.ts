import { and, desc, eq, inArray } from 'drizzle-orm';
import { DrizzleDB } from '../../database/database.module';
import { projectMember } from '../../database/schema/business';
import { userAccount } from '../../database/schema/user';
import { userRole } from '../../database/schema/iam';
import { wfActionLog, wfInstance } from '../../database/schema/workflow';

/**
 * 测评师等级，取自 iam_role.role_code：
 * - senior_assessor → 'senior'
 * - middle_assessor → 'middle'
 * - junior_assessor → 'junior'
 * 未配置等级角色的用户 → null
 */
export type AssessorLevel = 'senior' | 'middle' | 'junior';

/**
 * 项目成员（含等级、按展示规则排序后）。
 * 前端直接用，不需要二次排序。
 */
export interface EnrichedProjectMember {
  id: number;
  userId: number;
  displayName: string;
  roleType: string; // 'PM' | 'ASSESSOR' | 'REPORT_WRITER'
  status: string;
  assignedAt: Date;
  /** 测评师等级；PM 和 REPORT_WRITER 也可能有（只要用户拥有对应角色） */
  level: AssessorLevel | null;
}

/** 等级优先级（从高到低） */
const LEVEL_RANK: Record<AssessorLevel, number> = {
  senior: 3,
  middle: 2,
  junior: 1,
};

/** 角色展示顺序：PM → ASSESSOR → REPORT_WRITER → 其他 */
const ROLE_ORDER: Record<string, number> = {
  PM: 0,
  ASSESSOR: 1,
  REPORT_WRITER: 2,
};

const ASSESSOR_LEVEL_ROLES = [
  'senior_assessor',
  'middle_assessor',
  'junior_assessor',
] as const;

/**
 * 加载项目的 ACTIVE 成员并注入测评师等级，按展示规则排序：
 * 1) PM 第一
 * 2) ASSESSOR 按等级降序（senior > middle > junior > 未分级）
 * 3) 同等级按 assignedAt 升序（先来先到）
 * 4) REPORT_WRITER 放在 ASSESSOR 后面（调用方如需过滤可自行处理）
 *
 * 注意：此函数仅负责加载 + 排序，不过滤 REPORT_WRITER —— 前端展示层按需过滤。
 */
export async function loadProjectMembersEnriched(
  db: DrizzleDB,
  projectId: number,
): Promise<EnrichedProjectMember[]> {
  const rows = await db
    .select({
      id: projectMember.id,
      userId: projectMember.userId,
      displayName: userAccount.displayName,
      roleType: projectMember.roleType,
      status: projectMember.status,
      assignedAt: projectMember.assignedAt,
    })
    .from(projectMember)
    .innerJoin(userAccount, eq(projectMember.userId, userAccount.id))
    .where(
      and(
        eq(projectMember.projectId, projectId),
        eq(projectMember.status, 'ACTIVE'),
      ),
    );

  if (rows.length === 0) return [];

  // 一次批量查等级角色，避免 N+1
  const userIds = Array.from(new Set(rows.map((r) => r.userId)));
  const levelRows = await db
    .select({
      userId: userRole.userId,
      roleCode: userRole.roleCode,
    })
    .from(userRole)
    .where(
      and(
        inArray(userRole.userId, userIds),
        inArray(userRole.roleCode, [...ASSESSOR_LEVEL_ROLES]),
      ),
    );

  // 同一用户持有多个等级角色时取最高
  const levelByUser = new Map<number, AssessorLevel>();
  for (const lr of levelRows) {
    const lv = lr.roleCode.replace('_assessor', '') as AssessorLevel;
    const current = levelByUser.get(lr.userId);
    if (!current || LEVEL_RANK[lv] > LEVEL_RANK[current]) {
      levelByUser.set(lr.userId, lv);
    }
  }

  const enriched: EnrichedProjectMember[] = rows.map((r) => ({
    ...r,
    level: levelByUser.get(r.userId) ?? null,
  }));

  enriched.sort((a, b) => {
    // 1) 角色顺序
    const roleDiff = (ROLE_ORDER[a.roleType] ?? 99) - (ROLE_ORDER[b.roleType] ?? 99);
    if (roleDiff !== 0) return roleDiff;
    // 2) 等级降序（null 视为 0）
    const aLv = a.level ? LEVEL_RANK[a.level] : 0;
    const bLv = b.level ? LEVEL_RANK[b.level] : 0;
    if (aLv !== bLv) return bLv - aLv;
    // 3) assignedAt 升序
    return a.assignedAt.getTime() - b.assignedAt.getTime();
  });

  return enriched;
}

/**
 * 编制人信息。独立于"项目成员"展示，前端会将 REPORT_WRITER 从成员列表中过滤掉。
 * lastCompiledAt 取最近一次 REPORT_COMPILE SUBMIT 的 wf_action_log.createdAt；
 * 若项目尚未有任何编制提交则为 null（前端显示 "尚未提交"）。
 */
export interface ProjectReportWriterInfo {
  displayName: string;
  lastCompiledAt: string | null;
}

/**
 * 根据已加载的 enriched members 和项目 id 查询编制人信息。
 * 传入 members 而不是自己查是为了避免重复查询 —— 调用方必然已调过
 * {@link loadProjectMembersEnriched}。
 *
 * 若项目无 REPORT_WRITER 成员，返回 null（调用方据此决定是否展示编制人区块）。
 */
export async function loadReportWriterInfo(
  db: DrizzleDB,
  projectId: number,
  members: EnrichedProjectMember[],
): Promise<ProjectReportWriterInfo | null> {
  const writer = members.find((m) => m.roleType === 'REPORT_WRITER');
  if (!writer) return null;

  const lastRows = await db
    .select({ createdAt: wfActionLog.createdAt })
    .from(wfActionLog)
    .innerJoin(wfInstance, eq(wfActionLog.instanceId, wfInstance.id))
    .where(
      and(
        eq(wfInstance.bizType, 'PROJECT_REGISTER'),
        eq(wfInstance.bizId, projectId),
        eq(wfActionLog.nodeKey, 'REPORT_COMPILE'),
        eq(wfActionLog.action, 'SUBMIT'),
      ),
    )
    .orderBy(desc(wfActionLog.createdAt))
    .limit(1);

  return {
    displayName: writer.displayName,
    lastCompiledAt: lastRows[0]?.createdAt.toISOString() ?? null,
  };
}
