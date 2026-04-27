import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, count, desc, eq, ilike, inArray, ne, or, sql, SQL } from 'drizzle-orm';
import { DRIZZLE, DrizzleDB } from '../../database/database.module';
import {
  contract,
  contractPaymentRecord,
  financeInvoiceApplication,
  financeInvoiceApplicationSystem,
  projectRegister,
  projectSystemItem,
  customer,
} from '../../database/schema/business';
import { userAccount } from '../../database/schema/user';
import { userRole } from '../../database/schema/iam';
import { wfInstance, wfTask } from '../../database/schema/workflow';
import { WorkflowService } from '../workflow/workflow.service';
import {
  CreateInvoiceDto,
  QueryInvoiceDto,
  ReviewInvoiceDto,
  UpdateInvoiceDto,
} from './dto/invoice.dto';

const REVIEW_NODE_KEY = 'FIN_INVOICE_REVIEW';
const DEF_KEY = 'FIN_INVOICE';

/**
 * 开票申请服务。
 *
 * 状态机:
 *   DRAFT --submit-->  SUBMITTED  --APPROVE--> APPROVED  ("已开票")
 *                                  --REJECT---> REJECTED  ("需修改")
 *   REJECTED --update--> DRAFT --submit--> SUBMITTED  (启动新 wf_instance, roundNo+1)
 *
 * 关键规则:
 *   - 累计校验 (Q3 严格模式): sum(SUBMITTED + APPROVED) + 当前 ≤ contract.payment_amount
 *   - 系统金额必填 (每个勾选的系统都要填 amount, 同步回写 project_system_item.amount)
 *   - 系统必须 system_no IS NOT NULL (已通过项目登记审批)
 */
@Injectable()
export class InvoiceService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly workflowService: WorkflowService,
  ) {}

  // -----------------------------------------------------------------------
  // 数据可见性辅助
  // -----------------------------------------------------------------------
  private async getRoleCodes(userId: number) {
    const rows = await this.db
      .select({ roleCode: userRole.roleCode })
      .from(userRole)
      .where(eq(userRole.userId, userId));
    return rows.map((r) => r.roleCode);
  }

  // -----------------------------------------------------------------------
  // 创建 (DRAFT, 不启动 workflow)
  // -----------------------------------------------------------------------
  async create(dto: CreateInvoiceDto, userId: number) {
    if (dto.systems.length === 0) {
      throw new BadRequestException('请至少选择一个系统');
    }

    // 校验合同存在 + 已 APPROVED
    const [c] = await this.db
      .select({
        id: contract.id,
        reviewStatus: contract.reviewStatus,
        paymentAmount: contract.paymentAmount,
      })
      .from(contract)
      .where(and(eq(contract.id, dto.contractId), eq(contract.deleted, false)))
      .limit(1);
    if (!c) throw new NotFoundException('合同不存在');
    if (c.reviewStatus !== 'APPROVED') {
      throw new BadRequestException('只能为已审核通过的合同创建开票申请');
    }

    // 校验系统都属于该合同 + system_no IS NOT NULL
    await this.assertSystemsBelongToContract(
      dto.systems.map((s) => s.systemId),
      dto.contractId,
    );

    // 校验：合同下所有系统金额合计 ≤ 合同金额（写入 project_system_item.amount 前）
    await this.assertSystemAmountsTotal(
      dto.contractId,
      dto.systems.map((s) => ({ systemId: s.systemId, amount: s.amount })),
      Number(c.paymentAmount ?? 0),
    );

    return this.db.transaction(async (tx) => {
      // 1. 回写 project_system_item.amount
      for (const s of dto.systems) {
        await tx
          .update(projectSystemItem)
          .set({ amount: s.amount.toFixed(2), updatedAt: new Date() })
          .where(eq(projectSystemItem.id, s.systemId));
      }

      // 2. 写主表
      const [app] = await tx
        .insert(financeInvoiceApplication)
        .values({
          contractId: dto.contractId,
          invoiceContent: dto.invoiceContent,
          applyAmount: dto.applyAmount.toFixed(2),
          invoiceType: dto.invoiceType,
          taxRate: dto.taxRate,
          description: dto.description ?? null,
          remark: dto.remark ?? null,
          status: 'DRAFT',
          createdBy: userId,
          updatedBy: userId,
        })
        .returning();

      // 3. 写关联表
      await tx.insert(financeInvoiceApplicationSystem).values(
        dto.systems.map((s) => ({
          invoiceApplicationId: app.id,
          projectSystemItemId: s.systemId,
        })),
      );

      return app;
    });
  }

  // -----------------------------------------------------------------------
  // 编辑 (仅 DRAFT/REJECTED 且本人)
  // -----------------------------------------------------------------------
  async update(id: number, dto: UpdateInvoiceDto, userId: number) {
    const [app] = await this.db
      .select()
      .from(financeInvoiceApplication)
      .where(eq(financeInvoiceApplication.id, id))
      .limit(1);
    if (!app) throw new NotFoundException('开票申请不存在');
    if (app.createdBy !== userId) {
      const roles = await this.getRoleCodes(userId);
      if (!roles.includes('super_admin')) {
        throw new ForbiddenException('只能编辑自己创建的开票申请');
      }
    }
    if (app.status !== 'DRAFT' && app.status !== 'REJECTED') {
      throw new BadRequestException('当前状态不可编辑');
    }

    if (dto.systems.length === 0) {
      throw new BadRequestException('请至少选择一个系统');
    }
    await this.assertSystemsBelongToContract(
      dto.systems.map((s) => s.systemId),
      dto.contractId,
    );

    // 校验：合同下所有系统金额合计 ≤ 合同金额
    const [contractRow] = await this.db
      .select({ paymentAmount: contract.paymentAmount })
      .from(contract)
      .where(eq(contract.id, dto.contractId))
      .limit(1);
    await this.assertSystemAmountsTotal(
      dto.contractId,
      dto.systems.map((s) => ({ systemId: s.systemId, amount: s.amount })),
      Number(contractRow?.paymentAmount ?? 0),
    );

    return this.db.transaction(async (tx) => {
      for (const s of dto.systems) {
        await tx
          .update(projectSystemItem)
          .set({ amount: s.amount.toFixed(2), updatedAt: new Date() })
          .where(eq(projectSystemItem.id, s.systemId));
      }

      // 重写关联表
      await tx
        .delete(financeInvoiceApplicationSystem)
        .where(eq(financeInvoiceApplicationSystem.invoiceApplicationId, id));
      await tx.insert(financeInvoiceApplicationSystem).values(
        dto.systems.map((s) => ({
          invoiceApplicationId: id,
          projectSystemItemId: s.systemId,
        })),
      );

      // REJECTED 编辑后回到 DRAFT，等待重新提交
      const newStatus = app.status === 'REJECTED' ? 'DRAFT' : app.status;

      const [updated] = await tx
        .update(financeInvoiceApplication)
        .set({
          contractId: dto.contractId,
          invoiceContent: dto.invoiceContent,
          applyAmount: dto.applyAmount.toFixed(2),
          invoiceType: dto.invoiceType,
          taxRate: dto.taxRate,
          description: dto.description ?? null,
          remark: dto.remark ?? null,
          status: newStatus,
          updatedBy: userId,
          updatedAt: new Date(),
        })
        .where(eq(financeInvoiceApplication.id, id))
        .returning();

      return updated;
    });
  }

  // -----------------------------------------------------------------------
  // 提交审核 (DRAFT → SUBMITTED + 启动 wf_instance)
  // -----------------------------------------------------------------------
  async submit(id: number, userId: number) {
    const [app] = await this.db
      .select()
      .from(financeInvoiceApplication)
      .where(eq(financeInvoiceApplication.id, id))
      .limit(1);
    if (!app) throw new NotFoundException('开票申请不存在');
    if (app.status !== 'DRAFT') {
      throw new BadRequestException('只有草稿状态可以提交');
    }
    if (app.createdBy !== userId) {
      const roles = await this.getRoleCodes(userId);
      if (!roles.includes('super_admin')) {
        throw new ForbiddenException('只能提交自己创建的开票申请');
      }
    }

    // 累计校验 (严格模式: SUBMITTED + APPROVED 都计入)
    await this.assertCumulativeAmount(app.contractId, Number(app.applyAmount), id);

    // 启动新工作流实例 (REJECTED→编辑→DRAFT→提交 也走这里, 每次提交都启动新 wf_instance)
    await this.workflowService.startInstance(
      DEF_KEY,
      'INVOICE',
      id,
      userId,
      { applyAmount: app.applyAmount, contractId: app.contractId },
    );

    await this.db
      .update(financeInvoiceApplication)
      .set({ status: 'SUBMITTED', updatedBy: userId, updatedAt: new Date() })
      .where(eq(financeInvoiceApplication.id, id));

    return { success: true };
  }

  // -----------------------------------------------------------------------
  // 审核 (财务: APPROVE → 已开票 / REJECT → 需修改)
  // -----------------------------------------------------------------------
  async review(id: number, dto: ReviewInvoiceDto, userId: number) {
    const [app] = await this.db
      .select()
      .from(financeInvoiceApplication)
      .where(eq(financeInvoiceApplication.id, id))
      .limit(1);
    if (!app) throw new NotFoundException('开票申请不存在');
    if (app.status !== 'SUBMITTED') {
      throw new BadRequestException('当前状态不可审核');
    }

    const roles = await this.getRoleCodes(userId);
    if (!roles.includes('finance') && !roles.includes('super_admin')) {
      throw new ForbiddenException('仅财务可审核开票申请');
    }

    if (dto.action !== 'APPROVE' && dto.action !== 'REJECT') {
      throw new BadRequestException('action 必须是 APPROVE 或 REJECT');
    }

    // 找到当前 wf_instance + 待审核的 task
    const [inst] = await this.db
      .select({ id: wfInstance.id })
      .from(wfInstance)
      .where(
        and(
          eq(wfInstance.bizType, 'INVOICE'),
          eq(wfInstance.bizId, id),
          eq(wfInstance.status, 'RUNNING'),
        ),
      )
      .limit(1);
    if (!inst) {
      throw new BadRequestException('找不到运行中的工作流实例');
    }

    const [task] = await this.db
      .select({ id: wfTask.id })
      .from(wfTask)
      .where(
        and(
          eq(wfTask.instanceId, inst.id),
          eq(wfTask.nodeKey, REVIEW_NODE_KEY),
          eq(wfTask.status, 'PENDING'),
        ),
      )
      .limit(1);
    if (!task) {
      throw new BadRequestException('找不到待审核任务');
    }

    // 通过工作流引擎 signal (会触发 listener 更新业务表 status + 通知)
    await this.workflowService.signal(
      inst.id,
      task.id,
      dto.action,
      dto.remark ?? null,
      userId,
    );

    return { success: true };
  }

  // -----------------------------------------------------------------------
  // 删除 (仅 DRAFT, 仅本人/super_admin)
  // -----------------------------------------------------------------------
  async remove(id: number, userId: number) {
    const [app] = await this.db
      .select()
      .from(financeInvoiceApplication)
      .where(eq(financeInvoiceApplication.id, id))
      .limit(1);
    if (!app) throw new NotFoundException('开票申请不存在');
    if (app.status !== 'DRAFT') {
      throw new BadRequestException('只有草稿状态可以删除');
    }
    if (app.createdBy !== userId) {
      const roles = await this.getRoleCodes(userId);
      if (!roles.includes('super_admin')) {
        throw new ForbiddenException('只能删除自己创建的开票申请');
      }
    }

    return this.db.transaction(async (tx) => {
      await tx
        .delete(financeInvoiceApplicationSystem)
        .where(eq(financeInvoiceApplicationSystem.invoiceApplicationId, id));
      await tx
        .delete(financeInvoiceApplication)
        .where(eq(financeInvoiceApplication.id, id));
      return { success: true };
    });
  }

  // -----------------------------------------------------------------------
  // 详情
  // -----------------------------------------------------------------------
  async findById(id: number, userId: number) {
    const [app] = await this.db
      .select({
        id: financeInvoiceApplication.id,
        contractId: financeInvoiceApplication.contractId,
        invoiceContent: financeInvoiceApplication.invoiceContent,
        applyAmount: financeInvoiceApplication.applyAmount,
        invoiceType: financeInvoiceApplication.invoiceType,
        taxRate: financeInvoiceApplication.taxRate,
        description: financeInvoiceApplication.description,
        remark: financeInvoiceApplication.remark,
        status: financeInvoiceApplication.status,
        createdBy: financeInvoiceApplication.createdBy,
        createdAt: financeInvoiceApplication.createdAt,
        updatedAt: financeInvoiceApplication.updatedAt,
        creatorName: userAccount.displayName,
        // 合同信息
        contractNo: contract.contractNo,
        contractName: contract.contractName,
        contractAmount: contract.paymentAmount,
        contractInvoiceType: contract.invoiceType,
        contractTaxRate: contract.taxRate,
        serviceContent: contract.serviceContent,
        customerId: contract.customerId,
        customerName: customer.fullName,
      })
      .from(financeInvoiceApplication)
      .leftJoin(contract, eq(contract.id, financeInvoiceApplication.contractId))
      .leftJoin(customer, eq(customer.id, contract.customerId))
      .leftJoin(userAccount, eq(userAccount.id, financeInvoiceApplication.createdBy))
      .where(eq(financeInvoiceApplication.id, id))
      .limit(1);

    if (!app) throw new NotFoundException('开票申请不存在');

    // 关联系统列表
    const systems = await this.db
      .select({
        id: projectSystemItem.id,
        systemNo: projectSystemItem.systemNo,
        systemName: projectSystemItem.systemName,
        securityLevel: projectSystemItem.securityLevel,
        amount: projectSystemItem.amount,
        applicationName: projectRegister.applicationName,
      })
      .from(financeInvoiceApplicationSystem)
      .innerJoin(
        projectSystemItem,
        eq(projectSystemItem.id, financeInvoiceApplicationSystem.projectSystemItemId),
      )
      .innerJoin(
        projectRegister,
        eq(projectRegister.id, projectSystemItem.projectRegisterId),
      )
      .where(eq(financeInvoiceApplicationSystem.invoiceApplicationId, id))
      .orderBy(asc(projectSystemItem.sortOrder));

    // 累计信息（同合同）
    const cumulative = await this.computeCumulative(app.contractId);

    return {
      ...app,
      systems,
      cumulative,
    };
  }

  // -----------------------------------------------------------------------
  // 列表 (按可见性过滤)
  // -----------------------------------------------------------------------
  async findPage(query: QueryInvoiceDto, userId: number) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const roleCodes = await this.getRoleCodes(userId);
    const isSuperAdmin = roleCodes.includes('super_admin');
    const isChairman = roleCodes.includes('chairman');
    const hasFinance = roleCodes.includes('finance');

    const conditions: SQL[] = [];

    if (!isSuperAdmin && !isChairman && !hasFinance) {
      // 其它角色只看自己创建的
      conditions.push(eq(financeInvoiceApplication.createdBy, userId));
    }

    if (query.status) {
      conditions.push(eq(financeInvoiceApplication.status, query.status));
    }
    if (query.serviceContent) {
      conditions.push(eq(contract.serviceContent, query.serviceContent));
    }
    if (query.keyword) {
      conditions.push(
        or(
          ilike(contract.contractName, `%${query.keyword}%`),
          ilike(contract.contractNo, `%${query.keyword}%`),
        )!,
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [{ total }] = await this.db
      .select({ total: count() })
      .from(financeInvoiceApplication)
      .leftJoin(contract, eq(contract.id, financeInvoiceApplication.contractId))
      .where(whereClause);

    const list = await this.db
      .select({
        id: financeInvoiceApplication.id,
        contractId: financeInvoiceApplication.contractId,
        contractNo: contract.contractNo,
        contractName: contract.contractName,
        serviceContent: contract.serviceContent,
        applyAmount: financeInvoiceApplication.applyAmount,
        invoiceType: financeInvoiceApplication.invoiceType,
        taxRate: financeInvoiceApplication.taxRate,
        status: financeInvoiceApplication.status,
        createdBy: financeInvoiceApplication.createdBy,
        creatorName: userAccount.displayName,
        createdAt: financeInvoiceApplication.createdAt,
        updatedAt: financeInvoiceApplication.updatedAt,
      })
      .from(financeInvoiceApplication)
      .leftJoin(contract, eq(contract.id, financeInvoiceApplication.contractId))
      .leftJoin(userAccount, eq(userAccount.id, financeInvoiceApplication.createdBy))
      .where(whereClause)
      .orderBy(desc(financeInvoiceApplication.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    return { list, total: Number(total), page, pageSize };
  }

  // -----------------------------------------------------------------------
  // 私有: 累计校验
  // -----------------------------------------------------------------------
  private async assertCumulativeAmount(
    contractId: number,
    currentAmount: number,
    excludeId: number,
  ) {
    const [c] = await this.db
      .select({ paymentAmount: contract.paymentAmount })
      .from(contract)
      .where(eq(contract.id, contractId))
      .limit(1);
    if (!c) throw new NotFoundException('合同不存在');

    const [{ used }] = await this.db
      .select({ used: sql<string>`COALESCE(SUM(apply_amount), 0)` })
      .from(financeInvoiceApplication)
      .where(
        and(
          eq(financeInvoiceApplication.contractId, contractId),
          inArray(financeInvoiceApplication.status, ['SUBMITTED', 'APPROVED']),
          ne(financeInvoiceApplication.id, excludeId),
        ),
      );

    const usedNum = Number(used);
    const contractAmount = c.paymentAmount ? Number(c.paymentAmount) : 0;
    if (usedNum + currentAmount > contractAmount) {
      throw new BadRequestException(
        `累计开票金额 (${(usedNum + currentAmount).toFixed(2)}) 超过合同金额 (${contractAmount.toFixed(2)})`,
      );
    }
  }

  // -----------------------------------------------------------------------
  // 私有: 累计信息 (列表/详情显示用)
  // -----------------------------------------------------------------------
  private async computeCumulative(contractId: number) {
    const [c] = await this.db
      .select({ paymentAmount: contract.paymentAmount })
      .from(contract)
      .where(eq(contract.id, contractId))
      .limit(1);

    const [invoice] = await this.db
      .select({
        used: sql<string>`COALESCE(SUM(apply_amount), 0)`,
      })
      .from(financeInvoiceApplication)
      .where(
        and(
          eq(financeInvoiceApplication.contractId, contractId),
          inArray(financeInvoiceApplication.status, ['SUBMITTED', 'APPROVED']),
        ),
      );

    const [paid] = await this.db
      .select({
        total: sql<string>`COALESCE(SUM(amount), 0)`,
      })
      .from(contractPaymentRecord)
      .where(eq(contractPaymentRecord.contractId, contractId));

    const contractAmount = c?.paymentAmount ? Number(c.paymentAmount) : 0;
    const usedInvoice = Number(invoice?.used ?? 0);
    const totalPaid = Number(paid?.total ?? 0);
    return {
      contractAmount,
      invoicedTotal: usedInvoice,        // 前期已开票（含审核中）
      paidTotal: totalPaid,               // 前期已回款
      remainingInvoice: Math.max(contractAmount - usedInvoice, 0),
    };
  }

  // -----------------------------------------------------------------------
  // 私有: 校验合同下所有系统金额合计 ≤ 合同金额
  //
  // 防止用户在系统金额栏填超额（例如合同 1 万，2 个系统各填 8 千 = 1.6 万 > 合同金额）。
  // 计算方式：合同下其他系统的现有 amount + 本次提交的新 amount 合计 ≤ 合同金额。
  // -----------------------------------------------------------------------
  private async assertSystemAmountsTotal(
    contractId: number,
    submittedSystems: { systemId: number; amount: number }[],
    contractAmount: number,
  ) {
    if (contractAmount <= 0) return; // 合同金额未填则跳过此校验

    const submittedSet = new Set(submittedSystems.map((s) => s.systemId));
    const submittedTotal = submittedSystems.reduce((sum, s) => sum + s.amount, 0);

    // 合同下"未在本次提交里的"其他系统的现有 amount 合计
    const otherSystems = await this.db
      .select({
        id: projectSystemItem.id,
        amount: projectSystemItem.amount,
      })
      .from(projectSystemItem)
      .innerJoin(
        projectRegister,
        eq(projectRegister.id, projectSystemItem.projectRegisterId),
      )
      .where(
        and(
          eq(projectRegister.contractId, contractId),
          eq(projectRegister.deleted, false),
          eq(projectSystemItem.deleted, false),
          sql`${projectSystemItem.systemNo} IS NOT NULL`,
        ),
      );

    const otherTotal = otherSystems
      .filter((s) => !submittedSet.has(s.id))
      .reduce((sum, s) => sum + Number(s.amount ?? 0), 0);

    const total = otherTotal + submittedTotal;
    if (total > contractAmount) {
      throw new BadRequestException(
        `合同下所有系统金额合计 (${total.toFixed(2)}) 超过合同金额 (${contractAmount.toFixed(2)})，请调整系统金额`,
      );
    }
  }

  // -----------------------------------------------------------------------
  // 私有: 校验系统都属于该合同 + system_no IS NOT NULL
  // -----------------------------------------------------------------------
  private async assertSystemsBelongToContract(
    systemIds: number[],
    contractId: number,
  ) {
    if (systemIds.length === 0) return;
    const rows = await this.db
      .select({
        id: projectSystemItem.id,
        systemNo: projectSystemItem.systemNo,
        contractId: projectRegister.contractId,
      })
      .from(projectSystemItem)
      .innerJoin(
        projectRegister,
        eq(projectRegister.id, projectSystemItem.projectRegisterId),
      )
      .where(inArray(projectSystemItem.id, systemIds));

    if (rows.length !== systemIds.length) {
      throw new BadRequestException('部分系统不存在');
    }
    for (const r of rows) {
      if (r.contractId !== contractId) {
        throw new BadRequestException(
          `系统 #${r.id} 不属于合同 #${contractId}`,
        );
      }
      if (!r.systemNo) {
        throw new BadRequestException(
          `系统 #${r.id} 项目登记尚未审批通过 (无项目编号)`,
        );
      }
    }
  }
}
