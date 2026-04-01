import {
  Inject,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { eq, and, or, ilike, count, desc, notInArray, SQL } from 'drizzle-orm';
import { DRIZZLE, DrizzleDB } from '../../database/database.module';
import {
  policeRegister,
  projectMember,
  projectRegister,
  projectSystemItem,
  contract,
  customer,
} from '../../database/schema/business';
import { WorkflowService } from '../workflow/workflow.service';
import { userAccount } from '../../database/schema/user';
import { userRole } from '../../database/schema/iam';
import { fieldChangeLog, fileAttachment } from '../../database/schema/common';
import {
  CreatePoliceDto,
  UpdatePoliceDto,
  QueryPoliceDto,
} from './dto/police.dto';

@Injectable()
export class PoliceService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly workflowService: WorkflowService,
  ) {}

  // -----------------------------------------------------------------------
  // Paginated list
  // -----------------------------------------------------------------------
  async findPage(query: QueryPoliceDto, userId: number) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    // Check if super_admin or police_register role
    const roleCheck = await this.db
      .select({ roleCode: userRole.roleCode })
      .from(userRole)
      .where(eq(userRole.userId, userId));
    const roleCodes = roleCheck.map((r) => r.roleCode);
    const isSuperAdmin = roleCodes.includes('super_admin');
    const isPoliceRole = roleCodes.includes('police_register');

    // If not super_admin and not police_register role, filter by project membership
    let visibleProjectIds: number[] | null = null;
    if (!isSuperAdmin && !isPoliceRole) {
      const myProjects = await this.db
        .select({ projectId: projectMember.projectId })
        .from(projectMember)
        .where(and(eq(projectMember.userId, userId), eq(projectMember.status, 'ACTIVE')));
      visibleProjectIds = myProjects.map((p) => p.projectId);
      if (visibleProjectIds.length === 0) {
        return { list: [], total: 0, page, pageSize };
      }
    }

    const conditions: SQL[] = [];
    if (visibleProjectIds) {
      conditions.push(
        or(
          ...visibleProjectIds.map((pid) => eq(policeRegister.projectRegisterId, pid)),
        )!,
      );
    }
    if (query.keyword) {
      const pattern = `%${query.keyword}%`;
      conditions.push(
        or(
          ilike(policeRegister.registerNo, pattern),
          ilike(projectRegister.applicationName, pattern),
        )!,
      );
    }
    if (query.status) {
      conditions.push(eq(policeRegister.status, query.status));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [totalResult, rows] = await Promise.all([
      this.db.select({ total: count() }).from(policeRegister)
        .leftJoin(projectRegister, eq(policeRegister.projectRegisterId, projectRegister.id))
        .where(whereClause),
      this.db
        .select({
          id: policeRegister.id,
          projectRegisterId: policeRegister.projectRegisterId,
          registerNo: policeRegister.registerNo,
          projectManagerId: policeRegister.projectManagerId,
          scanFileUrl: policeRegister.scanFileUrl,
          remark: policeRegister.remark,
          status: policeRegister.status,
          createdBy: policeRegister.createdBy,
          createdAt: policeRegister.createdAt,
          projectManagerName: userAccount.displayName,
          applicationName: projectRegister.applicationName,
        })
        .from(policeRegister)
        .leftJoin(userAccount, eq(policeRegister.projectManagerId, userAccount.id))
        .leftJoin(projectRegister, eq(policeRegister.projectRegisterId, projectRegister.id))
        .where(whereClause)
        .orderBy(desc(policeRegister.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
    ]);

    // Enrich with registrant name
    const enriched = await Promise.all(
      rows.map(async (row) => {
        let registrantName = '';
        if (row.createdBy) {
          const users = await this.db
            .select({ displayName: userAccount.displayName })
            .from(userAccount)
            .where(eq(userAccount.id, row.createdBy))
            .limit(1);
          registrantName = users[0]?.displayName ?? '';
        }
        // Check if file exists in file_attachment
        const files = await this.db
          .select({ id: fileAttachment.id })
          .from(fileAttachment)
          .where(
            and(
              eq(fileAttachment.bizType, 'POLICE'),
              eq(fileAttachment.bizId, row.id!),
              eq(fileAttachment.deleted, false),
            ),
          )
          .limit(1);
        const hasFile = files.length > 0;
        return { ...row, registrantName, hasFile };
      }),
    );

    return { list: enriched, total: totalResult[0]?.total ?? 0, page, pageSize };
  }

  // -----------------------------------------------------------------------
  // Single record
  // -----------------------------------------------------------------------
  async findById(id: number) {
    const rows = await this.db
      .select({
        id: policeRegister.id,
        projectRegisterId: policeRegister.projectRegisterId,
        registerNo: policeRegister.registerNo,
        filingAgency: policeRegister.filingAgency,
        contactName: policeRegister.contactName,
        contactPhone: policeRegister.contactPhone,
        projectManagerId: policeRegister.projectManagerId,
        scanFileUrl: policeRegister.scanFileUrl,
        remark: policeRegister.remark,
        status: policeRegister.status,
        createdBy: policeRegister.createdBy,
        createdAt: policeRegister.createdAt,
        updatedAt: policeRegister.updatedAt,
        projectManagerName: userAccount.displayName,
      })
      .from(policeRegister)
      .leftJoin(userAccount, eq(policeRegister.projectManagerId, userAccount.id))
      .where(eq(policeRegister.id, id))
      .limit(1);

    if (!rows[0]) throw new NotFoundException(`Police register #${id} not found`);

    const record = rows[0];

    // Enrich with project detail
    const projects = await this.db
      .select({
        applicationName: projectRegister.applicationName,
        contractYear: projectRegister.contractYear,
        contractId: projectRegister.contractId,
      })
      .from(projectRegister)
      .where(eq(projectRegister.id, record.projectRegisterId))
      .limit(1);

    const proj = projects[0];

    // Contract info
    let contractNo = '';
    let contractName = '';
    let customerName = '';
    if (proj?.contractId) {
      const contracts = await this.db
        .select({
          contractNo: contract.contractNo,
          contractName: contract.contractName,
          customerName: customer.fullName,
        })
        .from(contract)
        .leftJoin(customer, eq(contract.customerId, customer.id))
        .where(eq(contract.id, proj.contractId))
        .limit(1);
      contractNo = contracts[0]?.contractNo ?? '';
      contractName = contracts[0]?.contractName ?? '';
      customerName = contracts[0]?.customerName ?? '';
    }

    // System items
    const systemItems = await this.db
      .select({
        id: projectSystemItem.id,
        systemName: projectSystemItem.systemName,
        securityLevel: projectSystemItem.securityLevel,
        assessedUnitName: projectSystemItem.assessedUnitName,
      })
      .from(projectSystemItem)
      .where(
        and(
          eq(projectSystemItem.projectRegisterId, record.projectRegisterId),
          eq(projectSystemItem.deleted, false),
        ),
      )
      .orderBy(projectSystemItem.sortOrder);

    // Project members (PM + assessors)
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
          eq(projectMember.projectId, record.projectRegisterId),
          eq(projectMember.status, 'ACTIVE'),
        ),
      );

    return {
      ...record,
      projectDetail: {
        applicationName: proj?.applicationName ?? '',
        contractYear: proj?.contractYear ?? null,
        contractNo,
        contractName,
        customerName,
        systemItems,
        members,
      },
    };
  }

  // -----------------------------------------------------------------------
  // Create
  // -----------------------------------------------------------------------
  async create(dto: CreatePoliceDto, userId: number) {
    const result = await this.db
      .insert(policeRegister)
      .values({
        projectRegisterId: dto.projectRegisterId,
        projectManagerId: dto.projectManagerId ?? null,
        registerNo: dto.registerNo ?? null,
        filingAgency: dto.filingAgency ?? null,
        contactName: dto.contactName ?? null,
        contactPhone: dto.contactPhone ?? null,
        scanFileUrl: dto.scanFileUrl ?? null,
        remark: dto.remark ?? null,
        status: 'DRAFT',
        createdBy: userId,
      })
      .returning();
    return result[0];
  }

  // -----------------------------------------------------------------------
  // Update (DRAFT only)
  // -----------------------------------------------------------------------
  async update(id: number, dto: UpdatePoliceDto, userId: number) {
    const old = await this.findById(id);
    if (old.status !== 'DRAFT') {
      throw new BadRequestException('Only DRAFT records can be updated');
    }

    const result = await this.db
      .update(policeRegister)
      .set({ ...dto, updatedBy: userId, updatedAt: new Date() })
      .where(eq(policeRegister.id, id))
      .returning();

    await this.logFieldChanges('police_register', id, old as any, dto as any, userId);
    return result[0];
  }

  // -----------------------------------------------------------------------
  // Complete
  // -----------------------------------------------------------------------
  async complete(id: number, userId: number) {
    const record = await this.findById(id);
    if (record.status !== 'DRAFT') {
      throw new BadRequestException('Only DRAFT records can be completed');
    }

    // 1. Update police register status
    await this.db
      .update(policeRegister)
      .set({ status: 'COMPLETED', updatedBy: userId, updatedAt: new Date() })
      .where(eq(policeRegister.id, id));

    // 2. Insert project manager into project_member
    if (record.projectManagerId) {
      await this.db.insert(projectMember).values({
        projectId: record.projectRegisterId,
        userId: record.projectManagerId,
        roleType: 'PM',
        assignedBy: userId,
        assignedAt: new Date(),
      });
    }

    // 3. Signal workflow: complete POLICE_REGISTER node
    try {
      // Directly query wf_task for the POLICE_REGISTER node
      const { wfTask, wfInstance } = await import('../../database/schema/workflow');
      const policeTasks = await this.db
        .select({ taskId: wfTask.id, instanceId: wfTask.instanceId })
        .from(wfTask)
        .innerJoin(wfInstance, eq(wfTask.instanceId, wfInstance.id))
        .where(
          and(
            eq(wfInstance.bizType, 'PROJECT_REGISTER'),
            eq(wfInstance.bizId, record.projectRegisterId),
            eq(wfTask.nodeKey, 'POLICE_REGISTER'),
            eq(wfTask.status, 'PENDING'),
          ),
        )
        .limit(1);

      if (policeTasks.length > 0) {
        await this.workflowService.signal(
          policeTasks[0].instanceId,
          policeTasks[0].taskId,
          'SUBMIT',
          '公安登记完成',
          userId,
        );
      }
    } catch (e) {
      console.error('Police register workflow signal failed:', e);
      throw new BadRequestException('公安登记完成但工作流推进失败，请联系管理员');
    }

    return { success: true };
  }

  // -----------------------------------------------------------------------
  // Project managers list (for dropdown)
  // -----------------------------------------------------------------------
  async getProjectManagers() {
    const rows = await this.db
      .select({ id: userAccount.id, displayName: userAccount.displayName })
      .from(userAccount)
      .innerJoin(userRole, eq(userAccount.id, userRole.userId))
      .where(
        and(
          eq(userRole.roleCode, 'project_manager'),
          eq(userAccount.enabled, true),
        ),
      );
    return rows;
  }

  // -----------------------------------------------------------------------
  // Available projects (approved but without police registration)
  // -----------------------------------------------------------------------
  async getAvailableProjects() {
    // Get project_register_ids that already have police registrations
    const existingPolice = await this.db
      .select({ projectRegisterId: policeRegister.projectRegisterId })
      .from(policeRegister);
    const existingIds = existingPolice.map((r) => r.projectRegisterId);

    const conditions: SQL[] = [
      eq(projectRegister.status, 'APPROVED'),
      eq(projectRegister.deleted, false),
    ];

    const rows = await this.db
      .select({
        id: projectRegister.id,
        applicationName: projectRegister.applicationName,
      })
      .from(projectRegister)
      .where(
        existingIds.length > 0
          ? and(...conditions, notInArray(projectRegister.id, existingIds))!
          : and(...conditions)!,
      )
      .orderBy(desc(projectRegister.createdAt));

    return rows;
  }

  // -----------------------------------------------------------------------
  // Audit helper
  // -----------------------------------------------------------------------
  private async logFieldChanges(
    bizType: string,
    bizId: number,
    oldRecord: Record<string, unknown>,
    newValues: Record<string, unknown>,
    operatorId: number,
  ) {
    const entries: any[] = [];
    for (const key of Object.keys(newValues)) {
      if (newValues[key] === undefined) continue;
      const oldVal = oldRecord[key];
      const newVal = newValues[key];
      if (String(oldVal ?? '') !== String(newVal ?? '')) {
        entries.push({
          bizType, bizId, fieldName: key,
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
}
