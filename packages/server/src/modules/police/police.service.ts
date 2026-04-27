import {
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { eq, and, or, ilike, count, desc, inArray, SQL } from 'drizzle-orm';
import * as ExcelJS from 'exceljs';
import * as path from 'path';
import { DRIZZLE, DrizzleDB } from '../../database/database.module';
import {
  policeRegister,
  projectMember,
  projectRegister,
  projectSystemItem,
  contract,
  customer,
} from '../../database/schema/business';
import { userAccount } from '../../database/schema/user';
import { userRole } from '../../database/schema/iam';
import { fileAttachment } from '../../database/schema/common';
import { QueryPoliceDto } from './dto/police.dto';
import {
  loadProjectMembersEnriched,
  loadReportWriterInfo,
} from '../project/project-member.util';

@Injectable()
export class PoliceService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  // -----------------------------------------------------------------------
  // Paginated list
  // -----------------------------------------------------------------------
  async findPage(query: QueryPoliceDto, userId: number) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const roleCheck = await this.db
      .select({ roleCode: userRole.roleCode })
      .from(userRole)
      .where(eq(userRole.userId, userId));
    const roleCodes = roleCheck.map((r) => r.roleCode);
    const isSuperAdmin = roleCodes.includes('super_admin');
    const isChairman = roleCodes.includes('chairman');
    const isPoliceRole = roleCodes.includes('police_register');

    let visibleProjectIds: number[] | null = null;
    // chairman 业务全只读，看全部
    if (!isSuperAdmin && !isChairman && !isPoliceRole) {
      const myProjects = await this.db
        .select({ projectId: projectMember.projectId })
        .from(projectMember)
        .where(
          and(
            eq(projectMember.userId, userId),
            eq(projectMember.status, 'ACTIVE'),
          ),
        );
      visibleProjectIds = myProjects.map((p) => p.projectId);
      if (visibleProjectIds.length === 0) {
        return { list: [], total: 0, page, pageSize };
      }
    }

    const conditions: SQL[] = [];
    if (visibleProjectIds) {
      conditions.push(
        or(
          ...visibleProjectIds.map((pid) =>
            eq(policeRegister.projectRegisterId, pid),
          ),
        )!,
      );
    }
    if (query.keyword) {
      const pattern = `%${query.keyword}%`;
      conditions.push(ilike(projectRegister.applicationName, pattern));
    }
    if (query.status) {
      conditions.push(eq(policeRegister.status, query.status));
    }

    const whereClause =
      conditions.length > 0 ? and(...conditions) : undefined;

    const [totalResult, rows] = await Promise.all([
      this.db
        .select({ total: count() })
        .from(policeRegister)
        .leftJoin(
          projectRegister,
          eq(policeRegister.projectRegisterId, projectRegister.id),
        )
        .where(whereClause),
      this.db
        .select({
          id: policeRegister.id,
          projectRegisterId: policeRegister.projectRegisterId,
          status: policeRegister.status,
          createdAt: policeRegister.createdAt,
          applicationName: projectRegister.applicationName,
        })
        .from(policeRegister)
        .leftJoin(
          projectRegister,
          eq(policeRegister.projectRegisterId, projectRegister.id),
        )
        .where(whereClause)
        .orderBy(desc(policeRegister.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
    ]);

    // Batch: system item counts
    const projectIds = [...new Set(rows.map((r) => r.projectRegisterId).filter(Boolean))] as number[];
    const siCountMap = new Map<number, number>();
    if (projectIds.length > 0) {
      const siCounts = await this.db
        .select({
          projectRegisterId: projectSystemItem.projectRegisterId,
          total: count(),
        })
        .from(projectSystemItem)
        .where(and(inArray(projectSystemItem.projectRegisterId, projectIds), eq(projectSystemItem.deleted, false)))
        .groupBy(projectSystemItem.projectRegisterId);
      for (const s of siCounts) siCountMap.set(s.projectRegisterId, s.total);
    }

    // Batch: PM name + mobile
    const pmMap = new Map<number, { displayName: string; mobile: string | null }>();
    if (projectIds.length > 0) {
      const pmRows = await this.db
        .select({
          projectId: projectMember.projectId,
          displayName: userAccount.displayName,
          mobile: userAccount.mobile,
        })
        .from(projectMember)
        .innerJoin(userAccount, eq(projectMember.userId, userAccount.id))
        .where(
          and(
            inArray(projectMember.projectId, projectIds),
            eq(projectMember.roleType, 'PM'),
            eq(projectMember.status, 'ACTIVE'),
          ),
        );
      for (const pm of pmRows) pmMap.set(pm.projectId, { displayName: pm.displayName, mobile: pm.mobile });
    }

    // Batch: has file
    const policeIds = rows.map((r) => r.id!);
    const hasFileSet = new Set<number>();
    if (policeIds.length > 0) {
      const fileRows = await this.db
        .select({ bizId: fileAttachment.bizId })
        .from(fileAttachment)
        .where(
          and(
            eq(fileAttachment.bizType, 'POLICE'),
            inArray(fileAttachment.bizId, policeIds),
            eq(fileAttachment.deleted, false),
          ),
        )
        .groupBy(fileAttachment.bizId);
      for (const f of fileRows) hasFileSet.add(f.bizId);
    }

    const enriched = rows.map((row) => {
      const pm = row.projectRegisterId ? pmMap.get(row.projectRegisterId) : undefined;
      return {
        ...row,
        systemItemCount: siCountMap.get(row.projectRegisterId) ?? 0,
        pmName: pm?.displayName ?? null,
        pmMobile: pm?.mobile ?? null,
        hasFile: hasFileSet.has(row.id!),
      };
    });

    return {
      list: enriched,
      total: totalResult[0]?.total ?? 0,
      page,
      pageSize,
    };
  }

  // -----------------------------------------------------------------------
  // Single record — full project detail (aligned with ProjectDetail)
  // -----------------------------------------------------------------------
  async findById(id: number) {
    const rows = await this.db
      .select({
        id: policeRegister.id,
        projectRegisterId: policeRegister.projectRegisterId,
        status: policeRegister.status,
        createdBy: policeRegister.createdBy,
        createdAt: policeRegister.createdAt,
        updatedAt: policeRegister.updatedAt,
      })
      .from(policeRegister)
      .where(eq(policeRegister.id, id))
      .limit(1);

    if (!rows[0])
      throw new NotFoundException(`Police register #${id} not found`);

    const record = rows[0];

    // ── Project + Contract + Customer enrichment ──
    const projects = await this.db
      .select({
        applicationName: projectRegister.applicationName,
        applicationNo: projectRegister.applicationNo,
        contractYear: projectRegister.contractYear,
        contractId: projectRegister.contractId,
        remark: projectRegister.remark,
      })
      .from(projectRegister)
      .where(eq(projectRegister.id, record.projectRegisterId))
      .limit(1);

    const proj = projects[0];

    let contractNo = '';
    let contractName = '';
    let customerName = '';
    let customerUscc = '';
    let contactName = '';
    let contactPhone = '';
    let serviceContent = '';
    let contractType = '';
    let salesPersonName = '';
    let partnerName = '';
    let serviceYears: number[] = [];
    let paymentAmount: string | null = null;
    let customerAddress = '';

    if (proj?.contractId) {
      const contracts = await this.db
        .select({
          contractNo: contract.contractNo,
          contractName: contract.contractName,
          customerName: customer.fullName,
          customerUscc: customer.uscc,
          customerAddress: customer.addressDetail,
          contactName: contract.contactName,
          contactPhone: contract.contactPhone,
          serviceContent: contract.serviceContent,
          contractType: contract.contractType,
          salesPersonId: contract.salesPersonId,
          partnerName: contract.partnerName,
          serviceYears: contract.serviceYears,
          paymentAmount: contract.paymentAmount,
        })
        .from(contract)
        .leftJoin(customer, eq(contract.customerId, customer.id))
        .where(eq(contract.id, proj.contractId))
        .limit(1);

      const c = contracts[0];
      if (c) {
        contractNo = c.contractNo ?? '';
        contractName = c.contractName ?? '';
        customerName = c.customerName ?? '';
        customerUscc = c.customerUscc ?? '';
        customerAddress = c.customerAddress ?? '';
        contactName = c.contactName ?? '';
        contactPhone = c.contactPhone ?? '';
        serviceContent = c.serviceContent ?? '';
        contractType = c.contractType ?? '';
        partnerName = c.partnerName ?? '';
        serviceYears = (c.serviceYears as number[]) ?? [];
        paymentAmount = c.paymentAmount ?? null;

        if (c.salesPersonId) {
          const sp = await this.db
            .select({ displayName: userAccount.displayName })
            .from(userAccount)
            .where(eq(userAccount.id, c.salesPersonId))
            .limit(1);
          salesPersonName = sp[0]?.displayName ?? '';
        }
      }
    }

    // ── System items (full fields) ──
    const systemItems = await this.db
      .select()
      .from(projectSystemItem)
      .where(
        and(
          eq(projectSystemItem.projectRegisterId, record.projectRegisterId),
          eq(projectSystemItem.deleted, false),
        ),
      )
      .orderBy(projectSystemItem.sortOrder);

    // ── Project members (enriched: PM 第一 / 等级降序 / assignedAt 升序 + level 字段) ──
    const members = await loadProjectMembersEnriched(
      this.db,
      record.projectRegisterId,
    );
    // ── 编制人信息（独立于 members 展示） ──
    const reportWriter = await loadReportWriterInfo(
      this.db,
      record.projectRegisterId,
      members,
    );

    return {
      ...record,
      projectDetail: {
        applicationName: proj?.applicationName ?? '',
        applicationNo: proj?.applicationNo ?? '',
        contractYear: proj?.contractYear ?? null,
        contractNo,
        contractName,
        customerName,
        customerUscc,
        customerAddress,
        contactName,
        contactPhone,
        serviceContent,
        contractType,
        salesPersonName,
        partnerName,
        serviceYears,
        paymentAmount,
        systemItems,
        members,
        reportWriter,
      },
    };
  }

  // -----------------------------------------------------------------------
  // Export Excel — 14 columns, one row per system item.
  // Uses the official police import template to preserve the "导入说明"
  // sheet and header formatting required by the external police system.
  // -----------------------------------------------------------------------
  async exportExcel(id: number): Promise<{ buffer: Buffer; fileName: string }> {
    const detail = await this.findById(id);
    const pd = detail.projectDetail;

    // PM info
    const pm = pd.members.find((m) => m.roleType === 'PM');
    let pmMobile = '';
    if (pm) {
      const u = await this.db
        .select({ mobile: userAccount.mobile })
        .from(userAccount)
        .where(eq(userAccount.id, pm.userId))
        .limit(1);
      pmMobile = u[0]?.mobile ?? '';
    }

    // Assessor names (comma-separated)
    const assessorNames = pd.members
      .filter((m) => m.roleType === 'ASSESSOR')
      .map((m) => m.displayName)
      .join(',');

    // ── Load template ──
    const templatePath = path.join(
      __dirname,
      '..',
      '..',
      'assets',
      'police-export-template.xlsx',
    );
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(templatePath);

    // The template has 2 sheets: "导入说明" (keep as-is) + "信息系统" (write data)
    const ws = wb.getWorksheet('信息系统');
    if (!ws) throw new NotFoundException('模板中缺少"信息系统"工作表');

    // Template row 1 has 7 column headers. We need 14 columns total.
    // Overwrite header row with all 14 columns and apply styling.
    const headers = [
      '被测评系统名称',
      '备案证明编号',
      '安全保护等级',
      '备案机关',
      '被测评系统单位名称',
      '被测评系统单位联系人',
      '联系方式',
      '所属行业',
      '项目地址',
      '项目经理',
      '联系方式',
      '项目组成员',
      '预计测评开始时间',
      '预计测评结束时间',
    ];

    const headerRow = ws.getRow(1);
    headers.forEach((h, i) => {
      const cell = headerRow.getCell(i + 1);
      cell.value = h;
      cell.font = { bold: true, color: { argb: 'FF000000' }, size: 11 };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFD6E4F0' },
      };
      cell.alignment = {
        horizontal: 'center',
        vertical: 'middle',
        wrapText: true,
      };
      cell.border = {
        top: { style: 'thin' },
        bottom: { style: 'thin' },
        left: { style: 'thin' },
        right: { style: 'thin' },
      };
    });
    headerRow.height = 28;

    // ── Clear any template placeholder data rows (row 2+) ──
    const lastRow = ws.lastRow?.number ?? 1;
    for (let r = lastRow; r >= 2; r--) {
      ws.spliceRows(r, 1);
    }

    // ── Write data rows ──
    for (const si of pd.systemItems as any[]) {
      const row = ws.addRow([
        si.systemName ?? '',
        si.filingCertificateNo ?? '',
        si.securityLevel ?? '',
        si.filingAgency ?? '',
        si.assessedUnitName ?? '',
        si.assessedUnitContact ?? '',
        si.assessedUnitMobile ?? '',
        si.assessedUnitIndustry ?? '',
        si.assessedUnitAddress ?? '',
        pm?.displayName ?? '',
        pmMobile,
        assessorNames,
        si.requiredEntryDate ?? '',
        si.requiredReportDeliveryDate ?? '',
      ]);
      row.eachCell((cell) => {
        cell.font = { size: 11 };
        cell.alignment = { vertical: 'middle', wrapText: true };
        cell.border = {
          top: { style: 'thin' },
          bottom: { style: 'thin' },
          left: { style: 'thin' },
          right: { style: 'thin' },
        };
      });
    }

    // ── Auto column width ──
    const minWidths = [28, 22, 14, 18, 22, 14, 16, 12, 30, 12, 16, 30, 18, 18];
    minWidths.forEach((mw, idx) => {
      const colNum = idx + 1;
      let maxLen = (headers[idx] ?? '').length;
      ws.getColumn(colNum).eachCell({ includeEmpty: false }, (cell) => {
        maxLen = Math.max(maxLen, String(cell.value ?? '').length);
      });
      ws.getColumn(colNum).width = Math.min(Math.max(mw, maxLen + 2), 50);
    });

    const buf = Buffer.from(await wb.xlsx.writeBuffer());

    const today = new Date().toISOString().slice(0, 10);
    const appName = pd.applicationName || `公安登记${id}`;
    const fileName = `${appName}-公安登记-${today}.xlsx`;

    return { buffer: buf, fileName };
  }
}
