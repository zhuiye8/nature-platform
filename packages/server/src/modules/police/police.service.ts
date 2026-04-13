import {
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { eq, and, or, ilike, count, desc, SQL } from 'drizzle-orm';
import * as XLSX from 'xlsx';
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
    const isPoliceRole = roleCodes.includes('police_register');

    let visibleProjectIds: number[] | null = null;
    if (!isSuperAdmin && !isPoliceRole) {
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

    const enriched = await Promise.all(
      rows.map(async (row) => {
        // System item count
        const siCount = await this.db
          .select({ total: count() })
          .from(projectSystemItem)
          .where(
            and(
              eq(projectSystemItem.projectRegisterId, row.projectRegisterId),
              eq(projectSystemItem.deleted, false),
            ),
          );
        const systemItemCount = siCount[0]?.total ?? 0;

        // PM name + mobile
        let pmName: string | null = null;
        let pmMobile: string | null = null;
        if (row.projectRegisterId) {
          const pmRows = await this.db
            .select({
              displayName: userAccount.displayName,
              mobile: userAccount.mobile,
            })
            .from(projectMember)
            .innerJoin(userAccount, eq(projectMember.userId, userAccount.id))
            .where(
              and(
                eq(projectMember.projectId, row.projectRegisterId),
                eq(projectMember.roleType, 'PM'),
                eq(projectMember.status, 'ACTIVE'),
              ),
            )
            .limit(1);
          pmName = pmRows[0]?.displayName ?? null;
          pmMobile = pmRows[0]?.mobile ?? null;
        }

        // Has file
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

        return {
          ...row,
          systemItemCount,
          pmName,
          pmMobile,
          hasFile,
        };
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

    // ── Project members ──
    const members = await this.db
      .select({
        id: projectMember.id,
        userId: projectMember.userId,
        roleType: projectMember.roleType,
        status: projectMember.status,
        assignedAt: projectMember.assignedAt,
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
      },
    };
  }

  // -----------------------------------------------------------------------
  // Export Excel — one row per system item, 14 columns
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

    // Assessor names
    const assessorNames = pd.members
      .filter((m) => m.roleType === 'ASSESSOR')
      .map((m) => m.displayName)
      .join(',');

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

    const dataRows = pd.systemItems.map((si: any) => [
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

    const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '信息系统');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const today = new Date().toISOString().slice(0, 10);
    const appName = pd.applicationName || `公安登记${id}`;
    const fileName = `${appName}-公安登记-${today}.xlsx`;

    return { buffer: buf, fileName };
  }
}
