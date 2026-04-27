import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, asc, count, desc, eq, gte, ilike, inArray, lte, or, sql, SQL } from 'drizzle-orm';
import { DRIZZLE, DrizzleDB } from '../../database/database.module';
import {
  contract,
  contractGroup,
  contractPaymentRecord,
  customer,
  financeExpenseRequest,
  financeExpenseRequestSystem,
  financeInvoiceApplication,
  financeInvoiceApplicationSystem,
  partner,
  projectRegister,
  projectSystemItem,
} from '../../database/schema/business';
import { userAccount } from '../../database/schema/user';
import { QuerySettlementDto } from './dto/settlement.dto';

/**
 * 结算管理服务（纯聚合查询，无新表）。
 *
 * 数据来源：
 *   - 合同基本信息: contract
 *   - 系统列表: project_system_item where system_no IS NOT NULL
 *   - 累计开票（含审核中）: SUM(invoice.apply_amount) WHERE status='APPROVED'
 *     ⚠ 注意：结算只算 APPROVED，审核中不算入毛利
 *   - 累计回款: SUM(contract_payment_record.amount)
 *   - 合作发票金额: SUM(expense.invoice_amount) WHERE expense_type='合作费' AND status='APPROVED'
 *   - 合作付款金额: SUM(expense.request_amount) WHERE expense_type='合作费' AND status='APPROVED'
 *   - 费用合计: SUM(expense.request_amount) WHERE status='APPROVED'
 *   - 项目结算毛利: 系统金额合计 - 费用合计 (含税)
 */
@Injectable()
export class SettlementService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  // -----------------------------------------------------------------------
  // 列表（按合同组分页）
  // -----------------------------------------------------------------------
  async findGroupPage(query: QuerySettlementDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;

    // ── Step 1: 找出符合筛选的合同 ID 集合 ──
    const contractConds: SQL[] = [
      eq(contract.deleted, false),
      eq(contract.reviewStatus, 'APPROVED'),  // 结算只看已通过审核的合同
    ];

    if (query.serviceContent) {
      contractConds.push(eq(contract.serviceContent, query.serviceContent));
    }
    if (query.customerId) {
      contractConds.push(eq(contract.customerId, query.customerId));
    }
    if (query.startDate) {
      contractConds.push(gte(contract.signedAt, new Date(query.startDate)));
    }
    if (query.endDate) {
      // 包含 endDate 当天
      const endOfDay = new Date(query.endDate);
      endOfDay.setHours(23, 59, 59, 999);
      contractConds.push(lte(contract.signedAt, endOfDay));
    }

    let groupIdsFromKeyword: Set<number> | null = null;
    if (query.keyword) {
      const pattern = `%${query.keyword}%`;
      const gByName = await this.db
        .select({ id: contractGroup.id })
        .from(contractGroup)
        .where(and(eq(contractGroup.deleted, false), ilike(contractGroup.groupName, pattern)));
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

    // 含合同筛选的所有 groupIds
    const matchingContracts = await this.db
      .select({ groupId: contract.groupId })
      .from(contract)
      .where(and(...contractConds));
    const groupIdsFromContracts = new Set(matchingContracts.map(r => r.groupId));

    // 求交集
    let validGroupIds: number[];
    if (groupIdsFromKeyword !== null) {
      validGroupIds = [...groupIdsFromKeyword].filter(id => groupIdsFromContracts.has(id));
    } else {
      validGroupIds = [...groupIdsFromContracts];
    }

    if (validGroupIds.length === 0) {
      return { list: [], total: 0, page, pageSize };
    }

    // ── Step 2: 按合同组分页 ──
    const total = validGroupIds.length;

    // 按 group.created_at desc 排序后分页
    const groups = await this.db
      .select({
        id: contractGroup.id,
        groupName: contractGroup.groupName,
        remark: contractGroup.remark,
        createdAt: contractGroup.createdAt,
      })
      .from(contractGroup)
      .where(and(
        eq(contractGroup.deleted, false),
        inArray(contractGroup.id, validGroupIds),
      ))
      .orderBy(desc(contractGroup.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    if (groups.length === 0) {
      return { list: [], total, page, pageSize };
    }

    // ── Step 3: 加载分页内合同组下符合筛选的合同 + 聚合数据 ──
    const pageGroupIds = groups.map(g => g.id);
    const contracts = await this.db
      .select({
        id: contract.id,
        groupId: contract.groupId,
        contractNo: contract.contractNo,
        contractName: contract.contractName,
        serviceContent: contract.serviceContent,
        paymentAmount: contract.paymentAmount,
        signedAt: contract.signedAt,
        partnerId: contract.partnerId,
        partnerName: partner.name,
        customerId: contract.customerId,
        customerName: customer.fullName,
      })
      .from(contract)
      .leftJoin(partner, eq(partner.id, contract.partnerId))
      .leftJoin(customer, eq(customer.id, contract.customerId))
      .where(and(
        ...contractConds,
        inArray(contract.groupId, pageGroupIds),
      ));

    const contractIds = contracts.map(c => c.id);

    // 聚合各项金额（一次性把所有合同的指标算出来）
    const aggregates = await this.computeAggregates(contractIds);

    // 把合同分组挂到合同组下
    const contractsByGroup = new Map<number, any[]>();
    for (const c of contracts) {
      const agg = aggregates.get(c.id) ?? this.emptyAggregate();
      const enriched = {
        ...c,
        ...agg,
      };
      const arr = contractsByGroup.get(c.groupId) ?? [];
      arr.push(enriched);
      contractsByGroup.set(c.groupId, arr);
    }

    const list = groups.map(g => ({
      ...g,
      contracts: contractsByGroup.get(g.id) ?? [],
    }));

    return { list, total, page, pageSize };
  }

  // -----------------------------------------------------------------------
  // 单合同详情（含系统/开票/费用/回款明细）
  // -----------------------------------------------------------------------
  async findContractDetail(contractId: number) {
    const [c] = await this.db
      .select({
        id: contract.id,
        groupId: contract.groupId,
        contractNo: contract.contractNo,
        contractName: contract.contractName,
        serviceContent: contract.serviceContent,
        paymentAmount: contract.paymentAmount,
        signedAt: contract.signedAt,
        partnerId: contract.partnerId,
        partnerName: partner.name,
        customerId: contract.customerId,
        customerName: customer.fullName,
        groupName: contractGroup.groupName,
      })
      .from(contract)
      .leftJoin(partner, eq(partner.id, contract.partnerId))
      .leftJoin(customer, eq(customer.id, contract.customerId))
      .leftJoin(contractGroup, eq(contractGroup.id, contract.groupId))
      .where(and(eq(contract.id, contractId), eq(contract.deleted, false)))
      .limit(1);
    if (!c) throw new NotFoundException('合同不存在');

    const aggregates = await this.computeAggregates([contractId]);
    const agg = aggregates.get(contractId) ?? this.emptyAggregate();

    // 系统列表
    const systems = await this.db
      .select({
        id: projectSystemItem.id,
        systemNo: projectSystemItem.systemNo,
        systemName: projectSystemItem.systemName,
        securityLevel: projectSystemItem.securityLevel,
        amount: projectSystemItem.amount,
        applicationName: projectRegister.applicationName,
      })
      .from(projectSystemItem)
      .innerJoin(projectRegister, eq(projectRegister.id, projectSystemItem.projectRegisterId))
      .where(and(
        eq(projectRegister.contractId, contractId),
        eq(projectRegister.deleted, false),
        eq(projectSystemItem.deleted, false),
        sql`${projectSystemItem.systemNo} IS NOT NULL`,
      ))
      .orderBy(asc(projectRegister.id), asc(projectSystemItem.sortOrder));

    // 开票申请明细 (仅 APPROVED)
    const invoices = await this.db
      .select({
        id: financeInvoiceApplication.id,
        invoiceContent: financeInvoiceApplication.invoiceContent,
        applyAmount: financeInvoiceApplication.applyAmount,
        invoiceType: financeInvoiceApplication.invoiceType,
        taxRate: financeInvoiceApplication.taxRate,
        creatorName: userAccount.displayName,
        createdAt: financeInvoiceApplication.createdAt,
      })
      .from(financeInvoiceApplication)
      .leftJoin(userAccount, eq(userAccount.id, financeInvoiceApplication.createdBy))
      .where(and(
        eq(financeInvoiceApplication.contractId, contractId),
        eq(financeInvoiceApplication.status, 'APPROVED'),
      ))
      .orderBy(desc(financeInvoiceApplication.createdAt));

    // 费用请款明细 (仅 APPROVED)
    const expenses = await this.db
      .select({
        id: financeExpenseRequest.id,
        expenseType: financeExpenseRequest.expenseType,
        requestAmount: financeExpenseRequest.requestAmount,
        invoiceAmount: financeExpenseRequest.invoiceAmount,
        payeeName: financeExpenseRequest.payeeName,
        partnerName: financeExpenseRequest.partnerName,
        creatorName: userAccount.displayName,
        createdAt: financeExpenseRequest.createdAt,
      })
      .from(financeExpenseRequest)
      .leftJoin(userAccount, eq(userAccount.id, financeExpenseRequest.createdBy))
      .where(and(
        eq(financeExpenseRequest.contractId, contractId),
        eq(financeExpenseRequest.status, 'APPROVED'),
      ))
      .orderBy(desc(financeExpenseRequest.createdAt));

    // 回款明细
    const payments = await this.db
      .select({
        id: contractPaymentRecord.id,
        amount: contractPaymentRecord.amount,
        paidAt: contractPaymentRecord.paidAt,
        payer: contractPaymentRecord.payer,
        remark: contractPaymentRecord.remark,
        creatorName: userAccount.displayName,
        createdAt: contractPaymentRecord.createdAt,
      })
      .from(contractPaymentRecord)
      .leftJoin(userAccount, eq(userAccount.id, contractPaymentRecord.createdBy))
      .where(eq(contractPaymentRecord.contractId, contractId))
      .orderBy(desc(contractPaymentRecord.paidAt), desc(contractPaymentRecord.id));

    return {
      ...c,
      ...agg,
      systems,
      invoices,
      expenses,
      payments,
    };
  }

  // -----------------------------------------------------------------------
  // 私有: 一次性聚合多个合同的金额指标
  // -----------------------------------------------------------------------
  private async computeAggregates(contractIds: number[]) {
    const result = new Map<number, ReturnType<typeof this.emptyAggregate>>();
    if (contractIds.length === 0) return result;

    // 系统金额合计 (按合同 group)
    const systemSums = await this.db
      .select({
        contractId: projectRegister.contractId,
        total: sql<string>`COALESCE(SUM(${projectSystemItem.amount}), 0)`,
      })
      .from(projectSystemItem)
      .innerJoin(projectRegister, eq(projectRegister.id, projectSystemItem.projectRegisterId))
      .where(and(
        inArray(projectRegister.contractId, contractIds),
        eq(projectRegister.deleted, false),
        eq(projectSystemItem.deleted, false),
        sql`${projectSystemItem.systemNo} IS NOT NULL`,
      ))
      .groupBy(projectRegister.contractId);

    // 累计已开票 (仅 APPROVED)
    const invoiceSums = await this.db
      .select({
        contractId: financeInvoiceApplication.contractId,
        total: sql<string>`COALESCE(SUM(${financeInvoiceApplication.applyAmount}), 0)`,
      })
      .from(financeInvoiceApplication)
      .where(and(
        inArray(financeInvoiceApplication.contractId, contractIds),
        eq(financeInvoiceApplication.status, 'APPROVED'),
      ))
      .groupBy(financeInvoiceApplication.contractId);

    // 累计回款
    const paymentSums = await this.db
      .select({
        contractId: contractPaymentRecord.contractId,
        total: sql<string>`COALESCE(SUM(${contractPaymentRecord.amount}), 0)`,
      })
      .from(contractPaymentRecord)
      .where(inArray(contractPaymentRecord.contractId, contractIds))
      .groupBy(contractPaymentRecord.contractId);

    // 费用合计 (所有 APPROVED 费用)
    const expenseSums = await this.db
      .select({
        contractId: financeExpenseRequest.contractId,
        total: sql<string>`COALESCE(SUM(${financeExpenseRequest.requestAmount}), 0)`,
      })
      .from(financeExpenseRequest)
      .where(and(
        inArray(financeExpenseRequest.contractId, contractIds),
        eq(financeExpenseRequest.status, 'APPROVED'),
      ))
      .groupBy(financeExpenseRequest.contractId);

    // 合作费 - 发票金额 + 付款金额
    const partnerExpenseSums = await this.db
      .select({
        contractId: financeExpenseRequest.contractId,
        invoiceTotal: sql<string>`COALESCE(SUM(${financeExpenseRequest.invoiceAmount}), 0)`,
        requestTotal: sql<string>`COALESCE(SUM(${financeExpenseRequest.requestAmount}), 0)`,
      })
      .from(financeExpenseRequest)
      .where(and(
        inArray(financeExpenseRequest.contractId, contractIds),
        eq(financeExpenseRequest.status, 'APPROVED'),
        eq(financeExpenseRequest.expenseType, '合作费'),
      ))
      .groupBy(financeExpenseRequest.contractId);

    // 把所有指标合并到 contract_id → aggregate
    for (const id of contractIds) {
      result.set(id, this.emptyAggregate());
    }
    for (const r of systemSums) {
      const a = result.get(r.contractId)!;
      a.systemAmountTotal = Number(r.total);
    }
    for (const r of invoiceSums) {
      const a = result.get(r.contractId)!;
      a.invoicedTotal = Number(r.total);
    }
    for (const r of paymentSums) {
      const a = result.get(r.contractId)!;
      a.paidTotal = Number(r.total);
    }
    for (const r of expenseSums) {
      const a = result.get(r.contractId)!;
      a.expenseTotal = Number(r.total);
    }
    for (const r of partnerExpenseSums) {
      const a = result.get(r.contractId)!;
      a.partnerInvoiceTotal = Number(r.invoiceTotal);
      a.partnerPaidTotal = Number(r.requestTotal);
    }

    // 计算毛利 = 系统金额合计 - 费用合计 (含税)
    for (const a of result.values()) {
      a.grossProfit = a.systemAmountTotal - a.expenseTotal;
    }

    return result;
  }

  private emptyAggregate() {
    return {
      systemAmountTotal: 0,    // 系统金额合计
      invoicedTotal: 0,         // 累计已开票（仅 APPROVED）
      paidTotal: 0,             // 累计回款
      expenseTotal: 0,          // 费用合计（仅 APPROVED）
      partnerInvoiceTotal: 0,   // 合作发票金额
      partnerPaidTotal: 0,      // 合作付款金额
      grossProfit: 0,           // 项目结算毛利
    };
  }
}
