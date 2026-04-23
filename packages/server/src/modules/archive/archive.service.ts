import {
  Inject,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { eq, and, or, desc, inArray, SQL } from 'drizzle-orm';
import { DRIZZLE, DrizzleDB } from '../../database/database.module';
import {
  materialArchive,
  projectRegister,
  projectMember,
  projectSystemItem,
  contract,
  customer,
} from '../../database/schema/business';
import { wfInstance, wfTask } from '../../database/schema/workflow';
import { userAccount } from '../../database/schema/user';
import { userRole } from '../../database/schema/iam';
import { WorkflowService } from '../workflow/workflow.service';
import { SubmitArchiveDto, QueryArchiveDto } from './dto/archive.dto';
import {
  loadProjectMembersEnriched,
  loadReportWriterInfo,
} from '../project/project-member.util';

@Injectable()
export class ArchiveService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly workflowService: WorkflowService,
  ) {}

  // -----------------------------------------------------------------------
  // List archives — shows projects at MATERIAL_ARCHIVE node or completed
  // -----------------------------------------------------------------------
  async findPage(query: QueryArchiveDto, userId: number) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    // Check user roles for visibility filtering
    const roles = await this.db
      .select({ roleCode: userRole.roleCode })
      .from(userRole)
      .where(eq(userRole.userId, userId));
    const roleCodes = roles.map((r) => r.roleCode);
    const isSuperAdmin = roleCodes.includes('super_admin');
    const isArchiver = roleCodes.includes('archiver');
    const isSales = roleCodes.includes('sales');
    // PM is determined by project_member.roleType='PM' (not by iam_role)
    // Check if this user has any PM membership records
    const pmCheck = await this.db
      .select({ id: projectMember.id })
      .from(projectMember)
      .where(
        and(
          eq(projectMember.userId, userId),
          eq(projectMember.roleType, 'PM'),
          eq(projectMember.status, 'ACTIVE'),
        ),
      )
      .limit(1);
    const isPM = pmCheck.length > 0;

    // Find projects at MATERIAL_ARCHIVE or COMPLETED
    const instances = await this.db
      .select({ bizId: wfInstance.bizId, currentNode: wfInstance.currentNode, wfStatus: wfInstance.status })
      .from(wfInstance)
      .where(
        and(
          eq(wfInstance.bizType, 'PROJECT_REGISTER'),
          or(
            eq(wfInstance.currentNode, 'MATERIAL_ARCHIVE'),
            eq(wfInstance.status, 'COMPLETED'),
          ),
        ),
      );

    let bizIds = instances.map((i) => i.bizId);
    if (bizIds.length === 0) {
      return { list: [], total: 0, page, pageSize };
    }

    // Visibility filter by role
    if (!isSuperAdmin && !isArchiver) {
      const visibleIds = new Set<number>();

      // PM: see projects where they are PM
      if (isPM) {
        const pmProjects = await this.db
          .select({ projectId: projectMember.projectId })
          .from(projectMember)
          .where(
            and(
              eq(projectMember.userId, userId),
              eq(projectMember.roleType, 'PM'),
              eq(projectMember.status, 'ACTIVE'),
            ),
          );
        pmProjects.forEach((p) => visibleIds.add(p.projectId));
      }

      // Sales: see projects they created or where they are the sales person on the contract
      if (isSales) {
        const salesProjects = await this.db
          .select({ id: projectRegister.id })
          .from(projectRegister)
          .leftJoin(contract, eq(projectRegister.contractId, contract.id))
          .where(
            or(
              eq(projectRegister.createdBy, userId),
              eq(contract.salesPersonId, userId),
            ),
          );
        salesProjects.forEach((p) => visibleIds.add(p.id));
      }

      bizIds = bizIds.filter((id) => visibleIds.has(id));
      if (bizIds.length === 0) {
        return { list: [], total: 0, page, pageSize };
      }
    }

    const bizNodeMap = new Map(instances.map((i) => [i.bizId, { currentNode: i.currentNode, wfStatus: i.wfStatus }]));

    // Get PM name subquery
    const pmAlias = this.db
      .select({
        projectId: projectMember.projectId,
        pmName: userAccount.displayName,
      })
      .from(projectMember)
      .innerJoin(userAccount, eq(projectMember.userId, userAccount.id))
      .where(and(eq(projectMember.roleType, 'PM'), eq(projectMember.status, 'ACTIVE')))
      .as('pm');

    // Full 18-item material checklist (卷内清单)
    const ALL_MATERIAL_CODES = [
      'CX18-01', 'CX18-02', 'CX18-03', 'CX18-05', 'CX18-06',
      'CX18-07', 'CX18-09', 'CX18-10', 'CX18-11', 'CX18-12',
      'CX18-14', 'CX18-17', 'CX17-01', 'CX17-02', 'CX22-02',
      'CX22-03', 'CX07-01', 'REPORT',
    ];
    const MATERIAL_LABELS: Record<string, string> = {
      'CX18-01': '测评项目计划书', 'CX18-02': '基本情况调查表',
      'CX18-03': '测评方案', 'CX18-05': '方案评审记录表',
      'CX18-06': '风险告知书', 'CX18-07': '首次会议签到记录',
      'CX18-09': '现场测评授权书', 'CX18-10': '安全测试授权书',
      'CX18-11': '系统状态确认书', 'CX18-12': '测评结果记录',
      'CX18-14': '末次会议签到记录', 'CX18-17': '文档接收/归还记录',
      'CX17-01': '设备使用申请表', 'CX17-02': '设备使用表',
      'CX22-02': '报告评审记录表', 'CX22-03': '资料签收单',
      'CX07-01': '服务评价表', 'REPORT': '测评报告',
    };
    const TOTAL_MATERIALS = ALL_MATERIAL_CODES.length;

    // Query ALL matching rows (archiveStatus is computed, so paginate in memory)
    const rows = await this.db
      .select({
        id: projectRegister.id,
        applicationName: projectRegister.applicationName,
        contractYear: projectRegister.contractYear,
        compiledBy: projectRegister.compiledBy,
        createdBy: projectRegister.createdBy,
        projectManagerName: pmAlias.pmName,
      })
      .from(projectRegister)
      .leftJoin(pmAlias, eq(projectRegister.id, pmAlias.projectId))
      .where(inArray(projectRegister.id, bizIds))
      .orderBy(desc(projectRegister.createdAt));

    // Batch: resolve user names
    const allUserIds = [...new Set(rows.flatMap((r) => [r.compiledBy, r.createdBy]).filter(Boolean))] as number[];
    const userNameMap = new Map<number, string>();
    if (allUserIds.length > 0) {
      const users = await this.db
        .select({ id: userAccount.id, displayName: userAccount.displayName })
        .from(userAccount)
        .where(inArray(userAccount.id, allUserIds));
      for (const u of users) userNameMap.set(u.id, u.displayName);
    }

    // Batch: load all archive records
    const rowIds = rows.map((r) => r.id!);
    const archiveMap = new Map<number, typeof materialArchive.$inferSelect>();
    if (rowIds.length > 0) {
      const archives = await this.db
        .select()
        .from(materialArchive)
        .where(inArray(materialArchive.projectRegisterId, rowIds));
      for (const a of archives) archiveMap.set(a.projectRegisterId, a);
    }

    // Batch: resolve archiver names (submittedBy)
    const archiverIds = [...new Set(
      [...archiveMap.values()].map((a) => a.submittedBy).filter(Boolean),
    )] as number[];
    if (archiverIds.length > 0) {
      const archivers = await this.db
        .select({ id: userAccount.id, displayName: userAccount.displayName })
        .from(userAccount)
        .where(inArray(userAccount.id, archiverIds));
      for (const u of archivers) userNameMap.set(u.id, u.displayName);
    }

    // Enrich with names + archive status (no more N+1)
    const enriched = rows.map((row) => {
      const compilerName = (row.compiledBy && userNameMap.get(row.compiledBy)) ?? null;
      const salesName = (row.createdBy && userNameMap.get(row.createdBy)) ?? null;
      const archiveRecord = archiveMap.get(row.id!) ?? null;

      // archiveStatus 是运行时计算的派生字段 (不存数据库)。
      // 使用英文枚举与其他模块 (contract 等) 保持一致, 前端通过
      // status-map.getStatusLabel / getStatusTagType 映射中文和颜色。
      //   PENDING_ARCHIVE 待归档 | PARTIAL_ARCHIVE 部分归档 | ARCHIVED 已归档
      let archiveStatus: 'PENDING_ARCHIVE' | 'PARTIAL_ARCHIVE' | 'ARCHIVED' = 'PENDING_ARCHIVE';
      if (archiveRecord?.status === 'SUBMITTED') {
        const items = (archiveRecord.materialStatusCodes ?? []) as any[];
        const checkedItems = items.filter((item) =>
          typeof item === 'string' ? true : item?.checked === true,
        );
        archiveStatus = checkedItems.length >= TOTAL_MATERIALS ? 'ARCHIVED' : 'PARTIAL_ARCHIVE';
      }

      const archiverName = (archiveRecord?.submittedBy && userNameMap.get(archiveRecord.submittedBy)) ?? null;
      const submittedAt = archiveRecord?.submittedAt ?? null;
      const wfInfo = bizNodeMap.get(row.id!) || { currentNode: '', wfStatus: '' };

      const rawItems = (archiveRecord?.materialStatusCodes ?? []) as any[];
      const checkedCodesSet = new Set(
        rawItems
          .filter((item) => typeof item === 'string' ? true : item?.checked === true)
          .map((item) => typeof item === 'string' ? item : item?.code),
      );
      const missingMaterials = ALL_MATERIAL_CODES
        .filter((code) => !checkedCodesSet.has(code))
        .map((code) => MATERIAL_LABELS[code] || code);
      const checkedCount = checkedCodesSet.size;

      return {
        ...row, compilerName, salesName, archiverName,
        archiveStatus, checkedCount, totalMaterials: TOTAL_MATERIALS,
        missingMaterials, submittedAt, ...wfInfo,
      };
    });

    // Filter by archive status then paginate in memory
    const filtered = query.archiveStatus
      ? enriched.filter((row) => row.archiveStatus === query.archiveStatus)
      : enriched;
    const total = filtered.length;
    const paginatedList = filtered.slice((page - 1) * pageSize, page * pageSize);

    return { list: paginatedList, total, page, pageSize };
  }

  // -----------------------------------------------------------------------
  // Detail — full project archive with all info
  // -----------------------------------------------------------------------
  async findByProjectId(projectRegisterId: number) {
    // Archive record
    const archiveRows = await this.db
      .select()
      .from(materialArchive)
      .where(eq(materialArchive.projectRegisterId, projectRegisterId))
      .limit(1);

    const archive = archiveRows[0] ?? null;

    // Project info
    // createdBy 供前端 ArchiveDetail 判断 "项目创建人" 是否可上传归档材料
    const projects = await this.db
      .select({
        id: projectRegister.id,
        applicationName: projectRegister.applicationName,
        contractYear: projectRegister.contractYear,
        contractId: projectRegister.contractId,
        status: projectRegister.status,
        createdBy: projectRegister.createdBy,
      })
      .from(projectRegister)
      .where(eq(projectRegister.id, projectRegisterId))
      .limit(1);

    const project = projects[0];
    if (!project) throw new NotFoundException('Project not found');

    // Contract + customer info
    let contractInfo: any = null;
    if (project.contractId) {
      const contracts = await this.db
        .select({
          contractNo: contract.contractNo,
          contractName: contract.contractName,
          customerName: customer.fullName,
          // 跟单销售(业绩归属),前端 canUploadPool 依赖此字段判断当前用户是否有权上传
          salesPersonId: contract.salesPersonId,
          paymentAmount: contract.paymentAmount,
          paymentMethod: contract.paymentMethod,
          paymentCompany: contract.paymentCompany,
          performanceCity: contract.performanceCity,
          paymentStatus: contract.paymentStatus,
          contractType: contract.contractType,
        })
        .from(contract)
        .leftJoin(customer, eq(contract.customerId, customer.id))
        .where(eq(contract.id, project.contractId))
        .limit(1);
      contractInfo = contracts[0] ?? null;
    }

    // System items
    const systemItems = await this.db
      .select({
        id: projectSystemItem.id,
        systemName: projectSystemItem.systemName,
        securityLevel: projectSystemItem.securityLevel,
        assessedUnitName: projectSystemItem.assessedUnitName,
        filingAgency: projectSystemItem.filingAgency,
        filingCertificateNo: projectSystemItem.filingCertificateNo,
      })
      .from(projectSystemItem)
      .where(
        and(
          eq(projectSystemItem.projectRegisterId, projectRegisterId),
          eq(projectSystemItem.deleted, false),
        ),
      )
      .orderBy(projectSystemItem.sortOrder);

    // Project members (enriched: PM 第一 / 等级降序 / assignedAt 升序 + level 字段)
    const members = await loadProjectMembersEnriched(this.db, projectRegisterId);
    // 编制人信息（独立于 members 展示）
    const reportWriter = await loadReportWriterInfo(
      this.db,
      projectRegisterId,
      members,
    );

    // Workflow status
    const wfRows = await this.db
      .select({ currentNode: wfInstance.currentNode, status: wfInstance.status })
      .from(wfInstance)
      .where(
        and(
          eq(wfInstance.bizType, 'PROJECT_REGISTER'),
          eq(wfInstance.bizId, projectRegisterId),
        ),
      )
      .limit(1);

    return {
      archive,
      project: {
        ...project,
        contractInfo,
        systemItems,
        members,
        reportWriter,
      },
      workflow: wfRows[0] ?? null,
    };
  }

  // -----------------------------------------------------------------------
  // Submit archive
  // -----------------------------------------------------------------------
  async submit(dto: SubmitArchiveDto, userId: number) {
    const existing = await this.db
      .select()
      .from(materialArchive)
      .where(eq(materialArchive.projectRegisterId, dto.projectRegisterId))
      .limit(1);

    if (existing[0]) {
      await this.db
        .update(materialArchive)
        .set({
          materialStatusCodes: dto.materialStatusCodes ?? [],
          fileCount: dto.fileCount ?? null,
          storageLocation: dto.storageLocation ?? null,
          remark: dto.remark ?? null,
          submittedBy: userId,
          submittedAt: new Date(),
          updatedBy: userId,
          updatedAt: new Date(),
          status: 'SUBMITTED',
        })
        .where(eq(materialArchive.id, existing[0].id));
    } else {
      await this.db.insert(materialArchive).values({
        projectRegisterId: dto.projectRegisterId,
        materialStatusCodes: dto.materialStatusCodes ?? [],
        fileCount: dto.fileCount ?? null,
        storageLocation: dto.storageLocation ?? null,
        remark: dto.remark ?? null,
        status: 'SUBMITTED',
        submittedBy: userId,
        submittedAt: new Date(),
        updatedBy: userId,
      });
    }

    // Signal MATERIAL_ARCHIVE node
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

    if (instance[0] && instance[0].currentNode === 'MATERIAL_ARCHIVE') {
      const tasks = await this.db
        .select()
        .from(wfTask)
        .where(
          and(
            eq(wfTask.instanceId, instance[0].id),
            eq(wfTask.nodeKey, 'MATERIAL_ARCHIVE'),
            eq(wfTask.status, 'PENDING'),
          ),
        )
        .limit(1);

      if (tasks[0]) {
        await this.workflowService.signal(
          instance[0].id,
          tasks[0].id,
          'SUBMIT',
          dto.remark ?? '材料归档完成',
          userId,
        );
      }
    }

    return { success: true };
  }
}
