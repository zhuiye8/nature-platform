import {
  Inject,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { eq, and, or, desc, ilike, inArray, isNotNull } from 'drizzle-orm';
import { DRIZZLE, DrizzleDB } from '../../database/database.module';
import { projectRegister } from '../../database/schema/business';
import { userAccount } from '../../database/schema/user';
import { userRole } from '../../database/schema/iam';
import { wfInstance, wfTask, wfActionLog } from '../../database/schema/workflow';
import { WorkflowService } from '../workflow/workflow.service';
import {
  SubmitReportDto,
  QueryReportDto,
  REPORT_STATUS_VALUES,
  type ReportStatus,
} from './dto/report.dto';

/**
 * 列表项业务状态到前端字典（与 REPORT_STATUS_VALUES 一致）：
 * - PENDING   待编制  : RUNNING + current_node=REPORT_COMPILE + 非整改
 * - REVIEWING 审核中  : RUNNING + current_node=FINAL_REVIEW
 * - REVISION  待修改  : 存在 PENDING_RECTIFICATION 或 REVIEW_TO_COMPILE 日志
 * - APPROVED  已通过  : current_node=MATERIAL_ARCHIVE 或 instance.status=COMPLETED
 */

@Injectable()
export class ReportService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly workflowService: WorkflowService,
  ) {}

  // -----------------------------------------------------------------------
  // List projects that have entered the report stage (曾分配过编制人).
  // 持久化口径: project_register.compiled_by IS NOT NULL
  //   - 由 report.listener 在 REPORT_ASSIGN APPROVE 时写入
  //   - submitReport 后会覆盖为实际提交人
  //   - 归档完成（COMPLETED）后仍保留，满足"报告管理数据永久保留"需求
  //
  // Visible to all report_writer role users + super_admin + dept_manager
  // (report_writer 仅可见自己负责的项目)
  // -----------------------------------------------------------------------
  async findPage(query: QueryReportDto, userId: number) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    // Check permissions
    const roles = await this.db
      .select({ roleCode: userRole.roleCode })
      .from(userRole)
      .where(eq(userRole.userId, userId));
    const roleCodes = roles.map((r) => r.roleCode);

    const isSuperAdmin = roleCodes.includes('super_admin');
    const isReportWriter = roleCodes.includes('report_writer');
    const isDeptManager = roleCodes.includes('dept_manager');

    if (!isSuperAdmin && !isReportWriter && !isDeptManager) {
      return { list: [], total: 0, page, pageSize };
    }

    // ── 数据范围：曾进入过报告编制流程的项目（compiled_by 非空） ──
    const whereConditions = [
      eq(projectRegister.deleted, false),
      isNotNull(projectRegister.compiledBy),
    ];

    // 可见性：report_writer 只看自己的（除非也是 super_admin / dept_manager）
    if (isReportWriter && !isSuperAdmin && !isDeptManager) {
      whereConditions.push(eq(projectRegister.compiledBy, userId));
    }

    // 筛选：项目名称 keyword
    if (query.keyword && query.keyword.trim()) {
      whereConditions.push(
        ilike(projectRegister.applicationName, `%${query.keyword.trim()}%`),
      );
    }

    // 筛选：指定编制人
    if (query.compilerId) {
      whereConditions.push(eq(projectRegister.compiledBy, query.compilerId));
    }

    // ── 一次性取所有候选项目 + 关联 wf_instance 拿 current_node ──
    // 业务数据量级（报告管理几十到上百条）下可内存过滤 + 分页；
    // 若后续规模化再下推状态到 SQL 层。
    const candidates = await this.db
      .select({
        id: projectRegister.id,
        applicationName: projectRegister.applicationName,
        contractYear: projectRegister.contractYear,
        projectStatus: projectRegister.status,
        compiledBy: projectRegister.compiledBy,
        compiledAt: projectRegister.compiledAt,
        createdAt: projectRegister.createdAt,
        instanceId: wfInstance.id,
        currentNode: wfInstance.currentNode,
        wfStatus: wfInstance.status,
      })
      .from(projectRegister)
      .leftJoin(
        wfInstance,
        and(
          eq(wfInstance.bizId, projectRegister.id),
          eq(wfInstance.bizType, 'PROJECT_REGISTER'),
        ),
      )
      .where(and(...whereConditions))
      .orderBy(desc(projectRegister.createdAt));

    if (candidates.length === 0) {
      return { list: [], total: 0, page, pageSize };
    }

    // ── 批量查整改相关信号（避免 N+1）──
    //   1) wf_task.status = PENDING_RECTIFICATION for REPORT_COMPILE
    //   2) wf_action_log.action = REVIEW_TO_COMPILE
    const instanceIds = candidates
      .map((c) => c.instanceId)
      .filter((id): id is number => id !== null);

    // 一次查询拿所有实例的 PENDING/PENDING_RECTIFICATION tasks（用于跳转 + 整改信号）,
    // 以及 REVIEW_TO_COMPILE 日志（另一种整改信号）。
    const [pendingTasks, reviewLogs] = await Promise.all([
      instanceIds.length > 0
        ? this.db
            .select({
              id: wfTask.id,
              instanceId: wfTask.instanceId,
              nodeKey: wfTask.nodeKey,
              status: wfTask.status,
            })
            .from(wfTask)
            .where(
              and(
                inArray(wfTask.instanceId, instanceIds),
                or(
                  eq(wfTask.status, 'PENDING'),
                  eq(wfTask.status, 'PENDING_RECTIFICATION'),
                ),
              ),
            )
        : Promise.resolve(
            [] as {
              id: number;
              instanceId: number;
              nodeKey: string;
              status: string;
            }[],
          ),
      instanceIds.length > 0
        ? this.db
            .select({ instanceId: wfActionLog.instanceId })
            .from(wfActionLog)
            .where(
              and(
                inArray(wfActionLog.instanceId, instanceIds),
                eq(wfActionLog.action, 'REVIEW_TO_COMPILE'),
              ),
            )
        : Promise.resolve([] as { instanceId: number }[]),
    ]);

    // 整改信号 1：REPORT_COMPILE 存在 PENDING_RECTIFICATION task
    const rectInstanceIds = new Set(
      pendingTasks
        .filter(
          (t) =>
            t.nodeKey === 'REPORT_COMPILE' &&
            t.status === 'PENDING_RECTIFICATION',
        )
        .map((t) => t.instanceId),
    );
    // 整改信号 2：FINAL_REVIEW 复核退回 REPORT_COMPILE 的日志
    const reviewedInstanceIds = new Set(reviewLogs.map((l) => l.instanceId));

    // 按 (instanceId, nodeKey) 索引 pending tasks，用于推 currentTaskId / viewTaskId
    const taskByInstanceNode = new Map<string, number>();
    for (const t of pendingTasks) {
      const key = `${t.instanceId}:${t.nodeKey}`;
      if (!taskByInstanceNode.has(key)) taskByInstanceNode.set(key, t.id);
    }

    // ── 批量查编制人姓名（避免 N+1）──
    const compilerIds = Array.from(
      new Set(
        candidates
          .map((c) => c.compiledBy)
          .filter((id): id is number => id !== null),
      ),
    );
    const compilerNameMap = new Map<number, string>();
    if (compilerIds.length > 0) {
      const users = await this.db
        .select({ id: userAccount.id, displayName: userAccount.displayName })
        .from(userAccount)
        .where(inArray(userAccount.id, compilerIds));
      for (const u of users) compilerNameMap.set(u.id, u.displayName);
    }

    // ── 为每条候选推导业务状态 + 可操作/可查看的 taskId ──
    const enriched = candidates.map((row) => {
      const status = this.deriveReportStatus(row, {
        rectInstanceIds,
        reviewedInstanceIds,
      });
      const needsRevision = status === 'REVISION';

      // currentTaskId：编制人可操作的 REPORT_COMPILE task（仅当前节点在此时）
      const currentTaskId =
        row.instanceId && row.currentNode === 'REPORT_COMPILE'
          ? (taskByInstanceNode.get(`${row.instanceId}:REPORT_COMPILE`) ?? null)
          : null;

      // viewTaskId：当前节点任一 PENDING/PENDING_RECTIFICATION task，
      // 用于跳 TaskDetail 只读查看（例如 FINAL_REVIEW 审核中时）
      const viewTaskId =
        row.instanceId && row.currentNode
          ? (taskByInstanceNode.get(`${row.instanceId}:${row.currentNode}`) ??
            null)
          : null;

      return {
        id: row.id,
        applicationName: row.applicationName,
        contractYear: row.contractYear,
        status: row.projectStatus,
        compiledBy: row.compiledBy,
        compiledAt: row.compiledAt,
        createdAt: row.createdAt,
        compilerName: row.compiledBy
          ? (compilerNameMap.get(row.compiledBy) ?? null)
          : null,
        currentNode: row.currentNode,
        currentTaskId,
        viewTaskId,
        // 保留字段供前端既有渲染（按业务状态推导，等价于 status==='REVISION'）
        needsRevision,
        businessStatus: status,
      };
    });

    // ── 状态筛选（在内存中，因为 REVISION 判定含子查询信号）──
    const filtered = query.status
      ? enriched.filter((e) => e.businessStatus === query.status)
      : enriched;

    const total = filtered.length;
    const start = (page - 1) * pageSize;
    const pagedList = filtered.slice(start, start + pageSize);

    return { list: pagedList, total, page, pageSize };
  }

  /**
   * 按当前节点、状态、整改信号推导业务状态。
   * 纯函数，便于测试和复用。
   */
  private deriveReportStatus(
    row: {
      instanceId: number | null;
      currentNode: string | null;
      wfStatus: string | null;
    },
    signals: {
      rectInstanceIds: Set<number>;
      reviewedInstanceIds: Set<number>;
    },
  ): ReportStatus {
    const { instanceId, currentNode, wfStatus } = row;

    // 已完成：wf_instance.status=COMPLETED（流程结束）或当前节点已过最终审核
    if (wfStatus === 'COMPLETED' || currentNode === 'MATERIAL_ARCHIVE') {
      return 'APPROVED';
    }

    // 最终审核中
    if (currentNode === 'FINAL_REVIEW') {
      return 'REVIEWING';
    }

    // 报告编制节点 —— 区分整改 vs 首次编制
    if (currentNode === 'REPORT_COMPILE') {
      const hasRect = instanceId !== null && signals.rectInstanceIds.has(instanceId);
      const hasReviewBack =
        instanceId !== null && signals.reviewedInstanceIds.has(instanceId);
      return hasRect || hasReviewBack ? 'REVISION' : 'PENDING';
    }

    // 其他节点（编制前的审核/测评阶段）—— compiled_by 非空说明以前走过报告阶段，
    // 但被驳回到更早节点；这种项目也算"待修改"语义（编制人仍需关注）。
    if (
      instanceId !== null &&
      (signals.rectInstanceIds.has(instanceId) ||
        signals.reviewedInstanceIds.has(instanceId))
    ) {
      return 'REVISION';
    }

    // 兜底：若 compiled_by 非空且节点未知，按待编制处理。
    // 实际不应走到这里；保留以防 wf_instance 意外缺失。
    return 'PENDING';
  }

  // -----------------------------------------------------------------------
  // Report detail
  // -----------------------------------------------------------------------
  async getReportDetail(projectRegisterId: number) {
    const instance = await this.db
      .select()
      .from(wfInstance)
      .where(
        and(
          eq(wfInstance.bizType, 'PROJECT_REGISTER'),
          eq(wfInstance.bizId, projectRegisterId),
        ),
      )
      .limit(1);

    if (!instance[0]) throw new NotFoundException('Workflow instance not found');

    // Get project info with compiler
    const project = await this.db
      .select({
        applicationName: projectRegister.applicationName,
        compiledBy: projectRegister.compiledBy,
        compiledAt: projectRegister.compiledAt,
      })
      .from(projectRegister)
      .where(eq(projectRegister.id, projectRegisterId))
      .limit(1);

    let compilerName: string | null = null;
    if (project[0]?.compiledBy) {
      const users = await this.db
        .select({ displayName: userAccount.displayName })
        .from(userAccount)
        .where(eq(userAccount.id, project[0].compiledBy))
        .limit(1);
      compilerName = users[0]?.displayName ?? null;
    }

    // Get FINAL_REVIEW tasks
    const reviewTasks = await this.db
      .select({
        id: wfTask.id,
        assigneeId: wfTask.assigneeId,
        status: wfTask.status,
        result: wfTask.result,
        remark: wfTask.remark,
        completedAt: wfTask.completedAt,
        assigneeName: userAccount.displayName,
      })
      .from(wfTask)
      .leftJoin(userAccount, eq(wfTask.assigneeId, userAccount.id))
      .where(
        and(
          eq(wfTask.instanceId, instance[0].id),
          eq(wfTask.nodeKey, 'FINAL_REVIEW'),
        ),
      );

    return {
      instanceId: instance[0].id,
      currentNode: instance[0].currentNode,
      status: instance[0].status,
      compiledBy: project[0]?.compiledBy ?? null,
      compiledAt: project[0]?.compiledAt ?? null,
      compilerName,
      reviewTasks,
    };
  }

  // -----------------------------------------------------------------------
  // Submit report (any report_writer at REPORT_COMPILE node)
  // Auto-fills compiled_by + compiled_at with the actual submitter.
  // 按设计，同一项目始终同一编制人（REPORT_ASSIGN 只分配一次，复核回退也保留 assignee），
  // 故 compiled_by 覆盖前后为同一值。
  // -----------------------------------------------------------------------
  async submitReport(dto: SubmitReportDto, userId: number) {
    const instance = await this.db
      .select()
      .from(wfInstance)
      .where(
        and(
          eq(wfInstance.bizType, 'PROJECT_REGISTER'),
          eq(wfInstance.bizId, dto.projectRegisterId),
          eq(wfInstance.status, 'RUNNING'),
        ),
      )
      .limit(1);

    if (!instance[0] || instance[0].currentNode !== 'REPORT_COMPILE') {
      throw new BadRequestException('当前流程不在报告编制节点');
    }

    // Auto-fill compiled_by and compiled_at
    await this.db
      .update(projectRegister)
      .set({
        compiledBy: userId,
        compiledAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(projectRegister.id, dto.projectRegisterId));

    const tasks = await this.db
      .select()
      .from(wfTask)
      .where(
        and(
          eq(wfTask.instanceId, instance[0].id),
          eq(wfTask.nodeKey, 'REPORT_COMPILE'),
          eq(wfTask.status, 'PENDING'),
        ),
      )
      .limit(1);

    if (tasks[0]) {
      await this.workflowService.signal(
        instance[0].id,
        tasks[0].id,
        'SUBMIT',
        dto.remark ?? '提交报告编制',
        userId,
      );
    }

    return { success: true };
  }
}

// Re-export status values for convenience (前端可 import 做 select 选项)
export { REPORT_STATUS_VALUES, type ReportStatus };
