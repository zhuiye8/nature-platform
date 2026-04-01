import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { eq, and, ilike, count, desc, SQL } from 'drizzle-orm';
import { DRIZZLE, DrizzleDB } from '../../database/database.module';
import {
  contract,
  contractSystemItem,
  customer,
} from '../../database/schema/business';
import { partner } from '../../database/schema/business';
import { userRole } from '../../database/schema/iam';
import { userAccount } from '../../database/schema/user';
import { fieldChangeLog } from '../../database/schema/common';
import {
  CreateContractDto,
  UpdateContractDto,
  QueryContractDto,
  ArchiveContractDto,
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
    const allowedRoles = ['super_admin', 'sales', 'commercial', 'archiver', 'dept_manager', 'project_manager'];
    const hasContractAccess = roleCodes.some((r) => allowedRoles.includes(r));
    const isCommercialOnly = !isSuperAdmin && (roleCodes.includes('commercial') || roleCodes.includes('archiver')) && !roleCodes.includes('sales') && !roleCodes.includes('dept_manager');

    // Non-core roles see empty list
    if (!hasContractAccess) {
      return { list: [], total: 0, page: query.page ?? 1, pageSize: query.pageSize ?? 20 };
    }

    const conditions: SQL[] = [eq(contract.deleted, false)];

    // Commercial/archiver only see APPROVED contracts
    if (isCommercialOnly) {
      conditions.push(eq(contract.reviewStatus, 'APPROVED'));
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

    if (query.createdByUserId) {
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
          contractType: contract.contractType,
          serviceYears: contract.serviceYears,
          serviceYearDetail: contract.serviceYearDetail,
          paymentStatus: contract.paymentStatus,
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

    // Enrich with sales person name and system items summary
    const enriched = await Promise.all(
      rows.map(async (row) => {
        let salesPersonName: string | null = null;
        if (row.salesPersonId) {
          const users = await this.db
            .select({ displayName: userAccount.displayName })
            .from(userAccount)
            .where(eq(userAccount.id, row.salesPersonId))
            .limit(1);
          salesPersonName = users[0]?.displayName ?? null;
        }
        let archiverName: string | null = null;
        if (row.archivedBy) {
          const archivers = await this.db
            .select({ displayName: userAccount.displayName })
            .from(userAccount)
            .where(eq(userAccount.id, row.archivedBy))
            .limit(1);
          archiverName = archivers[0]?.displayName ?? null;
        }
        // Load system items summary
        const items = await this.db
          .select({
            systemName: contractSystemItem.systemName,
            systemLevel: contractSystemItem.systemLevel,
          })
          .from(contractSystemItem)
          .where(
            and(
              eq(contractSystemItem.contractId, row.id),
              eq(contractSystemItem.deleted, false),
            ),
          )
          .orderBy(contractSystemItem.sortOrder);
        return { ...row, salesPersonName, archiverName, systemItemsSummary: items };
      }),
    );

    return {
      list: enriched,
      total: totalResult[0]?.total ?? 0,
      page,
      pageSize,
    };
  }

  // -----------------------------------------------------------------------
  // Single record with system items
  // -----------------------------------------------------------------------
  async findById(id: number, _currentUserId: number) {
    const rows = await this.db
      .select({
        id: contract.id,
        customerId: contract.customerId,
        contractNo: contract.contractNo,
        contractName: contract.contractName,
        contactName: contract.contactName,
        contactPhone: contract.contactPhone,
        paymentCompany: contract.paymentCompany,
        payerType: contract.payerType,
        payerId: contract.payerId,
        paymentAmount: contract.paymentAmount,
        paymentMethod: contract.paymentMethod,
        partnerId: contract.partnerId,
        partnerName: partner.name,
        salesPersonId: contract.salesPersonId,
        performanceCity: contract.performanceCity,
        dealStatus: contract.dealStatus,
        contractType: contract.contractType,
        serviceYears: contract.serviceYears,
        paymentStatus: contract.paymentStatus,
        paymentRemark: contract.paymentRemark,
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
      .where(and(eq(contract.id, id), eq(contract.deleted, false)))
      .limit(1);

    if (!rows[0]) {
      throw new NotFoundException(`Contract #${id} not found`);
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

    const isSalesOnly = roleCodes.includes('sales') && !isSuperAdmin && !isCommercial;
    if (isSalesOnly && !isCreator) {
      return {
        ...record,
        salesPersonName,
        archivedByName,
        paymentAmount: null,
        paymentMethod: null,
        paymentCompany: null,
        paymentStatus: null,
        partnerName: null,
        dealStatus: null,
        systemItems: items,
        _restricted: true,
      };
    }

    return {
      ...record,
      salesPersonName,
      archivedByName,
      systemItems: items,
    };
  }

  // -----------------------------------------------------------------------
  // Create
  // -----------------------------------------------------------------------
  async create(dto: CreateContractDto, userId: number) {
    const result = await this.db
      .insert(contract)
      .values({
        customerId: dto.customerId,
        contactName: dto.contactName ?? null,
        contactPhone: dto.contactPhone ?? null,
        paymentCompany: dto.paymentCompany ?? null,
        paymentAmount: dto.paymentAmount != null ? String(dto.paymentAmount) : null,
        paymentMethod: dto.paymentMethod ?? null,
        partnerName: dto.partnerName ?? null,
        partnerId: dto.partnerId ?? null,
        salesPersonId: dto.salesPersonId ?? null,
        performanceCity: dto.performanceCity ?? null,
        dealStatus: dto.dealStatus ?? null,
        contractType: dto.contractType ?? null,
        serviceYears: dto.serviceYears,
        remark: dto.remark ?? null,
        reviewStatus: 'DRAFT',
        createdBy: userId,
      })
      .returning();

    const created = result[0];

    // Insert system items in bulk
    if (dto.systemItems.length > 0) {
      await this.db.insert(contractSystemItem).values(
        dto.systemItems.map((item, index) => ({
          contractId: created.id,
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
      await this.db
        .update(contract)
        .set({ contractName })
        .where(eq(contract.id, created.id));
    }

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

    // Ownership check: only creator can edit (super_admin and archived contracts exempt)
    if (existing.createdBy !== userId && existing.archiveStatus !== 'ARCHIVED') {
      const adminCheck = await this.db
        .select()
        .from(userRole)
        .where(and(eq(userRole.userId, userId), eq(userRole.roleCode, 'super_admin')))
        .limit(1);
      if (adminCheck.length === 0) {
        throw new ForbiddenException('只有合同创建人可以编辑此合同');
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
        ...(contractFields.partnerName !== undefined && { partnerName: contractFields.partnerName }),
        ...(contractFields.partnerId !== undefined && { partnerId: contractFields.partnerId }),
        ...(contractFields.salesPersonId !== undefined && { salesPersonId: contractFields.salesPersonId }),
        ...(contractFields.performanceCity !== undefined && { performanceCity: contractFields.performanceCity }),
        ...(contractFields.dealStatus !== undefined && { dealStatus: contractFields.dealStatus }),
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

    if (existing.createdBy !== userId) {
      throw new ForbiddenException('Only the creator can delete this contract');
    }

    if (existing.reviewStatus !== 'DRAFT') {
      throw new BadRequestException('Only DRAFT contracts can be deleted');
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

    if (existing.createdBy !== userId) {
      throw new ForbiddenException('Only the creator can submit this contract');
    }

    const submittableStatuses = ['DRAFT', 'REJECTED'];
    if (!submittableStatuses.includes(existing.reviewStatus)) {
      throw new BadRequestException(
        'Contract can only be submitted from DRAFT or REJECTED status',
      );
    }

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
      // Resubmission: find the PENDING task at CONTRACT_CREATE node and signal it
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
    } else {
      // First submission: create new workflow instance
      await this.workflowService.startInstance(
        'CONTRACT_FLOW',
        'CONTRACT',
        id,
        userId,
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

    if (!rows[0]) throw new NotFoundException(`Contract #${id} not found`);

    const updateData: any = { updatedBy: userId, updatedAt: new Date() };
    if (dto.paymentAmount !== undefined) updateData.paymentAmount = dto.paymentAmount;
    if (dto.paymentMethod !== undefined) updateData.paymentMethod = dto.paymentMethod;
    if (dto.paymentCompany !== undefined) updateData.paymentCompany = dto.paymentCompany;
    if (dto.payerType !== undefined) updateData.payerType = dto.payerType;
    if (dto.payerId !== undefined) updateData.payerId = dto.payerId;
    if (dto.performanceCity !== undefined) updateData.performanceCity = dto.performanceCity;
    if (dto.paymentStatus !== undefined) updateData.paymentStatus = dto.paymentStatus;
    if (dto.paymentRemark !== undefined) updateData.paymentRemark = dto.paymentRemark;

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

    const newArchiveStatus = dto.isComplete ? 'ARCHIVED' : 'PARTIAL_ARCHIVE';

    await this.db
      .update(contract)
      .set({
        archiveStatus: newArchiveStatus,
        signedAt: dto.signedAt ? new Date(dto.signedAt) : null,
        storageLocation: dto.storageLocation ?? null,
        fileCount: dto.fileCount ?? null,
        archiveRemark: dto.archiveRemark ?? null,
        archivedBy: userId,
        updatedBy: userId,
        updatedAt: new Date(),
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

    // Check if consecutive
    let isConsecutive = true;
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i] !== sorted[i - 1] + 1) {
        isConsecutive = false;
        break;
      }
    }

    return sorted.join('、');
  }
}
