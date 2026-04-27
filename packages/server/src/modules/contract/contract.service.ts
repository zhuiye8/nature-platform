import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { eq, and, or, ilike, count, desc, sql, inArray, SQL } from 'drizzle-orm';
import { DRIZZLE, DrizzleDB } from '../../database/database.module';
import {
  contract,
  contractGroup,
  contractSystemItem,
  customer,
  projectRegister,
  projectSystemItem,
} from '../../database/schema/business';
import { partner } from '../../database/schema/business';
import { userRole } from '../../database/schema/iam';
import { userAccount } from '../../database/schema/user';
import { fieldChangeLog } from '../../database/schema/common';
import { wfInstance, wfTask } from '../../database/schema/workflow';
import {
  CreateContractDto,
  UpdateContractDto,
  QueryContractDto,
  ArchiveContractDto,
  CreateGroupDto,
  UpdateGroupDto,
  QueryGroupDto,
} from './dto/contract.dto';
import { WorkflowService } from '../workflow/workflow.service';

@Injectable()
export class ContractService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly workflowService: WorkflowService,
  ) {}

  // -----------------------------------------------------------------------
  // Paginated list
  // -----------------------------------------------------------------------
  async findPage(query: QueryContractDto, currentUserId: number) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    // Check user roles for filtering
    const roles = await this.db
      .select({ roleCode: userRole.roleCode })
      .from(userRole)
      .where(eq(userRole.userId, currentUserId));
    const roleCodes = roles.map((r) => r.roleCode);
    const isSuperAdmin = roleCodes.includes('super_admin');
    const hasSales = roleCodes.includes('sales');
    const hasCommercial = roleCodes.includes('commercial') || roleCodes.includes('archiver');
    const hasManager = roleCodes.includes('dept_manager') || roleCodes.includes('project_director');
    const hasFinance = roleCodes.includes('finance');

    const conditions: SQL[] = [eq(contract.deleted, false)];

    // Role-based visibility (union of all role permissions)
    // super_admin: no filter
    if (!isSuperAdmin) {
      const visibilityConditions: SQL[] = [];
      if (hasSales) {
        visibilityConditions.push(or(eq(contract.createdBy, currentUserId), eq(contract.salesPersonId, currentUserId))!);
      }
      if (hasCommercial) {
        visibilityConditions.push(eq(contract.reviewStatus, 'APPROVED'));
      }
      if (hasManager) {
        // Managers see all non-draft contracts
        visibilityConditions.push(sql`${contract.reviewStatus} != 'DRAFT'`);
      }
      if (hasFinance) {
        // Finance handles payments after the contract is approved
        visibilityConditions.push(eq(contract.reviewStatus, 'APPROVED'));
      }
      if (visibilityConditions.length === 0) {
        return { list: [], total: 0, page, pageSize };
      }
      conditions.push(visibilityConditions.length === 1 ? visibilityConditions[0] : or(...visibilityConditions)!);
    }

    if (query.keyword) {
      const pattern = `%${query.keyword}%`;
      conditions.push(
        ilike(contract.contractName, pattern),
      );
    }

    if (query.reviewStatus) {
      conditions.push(eq(contract.reviewStatus, query.reviewStatus));
    }

    if (query.archiveStatus) {
      conditions.push(eq(contract.archiveStatus, query.archiveStatus));
    }

    if (query.serviceContent) {
      conditions.push(eq(contract.serviceContent, query.serviceContent));
    }

    if (query.systemQuotaFull === 'false') {
      conditions.push(eq(contract.systemQuotaFull, false));
    }

    if (query.paymentStatus) {
      conditions.push(eq(contract.paymentStatus, query.paymentStatus));
    }

    // Filter by salesPersonId (跟单销售)
    if (query.salesPersonId) {
      conditions.push(eq(contract.salesPersonId, query.salesPersonId));
    } else if (query.createdByUserId) {
      conditions.push(eq(contract.createdBy, query.createdByUserId));
    } else if (query.onlyMine === 'true') {
      conditions.push(eq(contract.createdBy, currentUserId));
    }

    const whereClause = and(...conditions)!;

    const [totalResult, rows] = await Promise.all([
      this.db
        .select({ total: count() })
        .from(contract)
        .where(whereClause),
      this.db
        .select({
          id: contract.id,
          groupId: contract.groupId,
          contractCategory: contract.contractCategory,
          customerId: contract.customerId,
          contractNo: contract.contractNo,
          contractName: contract.contractName,
          paymentCompany: contract.paymentCompany,
          paymentAmount: contract.paymentAmount,
          paymentMethod: contract.paymentMethod,
          partnerId: contract.partnerId,
          partnerName: partner.name,
          salesPersonId: contract.salesPersonId,
          performanceCity: contract.performanceCity,
          dealStatus: contract.dealStatus,
          serviceContent: contract.serviceContent,
          contractType: contract.contractType,
          serviceYears: contract.serviceYears,
          serviceYearDetail: contract.serviceYearDetail,
          paymentInfo: contract.paymentInfo,
          invoiceType: contract.invoiceType,
          taxRate: contract.taxRate,
          paymentStatus: contract.paymentStatus,
          financialHandlerId: contract.financialHandlerId,
          signedAt: contract.signedAt,
          archiveStatus: contract.archiveStatus,
          fileCount: contract.fileCount,
          storageLocation: contract.storageLocation,
          archiveRemark: contract.archiveRemark,
          archivedBy: contract.archivedBy,
          reviewStatus: contract.reviewStatus,
          remark: contract.remark,
          createdBy: contract.createdBy,
          createdAt: contract.createdAt,
          updatedBy: contract.updatedBy,
          updatedAt: contract.updatedAt,
          customerName: customer.fullName,
        })
        .from(contract)
        .leftJoin(customer, eq(contract.customerId, customer.id))
        .leftJoin(partner, eq(contract.partnerId, partner.id))
        .where(whereClause)
        .orderBy(desc(contract.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
    ]);

    // Batch: resolve all user names at once
    const allUserIds = [...new Set(
      rows.flatMap((r) => [r.salesPersonId, r.archivedBy, r.financialHandlerId]).filter(Boolean),
    )] as number[];
    const userNameMap = new Map<number, string>();
    if (allUserIds.length > 0) {
      const users = await this.db
        .select({ id: userAccount.id, displayName: userAccount.displayName })
        .from(userAccount)
        .where(inArray(userAccount.id, allUserIds));
      for (const u of users) userNameMap.set(u.id, u.displayName);
    }

    // Batch: load all system items for the page
    const contractIds = rows.map((r) => r.id);
    const allSystemItems = contractIds.length > 0
      ? await this.db
          .select({
            contractId: contractSystemItem.contractId,
            systemName: contractSystemItem.systemName,
            systemLevel: contractSystemItem.systemLevel,
          })
          .from(contractSystemItem)
          .where(and(inArray(contractSystemItem.contractId, contractIds), eq(contractSystemItem.deleted, false)))
          .orderBy(contractSystemItem.sortOrder)
      : [];
    const systemItemsMap = new Map<number, typeof allSystemItems>();
    for (const item of allSystemItems) {
      const list = systemItemsMap.get(item.contractId) ?? [];
      list.push(item);
      systemItemsMap.set(item.contractId, list);
    }

    // Batch: resolve reviewer labels
    const submittedIds = rows.filter((r) => r.reviewStatus === 'SUBMITTED').map((r) => r.id);
    const reviewerLabelMap = new Map<number, string>();
    if (submittedIds.length > 0) {
      for (const cid of submittedIds) {
        const label = await this.resolveContractReviewerLabel(cid, 'SUBMITTED');
        if (label) reviewerLabelMap.set(cid, label);
      }
    }

    const enriched = rows.map((row) => ({
      ...row,
      salesPersonName: (row.salesPersonId && userNameMap.get(row.salesPersonId)) ?? null,
      archiverName: (row.archivedBy && userNameMap.get(row.archivedBy)) ?? null,
      financialHandlerName: (row.financialHandlerId && userNameMap.get(row.financialHandlerId)) ?? null,
      systemItemsSummary: systemItemsMap.get(row.id) ?? [],
      currentReviewerLabel: reviewerLabelMap.get(row.id) ?? null,
    }));

    return {
      list: enriched,
      total: totalResult[0]?.total ?? 0,
      page,
      pageSize,
    };
  }

  // -----------------------------------------------------------------------
  // Resolve the reviewer label for a contract at the CONTRACT_REVIEW node.
  // Returns:
  //   - '部门经理' when pool review is active
  //   - an actual user display name when a single-assign fallback is in effect
  //   - null when the contract is not currently awaiting review
  // -----------------------------------------------------------------------
  private async resolveContractReviewerLabel(
    contractId: number,
    reviewStatus: string,
  ): Promise<string | null> {
    if (reviewStatus !== 'SUBMITTED') return null;

    const POOL_LABELS: Record<string, string> = {
      dept_manager: '部门经理',
    };

    const instRows = await this.db
      .select({
        variables: wfInstance.variables,
        instanceId: wfInstance.id,
      })
      .from(wfInstance)
      .where(
        and(
          eq(wfInstance.bizType, 'CONTRACT'),
          eq(wfInstance.bizId, contractId),
          eq(wfInstance.currentNode, 'CONTRACT_REVIEW'),
        ),
      )
      .limit(1);

    if (!instRows[0]) return null;

    const vars =
      (instRows[0].variables as Record<string, any> | null) ?? {};

    if (vars.isPoolReview && POOL_LABELS[vars.reviewerRoleCode]) {
      return POOL_LABELS[vars.reviewerRoleCode];
    }

    // Single-assign (fallback to super_admin or legacy) → resolve actual assignee name
    const reviewer = await this.db
      .select({ name: userAccount.displayName })
      .from(wfTask)
      .innerJoin(userAccount, eq(wfTask.assigneeId, userAccount.id))
      .where(
        and(
          eq(wfTask.instanceId, instRows[0].instanceId),
          eq(wfTask.nodeKey, 'CONTRACT_REVIEW'),
          eq(wfTask.status, 'PENDING'),
        ),
      )
      .limit(1);

    return reviewer[0]?.name ?? null;
  }

  // -----------------------------------------------------------------------
  // Single record with system items
  // -----------------------------------------------------------------------
  async findById(id: number, _currentUserId: number) {
    const rows = await this.db
      .select({
        id: contract.id,
        groupId: contract.groupId,
        contractCategory: contract.contractCategory,
        customerId: contract.customerId,
        contractNo: contract.contractNo,
        contractName: contract.contractName,
        contactName: contract.contactName,
        contactPhone: contract.contactPhone,
        paymentCompany: contract.paymentCompany,
        paymentAmount: contract.paymentAmount,
        paymentMethod: contract.paymentMethod,
        paymentInfo: contract.paymentInfo,
        invoiceType: contract.invoiceType,
        taxRate: contract.taxRate,
        partnerId: contract.partnerId,
        partnerName: partner.name,
        salesPersonId: contract.salesPersonId,
        performanceCity: contract.performanceCity,
        dealStatus: contract.dealStatus,
        serviceContent: contract.serviceContent,
        contractType: contract.contractType,
        serviceYears: contract.serviceYears,
        paymentStatus: contract.paymentStatus,
        paymentRemark: contract.paymentRemark,
        financialHandlerId: contract.financialHandlerId,
        signedAt: contract.signedAt,
        archiveStatus: contract.archiveStatus,
        fileCount: contract.fileCount,
        storageLocation: contract.storageLocation,
        archiveRemark: contract.archiveRemark,
        archivedBy: contract.archivedBy,
        archivedAt: contract.archivedAt,
        reviewStatus: contract.reviewStatus,
        remark: contract.remark,
        createdBy: contract.createdBy,
        createdAt: contract.createdAt,
        updatedBy: contract.updatedBy,
        updatedAt: contract.updatedAt,
        customerName: customer.fullName,
        customerUscc: customer.uscc,
        customerRegion: customer.region,
        customerAddressDetail: customer.addressDetail,
      })
      .from(contract)
      .leftJoin(customer, eq(contract.customerId, customer.id))
      .leftJoin(partner, eq(contract.partnerId, partner.id))
      .where(and(eq(contract.id, id), eq(contract.deleted, false)))
      .limit(1);

    if (!rows[0]) {
      throw new NotFoundException(`合同不存在`);
    }

    // Load system items
    const items = await this.db
      .select()
      .from(contractSystemItem)
      .where(
        and(
          eq(contractSystemItem.contractId, id),
          eq(contractSystemItem.deleted, false),
        ),
      )
      .orderBy(contractSystemItem.sortOrder);

    const record = rows[0];

    // Column-level visibility: non-creator sales can only see basic info (no financial fields)
    const roles = await this.db
      .select({ roleCode: userRole.roleCode })
      .from(userRole)
      .where(eq(userRole.userId, _currentUserId));
    const roleCodes = roles.map((r) => r.roleCode);
    const isSuperAdmin = roleCodes.includes('super_admin');
    const isCommercial = roleCodes.includes('commercial');
    const isCreator = record.createdBy === _currentUserId;

    // Get sales person name
    let salesPersonName: string | null = null;
    if (record.salesPersonId) {
      const users = await this.db
        .select({ displayName: userAccount.displayName })
        .from(userAccount)
        .where(eq(userAccount.id, record.salesPersonId))
        .limit(1);
      salesPersonName = users[0]?.displayName ?? null;
    }

    let archivedByName: string | null = null;
    if (record.archivedBy) {
      const users = await this.db
        .select({ displayName: userAccount.displayName })
        .from(userAccount)
        .where(eq(userAccount.id, record.archivedBy))
        .limit(1);
      archivedByName = users[0]?.displayName ?? null;
    }

    let financialHandlerName: string | null = null;
    if (record.financialHandlerId) {
      const users = await this.db
        .select({ displayName: userAccount.displayName })
        .from(userAccount)
        .where(eq(userAccount.id, record.financialHandlerId))
        .limit(1);
      financialHandlerName = users[0]?.displayName ?? null;
    }

    // Group name
    let groupName: string | null = null;
    if (record.groupId) {
      const groups = await this.db
        .select({ groupName: contractGroup.groupName })
        .from(contractGroup)
        .where(eq(contractGroup.id, record.groupId))
        .limit(1);
      groupName = groups[0]?.groupName ?? null;
    }

    // Sibling contracts in the same group
    let groupContracts: any[] = [];
    if (record.groupId) {
      groupContracts = await this.db
        .select({
          id: contract.id,
          contractNo: contract.contractNo,
          contractName: contract.contractName,
          contractCategory: contract.contractCategory,
          reviewStatus: contract.reviewStatus,
        })
        .from(contract)
        .where(and(eq(contract.groupId, record.groupId), eq(contract.deleted, false)))
        .orderBy(contract.createdAt);
    }

    // ── 关联项目的系统明细（仅已通过项目登记的 project_system_item）──
    // 用于合同详情页展示"实际执行的系统清单"，替代 contract_system_item
    // 的粗粒度约定。系统编号 (systemNo) 在 DIRECTOR_REVIEW 通过时由
    // project.listener 生成，所以只有 status='APPROVED' 的项目才有值。
    // 若已通过但 systemNo 仍为 null (历史遗留 / 异常) 也展示，方便发现。
    const projectSystemItems = await this.db
      .select({
        projectId: projectRegister.id,
        applicationName: projectRegister.applicationName,
        contractYear: projectRegister.contractYear,
        projectStatus: projectRegister.status,
        systemItemId: projectSystemItem.id,
        systemNo: projectSystemItem.systemNo,
        systemName: projectSystemItem.systemName,
        securityLevel: projectSystemItem.securityLevel,
        filingAgency: projectSystemItem.filingAgency,
        assessedUnitName: projectSystemItem.assessedUnitName,
        filingCertificateNo: projectSystemItem.filingCertificateNo,
      })
      .from(projectSystemItem)
      .innerJoin(
        projectRegister,
        eq(projectSystemItem.projectRegisterId, projectRegister.id),
      )
      .where(
        and(
          eq(projectRegister.contractId, id),
          eq(projectRegister.deleted, false),
          eq(projectRegister.status, 'APPROVED'),
          eq(projectSystemItem.deleted, false),
        ),
      )
      .orderBy(
        desc(projectRegister.contractYear),
        projectRegister.id,
        projectSystemItem.sortOrder,
      );

    return {
      ...record,
      groupName,
      groupContracts,
      salesPersonName,
      archivedByName,
      financialHandlerName,
      systemItems: items,
      projectSystemItems,
    };
  }

  // -----------------------------------------------------------------------
  // Create
  // -----------------------------------------------------------------------
  async create(dto: CreateContractDto, userId: number) {
    const created = await this.db.transaction(async (tx) => {
      const result = await tx
        .insert(contract)
        .values({
          groupId: dto.groupId,
          contractCategory: dto.contractCategory ?? null,
          customerId: dto.customerId,
          contactName: dto.contactName ?? null,
          contactPhone: dto.contactPhone ?? null,
          paymentCompany: dto.paymentCompany ?? null,
          paymentAmount: dto.paymentAmount != null ? String(dto.paymentAmount) : null,
          paymentMethod: dto.paymentMethod ?? null,
          paymentInfo: dto.paymentInfo ?? null,
          invoiceType: dto.invoiceType ?? null,
          taxRate: dto.taxRate ?? null,
          partnerName: dto.partnerName ?? null,
          partnerId: dto.partnerId ?? null,
          salesPersonId: dto.salesPersonId ?? null,
          performanceCity: dto.performanceCity ?? null,
          dealStatus: dto.dealStatus ?? null,
          serviceContent: dto.serviceContent ?? null,
          contractType: dto.contractType ?? null,
          serviceYears: dto.serviceYears,
          remark: dto.remark ?? null,
          reviewStatus: 'DRAFT',
          createdBy: userId,
        })
        .returning();

      const row = result[0];

      // Insert system items in bulk
      if (dto.systemItems.length > 0) {
        await tx.insert(contractSystemItem).values(
          dto.systemItems.map((item, index) => ({
            contractId: row.id,
            systemName: item.systemName,
            systemLevel: item.systemLevel,
            sortOrder: item.sortOrder ?? index,
          })),
        );
      }

      // Generate and set contractName based on customer + system items + years
      const contractName = await this.buildContractName(
        dto.customerId,
        dto.systemItems,
        (dto.serviceYears ?? []) as number[],
      );
      if (contractName) {
        await tx
          .update(contract)
          .set({ contractName })
          .where(eq(contract.id, row.id));
      }

      return row;
    });

    return this.findById(created.id, userId);
  }

  // -----------------------------------------------------------------------
  // Update
  // -----------------------------------------------------------------------
  async update(id: number, dto: UpdateContractDto, userId: number) {
    const existing = await this.findById(id, userId);

    // Can only edit in DRAFT, REJECTED, or when ARCHIVED
    const editableStatuses = ['DRAFT', 'REJECTED'];
    if (
      !editableStatuses.includes(existing.reviewStatus) &&
      existing.archiveStatus !== 'ARCHIVED'
    ) {
      throw new BadRequestException(
        'Contract can only be edited in DRAFT/REJECTED status or when archived',
      );
    }

    // Ownership check: creator or salesPerson can edit (super_admin and archived contracts exempt)
    const isOwner = existing.createdBy === userId || existing.salesPersonId === userId;
    if (!isOwner && existing.archiveStatus !== 'ARCHIVED') {
      const adminCheck = await this.db
        .select()
        .from(userRole)
        .where(and(eq(userRole.userId, userId), eq(userRole.roleCode, 'super_admin')))
        .limit(1);
      if (adminCheck.length === 0) {
        throw new ForbiddenException('只有合同创建人或跟单销售可以编辑此合同');
      }
    }

    // Build update payload (exclude systemItems from contract table update)
    const { systemItems, ...contractFields } = dto;

    const oldRecord = existing as unknown as Record<string, unknown>;

    const result = await this.db
      .update(contract)
      .set({
        ...(contractFields.customerId !== undefined && { customerId: contractFields.customerId }),
        ...(contractFields.contactName !== undefined && { contactName: contractFields.contactName }),
        ...(contractFields.contactPhone !== undefined && { contactPhone: contractFields.contactPhone }),
        ...(contractFields.paymentCompany !== undefined && { paymentCompany: contractFields.paymentCompany }),
        ...(contractFields.paymentAmount !== undefined && {
          paymentAmount: contractFields.paymentAmount != null ? String(contractFields.paymentAmount) : null,
        }),
        ...(contractFields.paymentMethod !== undefined && { paymentMethod: contractFields.paymentMethod }),
        ...(contractFields.paymentInfo !== undefined && { paymentInfo: contractFields.paymentInfo }),
        ...(contractFields.invoiceType !== undefined && { invoiceType: contractFields.invoiceType }),
        ...(contractFields.taxRate !== undefined && { taxRate: contractFields.taxRate }),
        ...(contractFields.partnerName !== undefined && { partnerName: contractFields.partnerName }),
        ...(contractFields.partnerId !== undefined && { partnerId: contractFields.partnerId }),
        ...(contractFields.salesPersonId !== undefined && { salesPersonId: contractFields.salesPersonId }),
        ...(contractFields.performanceCity !== undefined && { performanceCity: contractFields.performanceCity }),
        ...(contractFields.dealStatus !== undefined && { dealStatus: contractFields.dealStatus }),
        ...(contractFields.serviceContent !== undefined && { serviceContent: contractFields.serviceContent }),
        ...(contractFields.contractType !== undefined && { contractType: contractFields.contractType }),
        ...(contractFields.serviceYears !== undefined && { serviceYears: contractFields.serviceYears }),
        ...(contractFields.serviceYearDetail !== undefined && { serviceYearDetail: contractFields.serviceYearDetail }),
        ...(contractFields.remark !== undefined && { remark: contractFields.remark }),
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(eq(contract.id, id))
      .returning();

    // Replace system items if provided
    if (systemItems !== undefined) {
      // Soft delete old items
      await this.db
        .update(contractSystemItem)
        .set({ deleted: true })
        .where(eq(contractSystemItem.contractId, id));

      // Insert new items
      if (systemItems.length > 0) {
        await this.db.insert(contractSystemItem).values(
          systemItems.map((item, index) => ({
            contractId: id,
            systemName: item.systemName,
            systemLevel: item.systemLevel,
            sortOrder: item.sortOrder ?? index,
          })),
        );
      }
    }

    // Regenerate contractName if relevant fields changed
    const needsNameRegen =
      contractFields.customerId !== undefined ||
      contractFields.serviceYears !== undefined ||
      systemItems !== undefined;

    if (needsNameRegen) {
      // Re-read current contract state for name generation
      const updated = result[0];
      const customerId = contractFields.customerId ?? existing.customerId;
      const serviceYears = (contractFields.serviceYears ?? existing.serviceYears ?? []) as number[];

      // Get current system items
      const currentItems = await this.db
        .select({
          systemName: contractSystemItem.systemName,
          systemLevel: contractSystemItem.systemLevel,
        })
        .from(contractSystemItem)
        .where(
          and(
            eq(contractSystemItem.contractId, id),
            eq(contractSystemItem.deleted, false),
          ),
        )
        .orderBy(contractSystemItem.sortOrder);

      const contractName = await this.buildContractName(
        customerId,
        currentItems,
        serviceYears,
      );
      if (contractName) {
        await this.db
          .update(contract)
          .set({ contractName })
          .where(eq(contract.id, id));
      }
    }

    // Audit trail — log changed fields
    await this.logFieldChanges(
      'contract',
      id,
      oldRecord,
      contractFields as unknown as Record<string, unknown>,
      userId,
    );

    return this.findById(id, userId);
  }

  // -----------------------------------------------------------------------
  // Soft-delete (creator only, DRAFT only)
  // -----------------------------------------------------------------------
  async remove(id: number, userId: number) {
    const existing = await this.findById(id, userId);

    if (existing.createdBy !== userId && existing.salesPersonId !== userId) {
      throw new ForbiddenException('只有合同创建人或跟单销售可以删除此合同');
    }

    if (existing.reviewStatus !== 'DRAFT') {
      throw new BadRequestException('只有草稿状态的合同可以删除');
    }

    await this.db
      .update(contract)
      .set({
        deleted: true,
        deletedAt: new Date(),
      })
      .where(eq(contract.id, id));

    // Soft delete system items
    await this.db
      .update(contractSystemItem)
      .set({ deleted: true })
      .where(eq(contractSystemItem.contractId, id));
  }

  // -----------------------------------------------------------------------
  // Submit for review
  // -----------------------------------------------------------------------
  async submit(id: number, userId: number) {
    const existing = await this.findById(id, userId);

    if (existing.createdBy !== userId && existing.salesPersonId !== userId) {
      throw new ForbiddenException('只有合同创建人或跟单销售可以提交此合同');
    }

    const submittableStatuses = ['DRAFT', 'REJECTED'];
    if (!submittableStatuses.includes(existing.reviewStatus)) {
      throw new BadRequestException(
        '只有草稿或驳回状态的合同可以提交',
      );
    }

    // Contract review uses fixed dept_manager pool. The fallback to a single
    // super_admin assignee when dept_manager has no active users is handled
    // inside ReviewHandler.onEnter.
    const reviewerRoleCode = 'dept_manager';
    const isPoolReview = true;

    await this.db
      .update(contract)
      .set({
        reviewStatus: 'SUBMITTED',
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(eq(contract.id, id));

    // Check if a workflow instance already exists (resubmission after rejection)
    const existingWf = await this.workflowService.getInstanceByBiz(
      'CONTRACT',
      id,
    );

    if (existingWf && existingWf.instance.status === 'RUNNING') {
      // Resubmission: patch variables with the latest decision BEFORE signaling
      // so ReviewHandler.onEnter picks up the fresh reviewerRoleCode when the
      // transition reenters CONTRACT_REVIEW. (For contracts the values never
      // change, but the call is kept for symmetry with project registration.)
      await this.workflowService.updateVariables(existingWf.instance.id, {
        reviewerRoleCode,
        isPoolReview,
      });

      const pendingTask = existingWf.tasks.find(
        (t) => t.nodeKey === 'CONTRACT_CREATE' && t.status === 'PENDING',
      );
      if (pendingTask) {
        await this.workflowService.signal(
          existingWf.instance.id,
          pendingTask.id,
          'SUBMIT',
          '合同信息已修改，重新提交',
          userId,
        );
      }
    } else if (existingWf) {
      // 铁律：归档完成 / 流程终结后不可再次提交合同审核
      // 如确有需要调整请联系管理员手工处理
      throw new BadRequestException(
        existingWf.instance.status === 'COMPLETED'
          ? '该合同已归档完成，不可重新提交'
          : `该合同的工作流已结束（${existingWf.instance.status}），不可重新提交`,
      );
    } else {
      // First submission: create new workflow instance with variables
      await this.workflowService.startInstance(
        'CONTRACT_FLOW',
        'CONTRACT',
        id,
        userId,
        { reviewerRoleCode, isPoolReview },
      );

      // Auto-signal the first SIMPLE node (CONTRACT_CREATE) to advance to CONTRACT_REVIEW
      try {
        const { wfTask, wfInstance: wfInst } = await import(
          '../../database/schema/workflow'
        );
        const pendingTasks = await this.db
          .select({ taskId: wfTask.id, instanceId: wfTask.instanceId })
          .from(wfTask)
          .innerJoin(wfInst, eq(wfTask.instanceId, wfInst.id))
          .where(
            and(
              eq(wfInst.bizType, 'CONTRACT'),
              eq(wfInst.bizId, id),
              eq(wfTask.nodeKey, 'CONTRACT_CREATE'),
              eq(wfTask.status, 'PENDING'),
            ),
          )
          .limit(1);

        if (pendingTasks.length > 0) {
          await this.workflowService.signal(
            pendingTasks[0].instanceId,
            pendingTasks[0].taskId,
            'SUBMIT',
            '合同信息已确认',
            userId,
          );
        }
      } catch (e) {
        console.error('Auto-signal CONTRACT_CREATE failed:', e);
      }
    }

    return this.findById(id, userId);
  }

  // -----------------------------------------------------------------------
  // Update Financial (commercial role)
  // -----------------------------------------------------------------------
  async updateFinancial(id: number, dto: any, userId: number) {
    const rows = await this.db
      .select({ id: contract.id, reviewStatus: contract.reviewStatus })
      .from(contract)
      .where(and(eq(contract.id, id), eq(contract.deleted, false)))
      .limit(1);

    if (!rows[0]) throw new NotFoundException(`合同不存在`);

    const updateData: any = { updatedBy: userId, updatedAt: new Date() };
    if (dto.paymentAmount !== undefined) updateData.paymentAmount = dto.paymentAmount;
    if (dto.paymentMethod !== undefined) updateData.paymentMethod = dto.paymentMethod;
    if (dto.paymentCompany !== undefined) updateData.paymentCompany = dto.paymentCompany;
    if (dto.paymentInfo !== undefined) updateData.paymentInfo = dto.paymentInfo;
    if (dto.invoiceType !== undefined) updateData.invoiceType = dto.invoiceType;
    if (dto.taxRate !== undefined) updateData.taxRate = dto.taxRate;
    if (dto.performanceCity !== undefined) updateData.performanceCity = dto.performanceCity;
    if (dto.paymentStatus !== undefined) updateData.paymentStatus = dto.paymentStatus;
    if (dto.paymentRemark !== undefined) updateData.paymentRemark = dto.paymentRemark;
    updateData.financialHandlerId = userId;

    await this.db.update(contract).set(updateData).where(eq(contract.id, id));

    return this.findById(id, userId);
  }

  // -----------------------------------------------------------------------
  // Archive
  // -----------------------------------------------------------------------
  async archive(id: number, dto: ArchiveContractDto, userId: number) {
    const existing = await this.findById(id, userId);

    if (existing.reviewStatus !== 'APPROVED') {
      throw new BadRequestException('只有已通过审核的合同可以归档');
    }
    if (existing.archiveStatus === 'ARCHIVED') {
      throw new BadRequestException('该合同已完成归档');
    }

    // 完成归档时签订时间必填（数据完整性要求：无签订时间的合同归档不合规）
    // 保存未完成归档（isComplete=false）时可选，允许分批补充
    if (dto.isComplete && !dto.signedAt) {
      throw new BadRequestException('完成归档时必须填写签订时间');
    }

    const newArchiveStatus = dto.isComplete ? 'ARCHIVED' : 'PARTIAL_ARCHIVE';

    const now = new Date();
    await this.db
      .update(contract)
      .set({
        archiveStatus: newArchiveStatus,
        signedAt: dto.signedAt ? new Date(dto.signedAt) : null,
        storageLocation: dto.storageLocation ?? null,
        fileCount: dto.fileCount ?? null,
        archiveRemark: dto.archiveRemark ?? null,
        archivedBy: userId,
        // 首次归档时记录时间；补充归档时不覆盖原时间
        archivedAt: existing.archivedAt ?? now,
        updatedBy: userId,
        updatedAt: now,
      })
      .where(eq(contract.id, id));

    // Signal workflow only when fully archived (not partial)
    if (newArchiveStatus !== 'ARCHIVED') {
      return this.findById(id, userId);
    }

    // Directly query wf_task for the archive node (bypass getMyTasks filtering)
    try {
      const { wfTask, wfInstance } = await import('../../database/schema/workflow');
      const archiveTasks = await this.db
        .select({ taskId: wfTask.id, instanceId: wfTask.instanceId })
        .from(wfTask)
        .innerJoin(wfInstance, eq(wfTask.instanceId, wfInstance.id))
        .where(
          and(
            eq(wfInstance.bizType, 'CONTRACT'),
            eq(wfInstance.bizId, id),
            eq(wfTask.nodeKey, 'CONTRACT_ARCHIVE'),
            eq(wfTask.status, 'PENDING'),
          ),
        )
        .limit(1);

      if (archiveTasks.length > 0) {
        await this.workflowService.signal(
          archiveTasks[0].instanceId,
          archiveTasks[0].taskId,
          'SUBMIT',
          '合同归档完成',
          userId,
        );
      }
    } catch (e) {
      console.error('Contract archive workflow signal failed:', e);
      throw new BadRequestException('归档完成但工作流推进失败，请联系管理员');
    }

    return this.findById(id, userId);
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

  // -----------------------------------------------------------------------
  // 付款单位选项（客户 + 合作方 并集）
  // -----------------------------------------------------------------------
  async getPayerOptions(keyword?: string) {
    const customers = await this.db
      .select({ id: customer.id, name: customer.fullName })
      .from(customer)
      .where(
        and(
          eq(customer.deleted, false),
          keyword ? ilike(customer.fullName, `%${keyword}%`) : undefined,
        ),
      )
      .limit(50);

    const partners = await this.db
      .select({ id: partner.id, name: partner.name })
      .from(partner)
      .where(
        keyword ? ilike(partner.name, `%${keyword}%`) : undefined,
      )
      .limit(50);

    return [
      ...customers.map((c) => ({ id: c.id, name: c.name, type: 'CUSTOMER' as const })),
      ...partners.map((p) => ({ id: p.id, name: p.name, type: 'PARTNER' as const })),
    ];
  }

  // -----------------------------------------------------------------------
  // Build contract name from customer + system items + service years
  // -----------------------------------------------------------------------
  private async buildContractName(
    customerId: number,
    systemItems: { systemName: string; systemLevel: number }[],
    serviceYears: number[],
  ): Promise<string> {
    // Get customer name
    const customers = await this.db
      .select({ fullName: customer.fullName })
      .from(customer)
      .where(eq(customer.id, customerId))
      .limit(1);

    const customerName = customers[0]?.fullName ?? '';

    // System display
    let systemDisplay = '';
    if (systemItems.length <= 3) {
      systemDisplay = systemItems.map((i) => i.systemName).join('、');
    } else {
      // Group by level and show level + count
      const levelMap = new Map<number, number>();
      for (const item of systemItems) {
        levelMap.set(item.systemLevel, (levelMap.get(item.systemLevel) ?? 0) + 1);
      }
      const parts: string[] = [];
      for (const [level, cnt] of Array.from(levelMap.entries()).sort((a, b) => a[0] - b[0])) {
        parts.push(`${cnt}个${level}级`);
      }
      systemDisplay = parts.join('、');
    }

    // Year display
    const yearDisplay = this.formatYearDisplay(serviceYears);

    return [customerName, systemDisplay, yearDisplay ? `${yearDisplay}年` : ''].filter(Boolean).join('-');
  }

  private formatYearDisplay(years: number[]): string {
    if (!years || years.length === 0) return '';

    const sorted = [...years].sort((a, b) => a - b);

    return sorted.join('、');
  }

  // =====================================================================
  // Contract Group CRUD
  // =====================================================================

  async createGroup(dto: CreateGroupDto, userId: number) {
    const result = await this.db
      .insert(contractGroup)
      .values({
        groupName: dto.groupName,
        remark: dto.remark ?? null,
        createdBy: userId,
      })
      .returning();
    return result[0];
  }

  async findGroupPage(query: QueryGroupDto, currentUserId: number) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    // Get user roles for data isolation
    const roles = await this.db
      .select({ roleCode: userRole.roleCode })
      .from(userRole)
      .where(eq(userRole.userId, currentUserId));
    const roleCodes = roles.map((r) => r.roleCode);
    const isSuperAdmin = roleCodes.includes('super_admin');
    const hasSales = roleCodes.includes('sales');
    const hasCommercial = roleCodes.includes('commercial') || roleCodes.includes('archiver');
    const hasManager = roleCodes.includes('dept_manager') || roleCodes.includes('project_director');
    const hasFinance = roleCodes.includes('finance');

    // Step 1: Find matching group IDs from both group-level and contract-level filters
    // Contract-level conditions (always applied to narrow down groups)
    const contractConds: SQL[] = [eq(contract.deleted, false)];

    // Role-based visibility (union)
    if (!isSuperAdmin) {
      const visibilityConds: SQL[] = [];
      if (hasSales) visibilityConds.push(or(eq(contract.createdBy, currentUserId), eq(contract.salesPersonId, currentUserId))!);
      if (hasCommercial) visibilityConds.push(eq(contract.reviewStatus, 'APPROVED'));
      if (hasManager) visibilityConds.push(sql`${contract.reviewStatus} != 'DRAFT'`);
      if (hasFinance) visibilityConds.push(eq(contract.reviewStatus, 'APPROVED'));
      if (visibilityConds.length === 0) {
        return { list: [], total: 0, page, pageSize };
      }
      contractConds.push(visibilityConds.length === 1 ? visibilityConds[0] : or(...visibilityConds)!);
    }
    if (query.reviewStatus) contractConds.push(eq(contract.reviewStatus, query.reviewStatus));
    if (query.archiveStatus) contractConds.push(eq(contract.archiveStatus, query.archiveStatus));
    if (query.paymentStatus) contractConds.push(eq(contract.paymentStatus, query.paymentStatus));
    if (query.serviceContent) contractConds.push(eq(contract.serviceContent, query.serviceContent));
    if (query.salesPersonId) contractConds.push(eq(contract.salesPersonId, query.salesPersonId));

    // Keyword: match group name OR contract name OR contract no
    let groupIdsFromKeyword: Set<number> | null = null;
    if (query.keyword) {
      const pattern = `%${query.keyword}%`;
      // Groups matching by name
      const gByName = await this.db
        .select({ id: contractGroup.id })
        .from(contractGroup)
        .where(and(eq(contractGroup.deleted, false), ilike(contractGroup.groupName, pattern)));
      // Groups matching by contract name/no
      const gByContract = await this.db
        .select({ groupId: contract.groupId })
        .from(contract)
        .where(and(
          ...contractConds,
          or(ilike(contract.contractName, pattern), ilike(contract.contractNo, pattern))!,
        ));
      groupIdsFromKeyword = new Set([
        ...gByName.map(r => r.id),
        ...gByContract.map(r => r.groupId),
      ]);
    }

    // Groups that have at least one matching contract (for contract-level filters)
    const needsVisibilityFilter = !isSuperAdmin && (hasSales || hasCommercial || hasManager || hasFinance);
    const hasContractFilter = !!query.reviewStatus || !!query.archiveStatus || !!query.serviceContent || !!query.salesPersonId || needsVisibilityFilter;
    let groupIdsFromContracts: Set<number> | null = null;
    if (hasContractFilter) {
      const matchingContracts = await this.db
        .select({ groupId: contract.groupId })
        .from(contract)
        .where(and(...contractConds));
      groupIdsFromContracts = new Set(matchingContracts.map(r => r.groupId));

      // Sales: also include groups they created (even if empty)
      if (hasSales && !isSuperAdmin) {
        const ownGroups = await this.db
          .select({ id: contractGroup.id })
          .from(contractGroup)
          .where(and(eq(contractGroup.deleted, false), eq(contractGroup.createdBy, currentUserId)));
        ownGroups.forEach(g => groupIdsFromContracts!.add(g.id));
      }
    }

    // Intersect group ID sets
    let validGroupIds: number[] | null = null;
    if (groupIdsFromKeyword !== null && groupIdsFromContracts !== null) {
      validGroupIds = [...groupIdsFromKeyword].filter(id => groupIdsFromContracts!.has(id));
    } else if (groupIdsFromKeyword !== null) {
      validGroupIds = [...groupIdsFromKeyword];
    } else if (groupIdsFromContracts !== null) {
      validGroupIds = [...groupIdsFromContracts];
    }

    // Step 2: Query groups with pagination
    const groupConditions: SQL[] = [eq(contractGroup.deleted, false)];
    if (validGroupIds !== null) {
      if (validGroupIds.length === 0) {
        return { list: [], total: 0, page, pageSize };
      }
      groupConditions.push(
        or(...validGroupIds.map(id => eq(contractGroup.id, id)))!,
      );
    }

    const [totalResult, groups] = await Promise.all([
      this.db.select({ total: count() }).from(contractGroup).where(and(...groupConditions)),
      this.db.select().from(contractGroup)
        .where(and(...groupConditions))
        .orderBy(desc(contractGroup.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
    ]);

    // Step 3: Load contracts per group (with role-based visibility)
    const enriched = await Promise.all(
      groups.map(async (g) => {
        const conds: SQL[] = [eq(contract.groupId, g.id), eq(contract.deleted, false)];
        if (!isSuperAdmin) {
          const visConds: SQL[] = [];
          if (hasSales) visConds.push(or(eq(contract.createdBy, currentUserId), eq(contract.salesPersonId, currentUserId))!);
          if (hasCommercial) visConds.push(eq(contract.reviewStatus, 'APPROVED'));
          if (hasManager) visConds.push(sql`${contract.reviewStatus} != 'DRAFT'`);
          if (hasFinance) visConds.push(eq(contract.reviewStatus, 'APPROVED'));
          if (visConds.length > 0) conds.push(visConds.length === 1 ? visConds[0] : or(...visConds)!);
        }
        // Apply contract-level filters to child contracts too
        if (query.reviewStatus) conds.push(eq(contract.reviewStatus, query.reviewStatus));
        if (query.archiveStatus) conds.push(eq(contract.archiveStatus, query.archiveStatus));
        if (query.paymentStatus) conds.push(eq(contract.paymentStatus, query.paymentStatus));
        if (query.salesPersonId) conds.push(eq(contract.salesPersonId, query.salesPersonId));

        const contracts = await this.db
          .select({
            id: contract.id,
            contractNo: contract.contractNo,
            contractName: contract.contractName,
            contractCategory: contract.contractCategory,
            reviewStatus: contract.reviewStatus,
            archiveStatus: contract.archiveStatus,
            paymentAmount: contract.paymentAmount,
            paymentMethod: contract.paymentMethod,
            paymentStatus: contract.paymentStatus,
            financialHandlerId: contract.financialHandlerId,
            salesPersonId: contract.salesPersonId,
            archivedBy: contract.archivedBy,
            createdBy: contract.createdBy,
            createdAt: contract.createdAt,
          })
          .from(contract)
          .where(and(...conds))
          .orderBy(contract.createdAt);

        // Batch: resolve user names for this group's contracts
        const groupUserIds = [...new Set(
          contracts.flatMap((c) => [c.salesPersonId, c.financialHandlerId, c.archivedBy]).filter(Boolean),
        )] as number[];
        const groupNameMap = new Map<number, string>();
        if (groupUserIds.length > 0) {
          const users = await this.db
            .select({ id: userAccount.id, displayName: userAccount.displayName })
            .from(userAccount)
            .where(inArray(userAccount.id, groupUserIds));
          for (const u of users) groupNameMap.set(u.id, u.displayName);
        }

        const contractsWithNames = await Promise.all(
          contracts.map(async (c) => {
            const currentReviewerLabel =
              await this.resolveContractReviewerLabel(c.id, c.reviewStatus);
            return {
              ...c,
              salesPersonName: (c.salesPersonId && groupNameMap.get(c.salesPersonId)) ?? null,
              financialHandlerName: (c.financialHandlerId && groupNameMap.get(c.financialHandlerId)) ?? null,
              archiverName: (c.archivedBy && groupNameMap.get(c.archivedBy)) ?? null,
              currentReviewerLabel,
            };
          }),
        );

        return { ...g, contracts: contractsWithNames };
      }),
    );

    return {
      list: enriched,
      total: totalResult[0]?.total ?? 0,
      page,
      pageSize,
    };
  }

  async updateGroup(id: number, dto: UpdateGroupDto, userId: number) {
    const rows = await this.db
      .select()
      .from(contractGroup)
      .where(and(eq(contractGroup.id, id), eq(contractGroup.deleted, false)))
      .limit(1);
    if (!rows[0]) throw new NotFoundException(`合同组不存在`);

    await this.db
      .update(contractGroup)
      .set({ ...dto, updatedBy: userId, updatedAt: new Date() })
      .where(eq(contractGroup.id, id));

    return this.db.select().from(contractGroup).where(eq(contractGroup.id, id)).limit(1).then(r => r[0]);
  }

  async deleteGroup(id: number, userId: number) {
    const rows = await this.db
      .select()
      .from(contractGroup)
      .where(and(eq(contractGroup.id, id), eq(contractGroup.deleted, false)))
      .limit(1);
    if (!rows[0]) throw new NotFoundException(`合同组不存在`);
    if (rows[0].createdBy !== userId) {
      throw new ForbiddenException('只有创建人可以删除合同组');
    }

    // Check no contracts in group
    const contractCount = await this.db
      .select({ total: count() })
      .from(contract)
      .where(and(eq(contract.groupId, id), eq(contract.deleted, false)));
    if ((contractCount[0]?.total ?? 0) > 0) {
      throw new BadRequestException('合同组内还有合同，无法删除');
    }

    await this.db
      .update(contractGroup)
      .set({ deleted: true, deletedAt: new Date() })
      .where(eq(contractGroup.id, id));
  }
}
