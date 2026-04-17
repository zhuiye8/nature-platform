import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { eq, and, or, ilike, count, desc, inArray, SQL } from 'drizzle-orm';
import { DRIZZLE, DrizzleDB } from '../../database/database.module';
import {
  projectRegister,
  projectSystemItem,
  projectMember,
  contract,
  contractSystemItem,
  customer,
} from '../../database/schema/business';
import { userAccount } from '../../database/schema/user';
import { userRole } from '../../database/schema/iam';
import { fieldChangeLog, fileAttachment } from '../../database/schema/common';
import { wfInstance, wfActionLog, wfTask } from '../../database/schema/workflow';
import {
  CreateProjectDto,
  UpdateProjectDto,
  QueryProjectDto,
  AssignMembersDto,
} from './dto/project.dto';
import { WorkflowService } from '../workflow/workflow.service';

@Injectable()
export class ProjectService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly workflowService: WorkflowService,
  ) {}

  // -----------------------------------------------------------------------
  // Paginated list
  // -----------------------------------------------------------------------
  async findPage(query: QueryProjectDto, currentUserId: number) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    // Check user roles for row-level visibility
    const roles = await this.db
      .select({ roleCode: userRole.roleCode })
      .from(userRole)
      .where(eq(userRole.userId, currentUserId));
    const roleCodes = roles.map((r) => r.roleCode);
    const isSuperAdmin = roleCodes.includes('super_admin');
    const isCommercial = roleCodes.includes('commercial');
    const isManager = roleCodes.includes('project_manager') || roleCodes.includes('dept_manager');
    const isDirector = roleCodes.includes('project_director');

    const conditions: SQL[] = [eq(projectRegister.deleted, false)];

    // Row-level: sales only sees own projects; PM/commercial/super_admin/dept_manager/project_director see all
    if (!isSuperAdmin && !isCommercial && !isManager && !isDirector) {
      conditions.push(eq(projectRegister.createdBy, currentUserId));
    }

    if (query.keyword) {
      const pattern = `%${query.keyword}%`;
      conditions.push(ilike(projectRegister.applicationName, pattern));
    }

    if (query.status) {
      conditions.push(eq(projectRegister.status, query.status));
    }

    const whereClause = and(...conditions)!;

    const [totalResult, rows] = await Promise.all([
      this.db
        .select({ total: count() })
        .from(projectRegister)
        .where(whereClause),
      this.db
        .select({
          id: projectRegister.id,
          contractId: projectRegister.contractId,
          contractYear: projectRegister.contractYear,
          applicationNo: projectRegister.applicationNo,
          applicationName: projectRegister.applicationName,
          remark: projectRegister.remark,
          status: projectRegister.status,
          createdBy: projectRegister.createdBy,
          createdAt: projectRegister.createdAt,
          updatedBy: projectRegister.updatedBy,
          updatedAt: projectRegister.updatedAt,
          contractName: contract.contractName,
          salesPersonId: contract.salesPersonId,
          currentNode: wfInstance.currentNode,
          wfStatus: wfInstance.status,
        })
        .from(projectRegister)
        .leftJoin(contract, eq(projectRegister.contractId, contract.id))
        .leftJoin(
          wfInstance,
          and(
            eq(wfInstance.bizType, 'PROJECT_REGISTER'),
            eq(wfInstance.bizId, projectRegister.id),
          ),
        )
        .where(whereClause)
        .orderBy(desc(projectRegister.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
    ]);

    const POOL_LABELS: Record<string, string> = {
      project_director: '项目主管',
      dept_manager: '部门经理',
    };

    const rowIds = rows.map((r) => r.id!);

    // Batch: sales person names
    const salesIds = [...new Set(rows.map((r) => r.salesPersonId).filter(Boolean))] as number[];
    const userNameMap = new Map<number, string>();
    if (salesIds.length > 0) {
      const users = await this.db
        .select({ id: userAccount.id, displayName: userAccount.displayName })
        .from(userAccount)
        .where(inArray(userAccount.id, salesIds));
      for (const u of users) userNameMap.set(u.id, u.displayName);
    }

    // Batch: reject remarks (only for REJECTED rows)
    const rejectedIds = rows.filter((r) => r.status === 'REJECTED').map((r) => r.id!);
    const rejectRemarkMap = new Map<number, string>();
    if (rejectedIds.length > 0) {
      // Get the latest REJECT remark per bizId
      for (const bizId of rejectedIds) {
        const logs = await this.db
          .select({ remark: wfActionLog.remark })
          .from(wfActionLog)
          .innerJoin(wfInstance, eq(wfActionLog.instanceId, wfInstance.id))
          .where(
            and(
              eq(wfInstance.bizType, 'PROJECT_REGISTER'),
              eq(wfInstance.bizId, bizId),
              eq(wfActionLog.action, 'REJECT'),
            ),
          )
          .orderBy(desc(wfActionLog.createdAt))
          .limit(1);
        if (logs[0]?.remark) rejectRemarkMap.set(bizId, logs[0].remark);
      }
    }

    // Batch: system item counts
    const siCountMap = new Map<number, number>();
    if (rowIds.length > 0) {
      const siCounts = await this.db
        .select({ projectRegisterId: projectSystemItem.projectRegisterId, total: count() })
        .from(projectSystemItem)
        .where(and(inArray(projectSystemItem.projectRegisterId, rowIds), eq(projectSystemItem.deleted, false)))
        .groupBy(projectSystemItem.projectRegisterId);
      for (const s of siCounts) siCountMap.set(s.projectRegisterId, s.total);
    }

    // Batch: reviewer labels (only for rows at PROJECT_REVIEW)
    const reviewRowIds = rows
      .filter((r) => r.status === 'SUBMITTED' && r.currentNode === 'PROJECT_REVIEW')
      .map((r) => r.id!);
    const reviewerLabelMap = new Map<number, string>();
    if (reviewRowIds.length > 0) {
      const instRows = await this.db
        .select({ bizId: wfInstance.bizId, variables: wfInstance.variables, instanceId: wfInstance.id })
        .from(wfInstance)
        .where(
          and(
            eq(wfInstance.bizType, 'PROJECT_REGISTER'),
            inArray(wfInstance.bizId, reviewRowIds),
          ),
        );
      // Collect instance IDs needing single-assignee name lookup
      const needNameLookup: { bizId: number; instanceId: number }[] = [];
      for (const inst of instRows) {
        const vars = (inst.variables as Record<string, any> | null) ?? {};
        if (vars.isPoolReview && POOL_LABELS[vars.reviewerRoleCode]) {
          reviewerLabelMap.set(inst.bizId, POOL_LABELS[vars.reviewerRoleCode]);
        } else {
          needNameLookup.push({ bizId: inst.bizId, instanceId: inst.instanceId });
        }
      }
      if (needNameLookup.length > 0) {
        const reviewers = await this.db
          .select({ instanceId: wfTask.instanceId, name: userAccount.displayName })
          .from(wfTask)
          .innerJoin(userAccount, eq(wfTask.assigneeId, userAccount.id))
          .where(
            and(
              inArray(wfTask.instanceId, needNameLookup.map((n) => n.instanceId)),
              eq(wfTask.nodeKey, 'PROJECT_REVIEW'),
              eq(wfTask.status, 'PENDING'),
            ),
          );
        const instIdToName = new Map(reviewers.map((r) => [r.instanceId, r.name]));
        for (const nl of needNameLookup) {
          const name = instIdToName.get(nl.instanceId);
          if (name) reviewerLabelMap.set(nl.bizId, name);
        }
      }
    }

    const enriched = rows.map((row) => ({
      ...row,
      salesPersonName: (row.salesPersonId && userNameMap.get(row.salesPersonId)) ?? null,
      rejectRemark: rejectRemarkMap.get(row.id!) ?? null,
      systemItemCount: siCountMap.get(row.id!) ?? 0,
      currentReviewerLabel: reviewerLabelMap.get(row.id!) ?? null,
    }));

    return {
      list: enriched,
      total: totalResult[0]?.total ?? 0,
      page,
      pageSize,
    };
  }

  // -----------------------------------------------------------------------
  // Single record with system items + members
  // -----------------------------------------------------------------------
  async findById(id: number) {
    const rows = await this.db
      .select({
        id: projectRegister.id,
        contractId: projectRegister.contractId,
        contractYear: projectRegister.contractYear,
        applicationNo: projectRegister.applicationNo,
        applicationName: projectRegister.applicationName,
        remark: projectRegister.remark,
        status: projectRegister.status,
        createdBy: projectRegister.createdBy,
        createdAt: projectRegister.createdAt,
        updatedBy: projectRegister.updatedBy,
        updatedAt: projectRegister.updatedAt,
        contractName: contract.contractName,
        contractNo: contract.contractNo,
        serviceContent: contract.serviceContent,
        contractType: contract.contractType,
        customerName: customer.fullName,
        customerUscc: customer.uscc,
        customerId: contract.customerId,
        customerContactName: contract.contactName,
        customerContactPhone: contract.contactPhone,
        customerAddress: customer.addressDetail,
        serviceYears: contract.serviceYears,
        paymentAmount: contract.paymentAmount,
        paymentStatus: contract.paymentStatus,
        salesPersonId: contract.salesPersonId,
        partnerName: contract.partnerName,
        contactName: contract.contactName,
        contactPhone: contract.contactPhone,
      })
      .from(projectRegister)
      .leftJoin(contract, eq(projectRegister.contractId, contract.id))
      .leftJoin(customer, eq(contract.customerId, customer.id))
      .where(
        and(eq(projectRegister.id, id), eq(projectRegister.deleted, false)),
      )
      .limit(1);

    if (!rows[0]) {
      throw new NotFoundException(`项目不存在`);
    }

    // Load system items
    const items = await this.db
      .select()
      .from(projectSystemItem)
      .where(
        and(
          eq(projectSystemItem.projectRegisterId, id),
          eq(projectSystemItem.deleted, false),
        ),
      )
      .orderBy(projectSystemItem.sortOrder);

    // Load members with user display name
    const members = await this.db
      .select({
        id: projectMember.id,
        projectId: projectMember.projectId,
        userId: projectMember.userId,
        roleType: projectMember.roleType,
        status: projectMember.status,
        assignedAt: projectMember.assignedAt,
        assignedBy: projectMember.assignedBy,
        displayName: userAccount.displayName,
      })
      .from(projectMember)
      .leftJoin(userAccount, eq(projectMember.userId, userAccount.id))
      .where(
        and(
          eq(projectMember.projectId, id),
          eq(projectMember.status, 'ACTIVE'),
        ),
      );

    // Resolve sales person name
    let salesPersonName: string | null = null;
    if (rows[0].salesPersonId) {
      const users = await this.db
        .select({ displayName: userAccount.displayName })
        .from(userAccount)
        .where(eq(userAccount.id, rows[0].salesPersonId))
        .limit(1);
      salesPersonName = users[0]?.displayName ?? null;
    }

    return {
      ...rows[0],
      salesPersonName,
      systemItems: items,
      members,
    };
  }

  // -----------------------------------------------------------------------
  // Create
  // -----------------------------------------------------------------------
  async create(dto: CreateProjectDto, userId: number) {
    // Verify contract exists and has passed review
    // (archive status is no longer required — both archived and
    // partially-archived contracts may register projects; archive state only
    // decides which reviewer role gets the approval task)
    const contractRow = await this.db
      .select({ reviewStatus: contract.reviewStatus })
      .from(contract)
      .where(
        and(eq(contract.id, dto.contractId), eq(contract.deleted, false)),
      )
      .limit(1);

    if (!contractRow[0]) {
      throw new BadRequestException('合同不存在');
    }
    if (contractRow[0].reviewStatus !== 'APPROVED') {
      throw new BadRequestException('只有已通过审核的合同才能创建项目登记');
    }

    // Note: We intentionally do NOT enforce uniqueness on (contractId +
    // contractYear) anymore. A contract can have multiple project
    // registrations in the same year — typically because not all systems
    // have filing certificates ready at once, so sales registers in batches.
    // System numbers (system_no) keep accumulating across these batches via
    // the project_system_serial table.

    const result = await this.db
      .insert(projectRegister)
      .values({
        contractId: dto.contractId,
        contractYear: dto.contractYear,
        applicationName: dto.applicationName ?? '',
        remark: dto.remark ?? null,
        status: 'DRAFT',
        createdBy: userId,
      })
      .returning();

    const created = result[0];

    // Auto-generate applicationNo and applicationName
    const applicationNo = await this.generateApplicationNo(dto.contractYear);
    const applicationName = dto.applicationName
      ? dto.applicationName
      : await this.buildApplicationName(userId, dto.contractId, new Date());
    await this.db
      .update(projectRegister)
      .set({ applicationNo, applicationName })
      .where(eq(projectRegister.id, created.id));

    // Copy systemItems from contract_system_item as base if none provided
    if (dto.systemItems && dto.systemItems.length > 0) {
      await this.db.insert(projectSystemItem).values(
        dto.systemItems.map((item, index) => ({
          projectRegisterId: created.id,
          systemName: item.systemName,
          filingAgency: item.filingAgency || null,
          securityLevel: item.securityLevel || null,
          isReassessment: item.isReassessment ?? false,
          requiredEntryDate: item.requiredEntryDate || null,
          requiredReportDeliveryDate: item.requiredReportDeliveryDate || null,
          assessedUnitName: item.assessedUnitName || null,
          assessedUnitIndustry: item.assessedUnitIndustry || null,
          assessedUnitContact: item.assessedUnitContact || null,
          assessedUnitMobile: item.assessedUnitMobile || null,
          assessedUnitAddress: item.assessedUnitAddress || null,
          hasFilingCertificate: item.hasFilingCertificate ?? false,
          filingCertificateNo: item.filingCertificateNo || null,
          filingCertificateIssuedAt: item.filingCertificateIssuedAt || null,
          hasFilingForm: item.hasFilingForm ?? false,
          hasClassificationReport: item.hasClassificationReport ?? false,
          sortOrder: item.sortOrder ?? index,
        })),
      );
    }
    // No longer auto-copy contract system items — users add systems
    // one by one via "新增系统" button, which inherits customer info
    // and offers contract system names as dropdown suggestions.

    // Refresh quota flag after bulk system item creation
    await this.refreshSystemQuotaFull(dto.contractId);

    return this.findById(created.id);
  }

  // -----------------------------------------------------------------------
  // Update
  // -----------------------------------------------------------------------
  async update(id: number, dto: UpdateProjectDto, userId: number) {
    const existing = await this.findById(id);

    // Can only edit in DRAFT or REJECTED
    const editableStatuses = ['DRAFT', 'REJECTED'];
    if (!editableStatuses.includes(existing.status)) {
      throw new BadRequestException(
        'Project can only be edited in DRAFT/REJECTED status',
      );
    }

    const { systemItems, ...projectFields } = dto;
    const oldRecord = existing as unknown as Record<string, unknown>;

    const itemMapping = await this.db.transaction(async (tx) => {
      await tx
        .update(projectRegister)
        .set({
          ...(projectFields.contractId !== undefined && {
            contractId: projectFields.contractId,
          }),
          ...(projectFields.contractYear !== undefined && {
            contractYear: projectFields.contractYear,
          }),
          ...(projectFields.applicationName !== undefined && {
            applicationName: projectFields.applicationName,
          }),
          ...(projectFields.remark !== undefined && {
            remark: projectFields.remark,
          }),
          updatedBy: userId,
          updatedAt: new Date(),
        })
        .where(eq(projectRegister.id, id));

      // Upsert system items if provided
      const mapping: { clientKey: string; id: number }[] = [];
      if (systemItems !== undefined) {
        const existingItems = await tx
          .select({ id: projectSystemItem.id })
          .from(projectSystemItem)
          .where(
            and(
              eq(projectSystemItem.projectRegisterId, id),
              eq(projectSystemItem.deleted, false),
            ),
          );
        const existingIds = new Set(existingItems.map((e) => e.id));
        const submittedIds = new Set(
          systemItems.filter((i) => i.id).map((i) => i.id!),
        );

        // Soft-delete items that were removed + their file attachments
        for (const eid of existingIds) {
          if (!submittedIds.has(eid)) {
            await tx
              .update(projectSystemItem)
              .set({ deleted: true })
              .where(eq(projectSystemItem.id, eid));
            await tx
              .update(fileAttachment)
              .set({ deleted: true, deletedAt: new Date() })
              .where(
                and(
                  eq(fileAttachment.bizType, 'PROJECT_SYSTEM_ITEM'),
                  eq(fileAttachment.bizId, eid),
                ),
              );
          }
        }

        // Upsert each item
        for (let index = 0; index < systemItems.length; index++) {
          const item = systemItems[index];
          const itemData = {
            systemName: item.systemName,
            filingAgency: item.filingAgency || null,
            securityLevel: item.securityLevel || null,
            isReassessment: item.isReassessment ?? false,
            requiredEntryDate: item.requiredEntryDate || null,
            requiredReportDeliveryDate:
              item.requiredReportDeliveryDate || null,
            assessedUnitName: item.assessedUnitName || null,
            assessedUnitIndustry: item.assessedUnitIndustry || null,
            assessedUnitContact: item.assessedUnitContact || null,
            assessedUnitMobile: item.assessedUnitMobile || null,
            assessedUnitAddress: item.assessedUnitAddress || null,
            hasFilingCertificate: item.hasFilingCertificate ?? false,
            filingCertificateNo: item.filingCertificateNo || null,
            filingCertificateIssuedAt:
              item.filingCertificateIssuedAt || null,
            hasFilingForm: item.hasFilingForm ?? false,
            hasClassificationReport: item.hasClassificationReport ?? false,
            sortOrder: item.sortOrder ?? index,
          };

          if (item.id && existingIds.has(item.id)) {
            await tx
              .update(projectSystemItem)
              .set({ ...itemData, updatedAt: new Date() })
              .where(eq(projectSystemItem.id, item.id));
            mapping.push({
              clientKey: item.clientKey || String(item.id),
              id: item.id,
            });
          } else {
            const inserted = await tx
              .insert(projectSystemItem)
              .values({ projectRegisterId: id, ...itemData })
              .returning({ id: projectSystemItem.id });
            mapping.push({
              clientKey: item.clientKey || `new_${index}`,
              id: inserted[0].id,
            });
          }
        }
      }

      // Regenerate applicationName based on current data
      const contractId = dto.contractId ?? existing.contractId!;
      const regeneratedName = await this.buildApplicationName(
        existing.createdBy!,
        contractId,
        existing.createdAt ? new Date(existing.createdAt) : new Date(),
      );
      await tx
        .update(projectRegister)
        .set({ applicationName: regeneratedName, updatedBy: userId, updatedAt: new Date() })
        .where(eq(projectRegister.id, id));

      return mapping;
    });

    // Post-transaction: refresh quota + audit trail (non-critical, OK outside tx)
    const contractIdForQuota = dto.contractId ?? existing.contractId!;
    await this.refreshSystemQuotaFull(contractIdForQuota);
    await this.logFieldChanges(
      'project_register',
      id,
      oldRecord,
      projectFields as unknown as Record<string, unknown>,
      userId,
    );

    const result = await this.findById(id);
    return { ...result, itemMapping };
  }

  // -----------------------------------------------------------------------
  // Soft-delete (creator only, DRAFT only)
  // -----------------------------------------------------------------------
  async remove(id: number, userId: number) {
    const existing = await this.findById(id);

    if (existing.createdBy !== userId) {
      throw new ForbiddenException(
        '只有创建人可以删除此项目',
      );
    }

    if (existing.status !== 'DRAFT') {
      throw new BadRequestException('Only DRAFT projects can be deleted');
    }

    await this.db
      .update(projectRegister)
      .set({
        deleted: true,
        deletedAt: new Date(),
      })
      .where(eq(projectRegister.id, id));

    // Soft delete system items
    await this.db
      .update(projectSystemItem)
      .set({ deleted: true })
      .where(eq(projectSystemItem.projectRegisterId, id));

    // Refresh quota flag (re-opens contract for new registrations)
    await this.refreshSystemQuotaFull(existing.contractId!);
  }

  // -----------------------------------------------------------------------
  // Submit for review
  // -----------------------------------------------------------------------
  async submit(id: number, userId: number) {
    const existing = await this.findById(id);

    const submittableStatuses = ['DRAFT', 'REJECTED'];
    if (!submittableStatuses.includes(existing.status)) {
      throw new BadRequestException(
        'Project can only be submitted from DRAFT or REJECTED status',
      );
    }

    // Decide reviewer role based on contract's CURRENT archive status.
    // This is re-evaluated at every submission (first + resubmit) so that a
    // contract that got fully archived between rejection and resubmission
    // will route the next approval to project directors instead of dept managers.
    const contractRow = await this.db
      .select({ archiveStatus: contract.archiveStatus })
      .from(contract)
      .where(eq(contract.id, existing.contractId))
      .limit(1);

    const reviewerRoleCode =
      contractRow[0]?.archiveStatus === 'ARCHIVED'
        ? 'project_director'
        : 'dept_manager';
    const isPoolReview = true; // both modes are pool; fallback to single-assign
    // happens inside ReviewHandler.onEnter when the target role has no users.

    await this.db
      .update(projectRegister)
      .set({
        status: 'SUBMITTED',
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(eq(projectRegister.id, id));

    // Check if a workflow instance already exists (resubmission after rejection)
    const existingWf = await this.workflowService.getInstanceByBiz(
      'PROJECT_REGISTER',
      id,
    );

    if (existingWf && existingWf.instance.status === 'RUNNING') {
      // Resubmission: patch variables with the latest decision BEFORE signaling
      // so that ReviewHandler.onEnter picks up the fresh reviewerRoleCode when
      // the transition reenters the PROJECT_REVIEW node.
      await this.workflowService.updateVariables(existingWf.instance.id, {
        reviewerRoleCode,
        isPoolReview,
      });

      const pendingTask = existingWf.tasks.find(
        (t) =>
          t.nodeKey === 'PROJECT_REGISTER' && t.status === 'PENDING',
      );
      if (pendingTask) {
        await this.workflowService.signal(
          existingWf.instance.id,
          pendingTask.id,
          'SUBMIT',
          '项目信息已修改，重新提交',
          userId,
        );
      }
    } else {
      // First submission: create new workflow instance with variables
      await this.workflowService.startInstance(
        'PROJECT_ASSESSMENT_FLOW',
        'PROJECT_REGISTER',
        id,
        userId,
        { reviewerRoleCode, isPoolReview },
      );

      // Auto-signal the first SIMPLE node to advance to PROJECT_REVIEW
      try {
        const { wfTask: wfTaskSchema, wfInstance: wfInstSchema } =
          await import('../../database/schema/workflow');
        const { eq: eqOp, and: andOp } = await import('drizzle-orm');
        const pendingTasks = await this.db
          .select({
            taskId: wfTaskSchema.id,
            instanceId: wfTaskSchema.instanceId,
          })
          .from(wfTaskSchema)
          .innerJoin(
            wfInstSchema,
            eqOp(wfTaskSchema.instanceId, wfInstSchema.id),
          )
          .where(
            andOp(
              eqOp(wfInstSchema.bizType, 'PROJECT_REGISTER'),
              eqOp(wfInstSchema.bizId, id),
              eqOp(wfTaskSchema.nodeKey, 'PROJECT_REGISTER'),
              eqOp(wfTaskSchema.status, 'PENDING'),
            ),
          )
          .limit(1);

        if (pendingTasks.length > 0) {
          await this.workflowService.signal(
            pendingTasks[0].instanceId,
            pendingTasks[0].taskId,
            'SUBMIT',
            '项目信息已确认',
            userId,
          );
        }
      } catch (e) {
        console.error('Auto-signal PROJECT_REGISTER failed:', e);
      }
    }

    return this.findById(id);
  }

  // -----------------------------------------------------------------------
  // Assign members
  // -----------------------------------------------------------------------
  async assignMembers(id: number, dto: AssignMembersDto, userId: number) {
    await this.findById(id); // Ensure project exists

    // Soft-remove existing active members
    await this.db
      .update(projectMember)
      .set({
        status: 'REMOVED',
        removedAt: new Date(),
      })
      .where(
        and(
          eq(projectMember.projectId, id),
          eq(projectMember.status, 'ACTIVE'),
        ),
      );

    // Insert new members
    if (dto.members.length > 0) {
      await this.db.insert(projectMember).values(
        dto.members.map((m) => ({
          projectId: id,
          userId: m.userId,
          roleType: m.roleType,
          status: 'ACTIVE' as const,
          assignedBy: userId,
        })),
      );
    }

    return this.findById(id);
  }

  // -----------------------------------------------------------------------
  // Available years for a contract
  // -----------------------------------------------------------------------
  async getAvailableYears(contractId: number) {
    // Return all service years for the contract — no longer filter out
    // "already used" years because multiple project registrations per
    // contract per year are now allowed (batch registration scenario).
    const contracts = await this.db
      .select({ serviceYears: contract.serviceYears })
      .from(contract)
      .where(and(eq(contract.id, contractId), eq(contract.deleted, false)))
      .limit(1);

    if (!contracts[0]) {
      throw new NotFoundException(`Contract #${contractId} not found`);
    }

    return (contracts[0].serviceYears as number[]) ?? [];
  }

  // -----------------------------------------------------------------------
  // System quota for a contract
  //
  // Returns { total, used, remaining, systemNames } where:
  //   total = number of contract_system_item rows (approved with contract)
  //   used  = sum of project_system_item across ALL project_registers
  //           linked to this contract (excluding excludeProjectId if given)
  //   remaining = total - used
  //   systemNames = contract system item names for dropdown selection
  // -----------------------------------------------------------------------
  async getContractSystemQuota(
    contractId: number,
    excludeProjectId?: number,
  ) {
    // Total: contract system items
    const totalResult = await this.db
      .select({ total: count() })
      .from(contractSystemItem)
      .where(
        and(
          eq(contractSystemItem.contractId, contractId),
          eq(contractSystemItem.deleted, false),
        ),
      );
    const total = totalResult[0]?.total ?? 0;

    // System names for dropdown
    const nameRows = await this.db
      .select({ systemName: contractSystemItem.systemName })
      .from(contractSystemItem)
      .where(
        and(
          eq(contractSystemItem.contractId, contractId),
          eq(contractSystemItem.deleted, false),
        ),
      )
      .orderBy(contractSystemItem.sortOrder);
    const systemNames = nameRows.map((r) => r.systemName);

    // Used: project system items across all projects for this contract
    const projectIds = await this.db
      .select({ id: projectRegister.id })
      .from(projectRegister)
      .where(
        and(
          eq(projectRegister.contractId, contractId),
          eq(projectRegister.deleted, false),
        ),
      );

    let usedProjectIds = projectIds.map((p) => p.id);
    if (excludeProjectId) {
      usedProjectIds = usedProjectIds.filter((id) => id !== excludeProjectId);
    }

    let used = 0;
    if (usedProjectIds.length > 0) {
      const usedResult = await this.db
        .select({ total: count() })
        .from(projectSystemItem)
        .where(
          and(
            or(
              ...usedProjectIds.map((pid) =>
                eq(projectSystemItem.projectRegisterId, pid),
              ),
            ),
            eq(projectSystemItem.deleted, false),
          ),
        );
      used = usedResult[0]?.total ?? 0;
    }

    return { total, used, remaining: total - used, systemNames };
  }

  // -----------------------------------------------------------------------
  // Recalculate and update contract.system_quota_full flag
  // -----------------------------------------------------------------------
  async refreshSystemQuotaFull(contractId: number): Promise<void> {
    const { total, used } = await this.getContractSystemQuota(contractId);
    const isFull = used >= total;

    await this.db
      .update(contract)
      .set({ systemQuotaFull: isFull, updatedAt: new Date() })
      .where(eq(contract.id, contractId));
  }

  // -----------------------------------------------------------------------
  // Auto-generate application number
  // -----------------------------------------------------------------------
  private async generateApplicationNo(year: number): Promise<string> {
    const prefix = `XMDJ${year}`;
    const rows = await this.db
      .select({ applicationNo: projectRegister.applicationNo })
      .from(projectRegister)
      .where(
        and(
          ilike(projectRegister.applicationNo, `${prefix}%`),
          eq(projectRegister.deleted, false),
        ),
      )
      .orderBy(desc(projectRegister.applicationNo))
      .limit(1);

    let seq = 1;
    if (rows.length > 0 && rows[0].applicationNo) {
      const lastSeq = parseInt(rows[0].applicationNo.replace(prefix, ''), 10);
      if (!isNaN(lastSeq)) seq = lastSeq + 1;
    }
    return `${prefix}${seq.toString().padStart(3, '0')}`;
  }

  // -----------------------------------------------------------------------
  // Auto-generate application name
  // -----------------------------------------------------------------------
  private async buildApplicationName(userId: number, contractId: number, createdAt: Date): Promise<string> {
    // Get user display name
    const users = await this.db
      .select({ displayName: userAccount.displayName })
      .from(userAccount)
      .where(eq(userAccount.id, userId))
      .limit(1);
    const userName = users[0]?.displayName ?? '';

    // Get customer name and contract name
    const contracts = await this.db
      .select({
        contractName: contract.contractName,
        customerName: customer.fullName,
      })
      .from(contract)
      .leftJoin(customer, eq(contract.customerId, customer.id))
      .where(eq(contract.id, contractId))
      .limit(1);

    const customerName = contracts[0]?.customerName ?? '';
    const contractName = contracts[0]?.contractName ?? '';

    const dateStr = createdAt.toISOString().slice(0, 10); // YYYY-MM-DD

    if (customerName && contractName) {
      return `${userName}-系统登记申请-${customerName}-${contractName}-${dateStr}`;
    }
    return `${userName}-系统登记申请-${dateStr}`;
  }

  // -----------------------------------------------------------------------
  // Reusable audit-diff helper
  // -----------------------------------------------------------------------
  private async logFieldChanges(
    bizType: string,
    bizId: number,
    oldRecord: Record<string, unknown>,
    newValues: Record<string, unknown>,
    operatorId: number,
  ) {
    const entries: {
      bizType: string;
      bizId: number;
      fieldName: string;
      oldValue: string | null;
      newValue: string | null;
      operatorId: number;
    }[] = [];

    for (const key of Object.keys(newValues)) {
      if (newValues[key] === undefined) continue;

      const oldVal = oldRecord[key];
      const newVal = newValues[key];

      if (String(oldVal ?? '') !== String(newVal ?? '')) {
        entries.push({
          bizType,
          bizId,
          fieldName: key,
          oldValue: oldVal != null ? String(oldVal) : null,
          newValue: newVal != null ? String(newVal) : null,
          operatorId,
        });
      }
    }

    if (entries.length > 0) {
      await this.db.insert(fieldChangeLog).values(entries);
    }
  }

  // ── System Item Independent CRUD ──

  async getSystemItems(projectId: number) {
    const items = await this.db
      .select()
      .from(projectSystemItem)
      .where(
        and(
          eq(projectSystemItem.projectRegisterId, projectId),
          eq(projectSystemItem.deleted, false),
        ),
      )
      .orderBy(projectSystemItem.sortOrder);

    // Load file attachments for each system item
    const itemsWithFiles = await Promise.all(
      items.map(async (item) => {
        const files = await this.db
          .select()
          .from(fileAttachment)
          .where(
            and(
              eq(fileAttachment.bizType, 'PROJECT_SYSTEM_ITEM'),
              eq(fileAttachment.bizId, item.id),
              eq(fileAttachment.deleted, false),
            ),
          );

        // Group files by category (stored in node_key field)
        const filingCertificateFile = files.find((f) => f.nodeKey === 'FILING_CERTIFICATE');
        const filingFormFile = files.find((f) => f.nodeKey === 'FILING_FORM');
        const classificationReportFile = files.find((f) => f.nodeKey === 'CLASSIFICATION_REPORT');

        return {
          ...item,
          filingCertificateFile: filingCertificateFile
            ? { id: filingCertificateFile.id, fileName: filingCertificateFile.fileName, fileSize: filingCertificateFile.fileSize }
            : null,
          filingFormFile: filingFormFile
            ? { id: filingFormFile.id, fileName: filingFormFile.fileName, fileSize: filingFormFile.fileSize }
            : null,
          classificationReportFile: classificationReportFile
            ? { id: classificationReportFile.id, fileName: classificationReportFile.fileName, fileSize: classificationReportFile.fileSize }
            : null,
        };
      }),
    );

    return itemsWithFiles;
  }

  async createSystemItem(
    projectId: number,
    dto: import('./dto/project.dto').CreateProjectSystemItemDto,
  ) {
    // Verify project exists
    const proj = await this.db
      .select()
      .from(projectRegister)
      .where(
        and(
          eq(projectRegister.id, projectId),
          eq(projectRegister.deleted, false),
        ),
      )
      .limit(1);
    if (proj.length === 0) throw new NotFoundException('Project not found');

    // Check system quota
    const quota = await this.getContractSystemQuota(proj[0].contractId);
    if (quota.remaining <= 0) {
      throw new BadRequestException(
        `合同系统名额已用完（${quota.used}/${quota.total}），不可新增`,
      );
    }

    const maxSort = await this.db
      .select({ max: count() })
      .from(projectSystemItem)
      .where(eq(projectSystemItem.projectRegisterId, projectId));

    const [created] = await this.db
      .insert(projectSystemItem)
      .values({
        projectRegisterId: projectId,
        systemName: dto.systemName,
        filingAgency: dto.filingAgency || null,
        securityLevel: dto.securityLevel || null,
        isReassessment: dto.isReassessment ?? false,
        requiredEntryDate: dto.requiredEntryDate || null,
        requiredReportDeliveryDate: dto.requiredReportDeliveryDate || null,
        assessedUnitName: dto.assessedUnitName || null,
        assessedUnitIndustry: dto.assessedUnitIndustry || null,
        assessedUnitContact: dto.assessedUnitContact || null,
        assessedUnitMobile: dto.assessedUnitMobile || null,
        assessedUnitAddress: dto.assessedUnitAddress || null,
        hasFilingCertificate: dto.hasFilingCertificate ?? false,
        filingCertificateNo: dto.filingCertificateNo || null,
        filingCertificateIssuedAt: dto.filingCertificateIssuedAt || null,
        hasFilingForm: dto.hasFilingForm ?? false,
        hasClassificationReport: dto.hasClassificationReport ?? false,
        sortOrder: dto.sortOrder ?? (maxSort[0]?.max ?? 0),
      })
      .returning();

    // Refresh quota flag
    await this.refreshSystemQuotaFull(proj[0].contractId);

    return created;
  }

  async updateSystemItem(
    projectId: number,
    itemId: number,
    dto: import('./dto/project.dto').CreateProjectSystemItemDto,
  ) {
    const existing = await this.db
      .select()
      .from(projectSystemItem)
      .where(
        and(
          eq(projectSystemItem.id, itemId),
          eq(projectSystemItem.projectRegisterId, projectId),
          eq(projectSystemItem.deleted, false),
        ),
      )
      .limit(1);
    if (existing.length === 0) throw new NotFoundException('System item not found');

    const [updated] = await this.db
      .update(projectSystemItem)
      .set({
        systemName: dto.systemName,
        filingAgency: dto.filingAgency || null,
        securityLevel: dto.securityLevel || null,
        isReassessment: dto.isReassessment ?? false,
        requiredEntryDate: dto.requiredEntryDate || null,
        requiredReportDeliveryDate: dto.requiredReportDeliveryDate || null,
        assessedUnitName: dto.assessedUnitName || null,
        assessedUnitIndustry: dto.assessedUnitIndustry || null,
        assessedUnitContact: dto.assessedUnitContact || null,
        assessedUnitMobile: dto.assessedUnitMobile || null,
        assessedUnitAddress: dto.assessedUnitAddress || null,
        hasFilingCertificate: dto.hasFilingCertificate ?? false,
        filingCertificateNo: dto.filingCertificateNo || null,
        filingCertificateIssuedAt: dto.filingCertificateIssuedAt || null,
        hasFilingForm: dto.hasFilingForm ?? false,
        hasClassificationReport: dto.hasClassificationReport ?? false,
        sortOrder: dto.sortOrder ?? existing[0].sortOrder,
        updatedAt: new Date(),
      })
      .where(eq(projectSystemItem.id, itemId))
      .returning();
    return updated;
  }

  async deleteSystemItem(projectId: number, itemId: number) {
    const existing = await this.db
      .select()
      .from(projectSystemItem)
      .where(
        and(
          eq(projectSystemItem.id, itemId),
          eq(projectSystemItem.projectRegisterId, projectId),
          eq(projectSystemItem.deleted, false),
        ),
      )
      .limit(1);
    if (existing.length === 0) throw new NotFoundException('System item not found');

    await this.db
      .update(projectSystemItem)
      .set({ deleted: true, updatedAt: new Date() })
      .where(eq(projectSystemItem.id, itemId));

    // Refresh quota flag (may re-open the contract for new project registrations)
    const proj = await this.db
      .select({ contractId: projectRegister.contractId })
      .from(projectRegister)
      .where(eq(projectRegister.id, projectId))
      .limit(1);
    if (proj[0]) {
      await this.refreshSystemQuotaFull(proj[0].contractId);
    }
  }

}
