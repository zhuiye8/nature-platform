import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { eq, and, or, ilike, count, desc, SQL } from 'drizzle-orm';
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
import { wfInstance, wfActionLog } from '../../database/schema/workflow';
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

    const conditions: SQL[] = [eq(projectRegister.deleted, false)];

    // Row-level: sales only sees own projects; PM/commercial/super_admin/dept_manager see all
    if (!isSuperAdmin && !isCommercial && !isManager) {
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

    // Enrich with creator name (签单销售)
    const enriched = await Promise.all(
      rows.map(async (row) => {
        let creatorName: string | null = null;
        if (row.createdBy) {
          const users = await this.db
            .select({ displayName: userAccount.displayName })
            .from(userAccount)
            .where(eq(userAccount.id, row.createdBy))
            .limit(1);
          creatorName = users[0]?.displayName ?? null;
        }
        // For rejected projects, get the last rejection remark
        let rejectRemark: string | null = null;
        if (row.status === 'REJECTED') {
          const logs = await this.db
            .select({ remark: wfActionLog.remark })
            .from(wfActionLog)
            .innerJoin(wfInstance, eq(wfActionLog.instanceId, wfInstance.id))
            .where(
              and(
                eq(wfInstance.bizType, 'PROJECT_REGISTER'),
                eq(wfInstance.bizId, row.id!),
                eq(wfActionLog.action, 'REJECT'),
              ),
            )
            .orderBy(desc(wfActionLog.createdAt))
            .limit(1);
          rejectRemark = logs[0]?.remark ?? null;
        }
        return { ...row, creatorName, rejectRemark };
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
        contractType: contract.contractType,
        customerName: customer.fullName,
        customerId: contract.customerId,
        customerContactName: customer.contactName,
        customerContactPhone: customer.mobilePhone,
        customerAddress: customer.addressDetail,
        serviceYears: contract.serviceYears,
        paymentAmount: contract.paymentAmount,
        paymentStatus: contract.paymentStatus,
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
      throw new NotFoundException(`Project #${id} not found`);
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

    return {
      ...rows[0],
      systemItems: items,
      members,
    };
  }

  // -----------------------------------------------------------------------
  // Create
  // -----------------------------------------------------------------------
  async create(dto: CreateProjectDto, userId: number) {
    // Check uniqueness: contractId + contractYear WHERE deleted=FALSE
    const existing = await this.db
      .select({ id: projectRegister.id })
      .from(projectRegister)
      .where(
        and(
          eq(projectRegister.contractId, dto.contractId),
          eq(projectRegister.contractYear, dto.contractYear),
          eq(projectRegister.deleted, false),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      throw new BadRequestException(
        `Project registration for contract #${dto.contractId} year ${dto.contractYear} already exists`,
      );
    }

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
    } else {
      // Copy from contract system items
      const contractItems = await this.db
        .select()
        .from(contractSystemItem)
        .where(
          and(
            eq(contractSystemItem.contractId, dto.contractId),
            eq(contractSystemItem.deleted, false),
          ),
        )
        .orderBy(contractSystemItem.sortOrder);

      if (contractItems.length > 0) {
        await this.db.insert(projectSystemItem).values(
          contractItems.map((ci, index) => ({
            projectRegisterId: created.id,
            systemName: ci.systemName,
            filingAgency: null,
            securityLevel: null,
            isReassessment: false,
            requiredEntryDate: null,
            requiredReportDeliveryDate: null,
            assessedUnitName: null,
            assessedUnitIndustry: null,
            assessedUnitContact: null,
            assessedUnitMobile: null,
            assessedUnitAddress: null,
            hasFilingCertificate: false,
            hasFilingForm: false,
            hasClassificationReport: false,
            sortOrder: index,
          })),
        );
      }
    }

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

    await this.db
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
    const itemMapping: { clientKey: string; id: number }[] = [];
    if (systemItems !== undefined) {
      // Get current item IDs for this project
      const existingItems = await this.db
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
          await this.db
            .update(projectSystemItem)
            .set({ deleted: true })
            .where(eq(projectSystemItem.id, eid));
          // Soft-delete associated files
          await this.db
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
          // UPDATE existing item (id preserved, file associations safe)
          await this.db
            .update(projectSystemItem)
            .set({ ...itemData, updatedAt: new Date() })
            .where(eq(projectSystemItem.id, item.id));
          itemMapping.push({
            clientKey: item.clientKey || String(item.id),
            id: item.id,
          });
        } else {
          // INSERT new item
          const inserted = await this.db
            .insert(projectSystemItem)
            .values({ projectRegisterId: id, ...itemData })
            .returning({ id: projectSystemItem.id });
          itemMapping.push({
            clientKey: item.clientKey || `new_${index}`,
            id: inserted[0].id,
          });
        }
      }
    }

    // Audit trail — log changed fields
    await this.logFieldChanges(
      'project_register',
      id,
      oldRecord,
      projectFields as unknown as Record<string, unknown>,
      userId,
    );

    // Regenerate applicationName based on current data
    const contractId = dto.contractId ?? existing.contractId!;
    const regeneratedName = await this.buildApplicationName(
      existing.createdBy!,
      contractId,
      existing.createdAt ? new Date(existing.createdAt) : new Date(),
    );
    await this.db
      .update(projectRegister)
      .set({ applicationName: regeneratedName, updatedBy: userId, updatedAt: new Date() })
      .where(eq(projectRegister.id, id));

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
        'Only the creator can delete this project',
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
      // Resubmission: find the PENDING task at PROJECT_REGISTER node and signal it
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
      // First submission: create new workflow instance
      await this.workflowService.startInstance(
        'PROJECT_ASSESSMENT_FLOW',
        'PROJECT_REGISTER',
        id,
        userId,
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
    // Get contract's serviceYears
    const contracts = await this.db
      .select({ serviceYears: contract.serviceYears })
      .from(contract)
      .where(and(eq(contract.id, contractId), eq(contract.deleted, false)))
      .limit(1);

    if (!contracts[0]) {
      throw new NotFoundException(`Contract #${contractId} not found`);
    }

    const allYears = (contracts[0].serviceYears as number[]) ?? [];

    // Get already-used years
    const usedProjects = await this.db
      .select({ contractYear: projectRegister.contractYear })
      .from(projectRegister)
      .where(
        and(
          eq(projectRegister.contractId, contractId),
          eq(projectRegister.deleted, false),
        ),
      );

    const usedYears = new Set(usedProjects.map((p) => p.contractYear));

    return allYears.filter((y) => !usedYears.has(y));
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
  }
}
