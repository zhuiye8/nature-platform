import {
  Inject,
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { eq, and, count, desc, inArray, ilike, or, SQL } from 'drizzle-orm';
import { DRIZZLE, DrizzleDB } from '../../database/database.module';
import {
  onSiteAssessment,
  projectMember,
  projectRegister,
  projectSystemItem,
} from '../../database/schema/business';
import { userRole } from '../../database/schema/iam';
import { userAccount } from '../../database/schema/user';
import { wfInstance, wfTask } from '../../database/schema/workflow';
import { WorkflowService } from '../workflow/workflow.service';
import { SubmitAssessmentDto, QueryAssessmentDto } from './dto/assessment.dto';

@Injectable()
export class AssessmentService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly workflowService: WorkflowService,
  ) {}

  // -----------------------------------------------------------------------
  // Paginated list — show system-level items for projects the user participates in
  // -----------------------------------------------------------------------
  async findPage(query: QueryAssessmentDto, userId: number) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    // Check if super_admin
    const adminCheck = await this.db
      .select()
      .from(userRole)
      .where(and(eq(userRole.userId, userId), eq(userRole.roleCode, 'super_admin')))
      .limit(1);
    const isSuperAdmin = adminCheck.length > 0;

    // Get project IDs the user is a member of (any role_type)
    let projectIds: number[] = [];
    if (!isSuperAdmin) {
      const myProjects = await this.db
        .select({ projectId: projectMember.projectId })
        .from(projectMember)
        .where(
          and(
            eq(projectMember.userId, userId),
            eq(projectMember.status, 'ACTIVE'),
          ),
        );
      projectIds = myProjects.map((p) => p.projectId);
      if (projectIds.length === 0) {
        return { list: [], total: 0, page, pageSize };
      }
    }

    // Build WHERE conditions — now based on projectRegister (one row per project)
    const conditions: SQL[] = [eq(projectRegister.deleted, false)];
    if (!isSuperAdmin) {
      conditions.push(inArray(projectRegister.id, projectIds));
    }
    if (query.keyword) {
      conditions.push(
        ilike(projectRegister.applicationName, `%${query.keyword}%`),
      );
    }
    if (query.contractYear) {
      conditions.push(eq(projectRegister.contractYear, Number(query.contractYear)));
    }

    // Only show projects that have reached ON_SITE_ASSESSMENT or beyond
    const assessmentNodes = [
      'ON_SITE_ASSESSMENT', 'TECH_REVIEW', 'CONTENT_REVIEW',
      'REPORT_ASSIGN', 'REPORT_COMPILE', 'FINAL_REVIEW', 'MATERIAL_ARCHIVE',
    ];
    conditions.push(
      or(
        ...assessmentNodes.map((n) => eq(wfInstance.currentNode, n)),
        eq(wfInstance.status, 'COMPLETED'),
      )!,
    );

    // Assessment status filter
    if (query.assessmentStatus) {
      const statusNodeMap: Record<string, string[]> = {
        ASSESSING: ['ON_SITE_ASSESSMENT'],
        REVIEWING: ['TECH_REVIEW', 'CONTENT_REVIEW'],
        COMPILING: ['REPORT_COMPILE'],
        FINAL_REVIEWING: ['FINAL_REVIEW'],
        ARCHIVING: ['MATERIAL_ARCHIVE'],
      };
      const nodes = statusNodeMap[query.assessmentStatus];
      if (nodes) {
        conditions.push(
          or(...nodes.map((n) => eq(wfInstance.currentNode, n)))!,
        );
      }
    }

    const fullWhere = and(...conditions);

    // Get PM display name via subquery alias
    const pmAlias = this.db
      .select({
        projectId: projectMember.projectId,
        pmName: userAccount.displayName,
      })
      .from(projectMember)
      .innerJoin(userAccount, eq(projectMember.userId, userAccount.id))
      .where(
        and(eq(projectMember.roleType, 'PM'), eq(projectMember.status, 'ACTIVE')),
      )
      .as('pm');

    const [totalResult, rows] = await Promise.all([
      this.db
        .select({ total: count() })
        .from(projectRegister)
        .leftJoin(wfInstance, and(
          eq(wfInstance.bizType, 'PROJECT_REGISTER'),
          eq(wfInstance.bizId, projectRegister.id),
        ))
        .where(fullWhere),
      this.db
        .select({
          id: projectRegister.id,
          applicationName: projectRegister.applicationName,
          contractYear: projectRegister.contractYear,
          projectManagerName: pmAlias.pmName,
          currentNode: wfInstance.currentNode,
          roundNo: wfInstance.roundNo,
          wfStatus: wfInstance.status,
          createdAt: projectRegister.createdAt,
        })
        .from(projectRegister)
        .leftJoin(pmAlias, eq(projectRegister.id, pmAlias.projectId))
        .leftJoin(wfInstance, and(
          eq(wfInstance.bizType, 'PROJECT_REGISTER'),
          eq(wfInstance.bizId, projectRegister.id),
        ))
        .where(fullWhere)
        .orderBy(desc(projectRegister.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
    ]);

    // Enrich with PENDING_RECTIFICATION flag
    const enriched = await Promise.all(
      rows.map(async (row) => {
        if (!row.currentNode) return { ...row, pendingRectification: false };
        const rectTasks = await this.db
          .select({ id: wfTask.id })
          .from(wfTask)
          .innerJoin(wfInstance, eq(wfTask.instanceId, wfInstance.id))
          .where(
            and(
              eq(wfInstance.bizType, 'PROJECT_REGISTER'),
              eq(wfInstance.bizId, row.id!),
              eq(wfTask.status, 'PENDING_RECTIFICATION'),
            ),
          )
          .limit(1);
        return { ...row, pendingRectification: rectTasks.length > 0 };
      }),
    );

    return { list: enriched, total: totalResult[0]?.total ?? 0, page, pageSize };
  }

  // -----------------------------------------------------------------------
  // Project detail for assessment page
  // -----------------------------------------------------------------------
  async getProjectDetail(projectRegisterId: number) {
    // Project info
    const projects = await this.db
      .select()
      .from(projectRegister)
      .where(eq(projectRegister.id, projectRegisterId))
      .limit(1);

    if (projects.length === 0) {
      throw new NotFoundException('Project not found');
    }
    const project = projects[0];

    // Customer name via contract
    const { contract, customer } = await import('../../database/schema/business');
    let customerName = '';
    if (project.contractId) {
      const contracts = await this.db
        .select({ customerName: customer.fullName })
        .from(contract)
        .innerJoin(customer, eq(contract.customerId, customer.id))
        .where(eq(contract.id, project.contractId))
        .limit(1);
      customerName = contracts[0]?.customerName || '';
    }

    // Members
    const members = await this.db
      .select({
        userId: projectMember.userId,
        roleType: projectMember.roleType,
        displayName: userAccount.displayName,
      })
      .from(projectMember)
      .innerJoin(userAccount, eq(projectMember.userId, userAccount.id))
      .where(
        and(
          eq(projectMember.projectId, projectRegisterId),
          eq(projectMember.status, 'ACTIVE'),
        ),
      );

    // System items
    const systemItems = await this.db
      .select()
      .from(projectSystemItem)
      .where(
        and(
          eq(projectSystemItem.projectRegisterId, projectRegisterId),
          eq(projectSystemItem.deleted, false),
        ),
      )
      .orderBy(projectSystemItem.sortOrder);

    return {
      id: project.id,
      applicationName: project.applicationName,
      contractYear: project.contractYear,
      customerName,
      status: project.status,
      members,
      systemItems,
    };
  }

  // -----------------------------------------------------------------------
  // Progress — member submission status
  // -----------------------------------------------------------------------
  async getProgress(projectRegisterId: number) {
    const members = await this.db
      .select({
        userId: projectMember.userId,
        roleType: projectMember.roleType,
        displayName: userAccount.displayName,
      })
      .from(projectMember)
      .innerJoin(userAccount, eq(projectMember.userId, userAccount.id))
      .where(
        and(
          eq(projectMember.projectId, projectRegisterId),
          eq(projectMember.status, 'ACTIVE'),
          inArray(projectMember.roleType, ['PM', 'ASSESSOR']),
        ),
      );

    // Check who has submitted
    const submissions = await this.db
      .select({ createdBy: onSiteAssessment.createdBy })
      .from(onSiteAssessment)
      .where(eq(onSiteAssessment.projectRegisterId, projectRegisterId));

    const submittedUserIds = new Set(submissions.map((s) => s.createdBy));

    const memberStatus = members.map((m) => ({
      userId: m.userId,
      displayName: m.displayName,
      roleType: m.roleType,
      submitted: submittedUserIds.has(m.userId),
    }));

    return {
      total: members.length,
      completed: memberStatus.filter((m) => m.submitted).length,
      members: memberStatus,
    };
  }

  // -----------------------------------------------------------------------
  // Submit my part
  // -----------------------------------------------------------------------
  async submitMyPart(dto: SubmitAssessmentDto, userId: number) {
    // Check user is a member
    const membership = await this.db
      .select()
      .from(projectMember)
      .where(
        and(
          eq(projectMember.projectId, dto.projectRegisterId),
          eq(projectMember.userId, userId),
          eq(projectMember.status, 'ACTIVE'),
          inArray(projectMember.roleType, ['PM', 'ASSESSOR']),
        ),
      )
      .limit(1);

    if (!membership[0]) {
      throw new ForbiddenException('You are not a member of this project');
    }

    // Upsert: check if already submitted
    const existing = await this.db
      .select()
      .from(onSiteAssessment)
      .where(
        and(
          eq(onSiteAssessment.projectRegisterId, dto.projectRegisterId),
          eq(onSiteAssessment.createdBy, userId),
        ),
      )
      .limit(1);

    if (existing[0]) {
      // Update
      await this.db
        .update(onSiteAssessment)
        .set({
          assessmentDetail: dto.assessmentDetail ?? null,
          assessmentRemark: dto.assessmentRemark ?? null,
          updatedBy: userId,
          updatedAt: new Date(),
        })
        .where(eq(onSiteAssessment.id, existing[0].id));
      return { id: existing[0].id, updated: true };
    } else {
      // Insert
      const result = await this.db
        .insert(onSiteAssessment)
        .values({
          projectRegisterId: dto.projectRegisterId,
          assessmentDetail: dto.assessmentDetail ?? null,
          assessmentRemark: dto.assessmentRemark ?? null,
          status: 'SUBMITTED',
          createdBy: userId,
          updatedBy: userId,
        })
        .returning();
      return { id: result[0].id, updated: false };
    }
  }

  // -----------------------------------------------------------------------
  // Initiate quality review — PM only
  // -----------------------------------------------------------------------
  async initiateQualityReview(projectRegisterId: number, userId: number) {
    // Verify PM
    const pm = await this.db
      .select()
      .from(projectMember)
      .where(
        and(
          eq(projectMember.projectId, projectRegisterId),
          eq(projectMember.userId, userId),
          eq(projectMember.roleType, 'PM'),
          eq(projectMember.status, 'ACTIVE'),
        ),
      )
      .limit(1);

    if (!pm[0]) {
      throw new ForbiddenException('Only the project manager can initiate quality review');
    }

    // Check if assessment result files have been uploaded
    const { assessmentFile } = await import('../../database/schema/assessment-file');
    const { isNull } = await import('drizzle-orm');
    const resultFiles = await this.db
      .select({ id: assessmentFile.id })
      .from(assessmentFile)
      .where(
        and(
          eq(assessmentFile.projectRegisterId, projectRegisterId),
          eq(assessmentFile.filePool, 'ASSESSMENT_RESULT'),
          isNull(assessmentFile.deletedAt),
        ),
      )
      .limit(1);

    if (resultFiles.length === 0) {
      throw new BadRequestException('请先上传测评成果后再发起质量审核');
    }

    // Find the workflow instance and the ON_SITE_ASSESSMENT task for this PM
    const instance = await this.db
      .select()
      .from(wfInstance)
      .where(
        and(
          eq(wfInstance.bizType, 'PROJECT_REGISTER'),
          eq(wfInstance.bizId, projectRegisterId),
          eq(wfInstance.status, 'RUNNING'),
        ),
      )
      .limit(1);

    if (!instance[0]) {
      throw new BadRequestException('No running workflow instance found');
    }

    if (instance[0].currentNode !== 'ON_SITE_ASSESSMENT') {
      throw new BadRequestException('Workflow is not at ON_SITE_ASSESSMENT node');
    }

    // Check if skip_to_final is set — if not from ADJUST, clear it
    const vars = (instance[0].variables as Record<string, any>) || {};
    if (!vars.skip_to_final) {
      // Normal re-initiation after tech/content reject — ensure skip is cleared
      await this.db
        .update(wfInstance)
        .set({ variables: { ...vars, skip_to_final: false }, updatedAt: new Date() })
        .where(eq(wfInstance.id, instance[0].id));
    }
    // If skip_to_final is true (from ADJUST), leave it — TransitionResolver will handle

    // Signal all pending tasks for this node as SUBMITTED
    const pendingTasks = await this.db
      .select()
      .from(wfTask)
      .where(
        and(
          eq(wfTask.instanceId, instance[0].id),
          eq(wfTask.nodeKey, 'ON_SITE_ASSESSMENT'),
          eq(wfTask.status, 'PENDING'),
        ),
      );

    for (const task of pendingTasks) {
      await this.workflowService.signal(
        instance[0].id,
        task.id,
        'SUBMIT',
        '现场测评完成，发起质量审核',
        task.assigneeId ?? userId,
      );
    }

    return { success: true, message: 'Quality review initiated' };
  }

  // -----------------------------------------------------------------------
  // Resubmit assessment result — PM resets PENDING_RECTIFICATION tasks
  // -----------------------------------------------------------------------
  async resubmitAssessmentResult(projectRegisterId: number, userId: number) {
    // Verify PM
    const pm = await this.db
      .select()
      .from(projectMember)
      .where(
        and(
          eq(projectMember.projectId, projectRegisterId),
          eq(projectMember.userId, userId),
          eq(projectMember.roleType, 'PM'),
          eq(projectMember.status, 'ACTIVE'),
        ),
      )
      .limit(1);

    if (!pm[0]) {
      throw new ForbiddenException('Only the project manager can resubmit');
    }

    // Find running workflow instance
    const instance = await this.db
      .select()
      .from(wfInstance)
      .where(
        and(
          eq(wfInstance.bizType, 'PROJECT_REGISTER'),
          eq(wfInstance.bizId, projectRegisterId),
          eq(wfInstance.status, 'RUNNING'),
        ),
      )
      .limit(1);

    if (!instance[0]) {
      throw new BadRequestException('No running workflow instance found');
    }

    // Must be at a review node
    const reviewNodes = ['TECH_REVIEW', 'CONTENT_REVIEW', 'REPORT_ASSIGN', 'REPORT_COMPILE', 'FINAL_REVIEW'];
    if (!reviewNodes.includes(instance[0].currentNode)) {
      throw new BadRequestException(
        `Workflow is not at a review node (current: ${instance[0].currentNode})`,
      );
    }

    // Delegate to workflow service
    return this.workflowService.resubmitFromRectification(
      instance[0].id,
      userId,
    );
  }

  // -----------------------------------------------------------------------
  // Quality review status — tech review + content review (3 slots)
  // -----------------------------------------------------------------------
  async getReviewStatus(projectRegisterId: number) {
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

    if (!instance[0]) return null;

    // Get TECH_REVIEW tasks
    const techTasks = await this.db
      .select({
        id: wfTask.id,
        nodeKey: wfTask.nodeKey,
        slotKey: wfTask.slotKey,
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
          eq(wfTask.nodeKey, 'TECH_REVIEW'),
        ),
      );

    // Get CONTENT_REVIEW tasks
    const contentTasks = await this.db
      .select({
        id: wfTask.id,
        nodeKey: wfTask.nodeKey,
        slotKey: wfTask.slotKey,
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
          eq(wfTask.nodeKey, 'CONTENT_REVIEW'),
        ),
      );

    // Get REPORT_ASSIGN tasks
    const assignTasks = await this.db
      .select({
        id: wfTask.id,
        nodeKey: wfTask.nodeKey,
        slotKey: wfTask.slotKey,
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
          eq(wfTask.nodeKey, 'REPORT_ASSIGN'),
        ),
      );

    // Get REPORT_COMPILE tasks
    const compileTasks = await this.db
      .select({
        id: wfTask.id,
        nodeKey: wfTask.nodeKey,
        slotKey: wfTask.slotKey,
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
          eq(wfTask.nodeKey, 'REPORT_COMPILE'),
        ),
      );

    // Get FINAL_REVIEW tasks
    const finalTasks = await this.db
      .select({
        id: wfTask.id,
        nodeKey: wfTask.nodeKey,
        slotKey: wfTask.slotKey,
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
      roundNo: instance[0].roundNo,
      techReview: techTasks,
      contentReview: contentTasks,
      reportAssign: assignTasks,
      reportCompile: compileTasks,
      finalReview: finalTasks,
    };
  }
}
