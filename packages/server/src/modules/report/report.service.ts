import {
  Inject,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { eq, and, or, desc, inArray, isNull } from 'drizzle-orm';
import { DRIZZLE, DrizzleDB } from '../../database/database.module';
import { projectRegister } from '../../database/schema/business';
import { userAccount } from '../../database/schema/user';
import { userRole } from '../../database/schema/iam';
import { wfInstance, wfTask, wfActionLog } from '../../database/schema/workflow';
import { WorkflowService } from '../workflow/workflow.service';
import { SubmitReportDto, QueryReportDto } from './dto/report.dto';

@Injectable()
export class ReportService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly workflowService: WorkflowService,
  ) {}

  // -----------------------------------------------------------------------
  // List projects at report stage (REPORT_COMPILE, FINAL_REVIEW, or past)
  // Visible to all report_writer role users + super_admin
  // -----------------------------------------------------------------------
  async findPage(query: QueryReportDto, userId: number) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    // Check if super_admin
    const adminCheck = await this.db
      .select()
      .from(userRole)
      .where(and(eq(userRole.userId, userId), eq(userRole.roleCode, 'super_admin')))
      .limit(1);
    const isSuperAdmin = adminCheck.length > 0;

    // Check if report_writer or dept_manager
    const userRoles = await this.db
      .select({ roleCode: userRole.roleCode })
      .from(userRole)
      .where(eq(userRole.userId, userId));
    const roleCodes = userRoles.map((r) => r.roleCode);

    const isReportWriter = roleCodes.includes('report_writer');
    const isDeptManager = roleCodes.includes('dept_manager');

    if (!isSuperAdmin && !isReportWriter && !isDeptManager) {
      return { list: [], total: 0, page, pageSize };
    }

    // Find projects at report-related nodes or beyond
    const reportNodes = ['REPORT_COMPILE', 'FINAL_REVIEW', 'MATERIAL_ARCHIVE'];
    const instances = await this.db
      .select({ bizId: wfInstance.bizId, currentNode: wfInstance.currentNode })
      .from(wfInstance)
      .where(
        and(
          eq(wfInstance.bizType, 'PROJECT_REGISTER'),
          eq(wfInstance.status, 'RUNNING'),
        ),
      );

    const reportInstances = instances
      .filter((i) => reportNodes.includes(i.currentNode));
    let reportBizIds = reportInstances.map((i) => i.bizId);
    const bizNodeMap = new Map(reportInstances.map((i) => [i.bizId, i.currentNode]));

    if (reportBizIds.length === 0) {
      return { list: [], total: 0, page, pageSize };
    }

    // Visibility filter: report_writer only sees projects where they are the compiler
    // or where compiledBy is NULL (not yet assigned)
    // dept_manager and super_admin see all
    const visibilityConditions = [inArray(projectRegister.id, reportBizIds)];
    if (isReportWriter && !isSuperAdmin && !isDeptManager) {
      visibilityConditions.push(
        or(
          eq(projectRegister.compiledBy, userId),
          isNull(projectRegister.compiledBy),
        )!,
      );
    }

    const rows = await this.db
      .select({
        id: projectRegister.id,
        applicationName: projectRegister.applicationName,
        contractYear: projectRegister.contractYear,
        status: projectRegister.status,
        compiledBy: projectRegister.compiledBy,
        compiledAt: projectRegister.compiledAt,
        createdAt: projectRegister.createdAt,
      })
      .from(projectRegister)
      .where(and(...visibilityConditions))
      .orderBy(desc(projectRegister.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    // Enrich with compiler name
    const enriched = await Promise.all(
      rows.map(async (row) => {
        let compilerName: string | null = null;
        if (row.compiledBy) {
          const users = await this.db
            .select({ displayName: userAccount.displayName })
            .from(userAccount)
            .where(eq(userAccount.id, row.compiledBy))
            .limit(1);
          compilerName = users[0]?.displayName ?? null;
        }
        // Get task IDs for navigation
        let currentTaskId: number | null = null; // editable task (REPORT_COMPILE only)
        let viewTaskId: number | null = null;    // any current task (for readonly view)
        const currentNode = bizNodeMap.get(row.id) || null;
        if (currentNode) {
          // Editable: REPORT_COMPILE task for this user
          if (currentNode === 'REPORT_COMPILE') {
            const compileTasks = await this.db
              .select({ id: wfTask.id })
              .from(wfTask)
              .innerJoin(wfInstance, eq(wfTask.instanceId, wfInstance.id))
              .where(
                and(
                  eq(wfInstance.bizType, 'PROJECT_REGISTER'),
                  eq(wfInstance.bizId, row.id!),
                  eq(wfTask.nodeKey, 'REPORT_COMPILE'),
                  or(
                    eq(wfTask.status, 'PENDING'),
                    eq(wfTask.status, 'PENDING_RECTIFICATION'),
                  ),
                ),
              )
              .limit(1);
            currentTaskId = compileTasks[0]?.id ?? null;
          }
          // View: any current node task (for readonly detail page)
          const anyTasks = await this.db
            .select({ id: wfTask.id })
            .from(wfTask)
            .innerJoin(wfInstance, eq(wfTask.instanceId, wfInstance.id))
            .where(
              and(
                eq(wfInstance.bizType, 'PROJECT_REGISTER'),
                eq(wfInstance.bizId, row.id!),
                eq(wfTask.nodeKey, currentNode),
                or(
                  eq(wfTask.status, 'PENDING'),
                  eq(wfTask.status, 'PENDING_RECTIFICATION'),
                ),
              ),
            )
            .limit(1);
          viewTaskId = anyTasks[0]?.id ?? null;
        }
        // Check if report needs revision (from FINAL_REVIEW review or REPORT_COMPILE PENDING_RECTIFICATION)
        let needsRevision = false;
        if (currentNode === 'REPORT_COMPILE') {
          // Check for REVIEW_TO_COMPILE action (from FINAL_REVIEW review)
          const revisionLogs = await this.db
            .select({ id: wfActionLog.id })
            .from(wfActionLog)
            .innerJoin(wfInstance, eq(wfActionLog.instanceId, wfInstance.id))
            .where(
              and(
                eq(wfInstance.bizType, 'PROJECT_REGISTER'),
                eq(wfInstance.bizId, row.id!),
                eq(wfActionLog.action, 'REVIEW_TO_COMPILE'),
              ),
            )
            .limit(1);
          // Or check for PENDING_RECTIFICATION task (from REPORT_COMPILE review)
          const rectTasks = await this.db
            .select({ id: wfTask.id })
            .from(wfTask)
            .innerJoin(wfInstance, eq(wfTask.instanceId, wfInstance.id))
            .where(
              and(
                eq(wfInstance.bizType, 'PROJECT_REGISTER'),
                eq(wfInstance.bizId, row.id!),
                eq(wfTask.nodeKey, 'REPORT_COMPILE'),
                eq(wfTask.status, 'PENDING_RECTIFICATION'),
              ),
            )
            .limit(1);
          needsRevision = revisionLogs.length > 0 || rectTasks.length > 0;
        }
        return { ...row, compilerName, currentNode, currentTaskId, viewTaskId, needsRevision };
      }),
    );

    // Count visible projects for pagination
    const totalRows = await this.db
      .select({ id: projectRegister.id })
      .from(projectRegister)
      .where(and(...visibilityConditions));

    return { list: enriched, total: totalRows.length, page, pageSize };
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
  // Auto-fills compiled_by + compiled_at
  // -----------------------------------------------------------------------
  async submitReport(dto: SubmitReportDto, userId: number) {
    // Signal REPORT_COMPILE node
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
