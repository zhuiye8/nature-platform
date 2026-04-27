import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, asc, count, desc, eq, ilike, inArray, or, SQL } from 'drizzle-orm';
import { DRIZZLE, DrizzleDB } from '../../database/database.module';
import {
  contract,
  customer,
  financeExpenseRequest,
  financeExpenseRequestSystem,
  partner,
  projectRegister,
  projectSystemItem,
} from '../../database/schema/business';
import { userAccount } from '../../database/schema/user';
import { userRole } from '../../database/schema/iam';
import { wfInstance, wfTask } from '../../database/schema/workflow';
import { WorkflowService } from '../workflow/workflow.service';
import {
  CreateExpenseDto,
  EXPENSE_TYPES,
  QueryExpenseDto,
  ReviewExpenseDto,
  UpdateExpenseDto,
} from './dto/expense.dto';

const DEF_KEY = 'FIN_EXPENSE';
const DEPT_NODE = 'FIN_EXPENSE_DEPT_REVIEW';
const FIN_NODE = 'FIN_EXPENSE_FIN_REVIEW';

/**
 * 费用请款服务。
 *
 * 状态机:
 *   DRAFT --submit--> SUBMITTED
 *     SUBMITTED --(部门 APPROVE)--> DEPT_APPROVED
 *     SUBMITTED --(部门 REJECT)---> REJECTED
 *   DEPT_APPROVED --(财务 APPROVE)--> APPROVED
 *   DEPT_APPROVED --(财务 REJECT)---> REJECTED
 *   REJECTED --edit+submit--> SUBMITTED (启动新 wf_instance, roundNo+1)
 *
 * 特殊业务规则:
 *   - 差旅费 (expenseType='差旅费'): invoiceType / taxRate / invoiceAmount 可空
 *   - 合作费 (expenseType='合作费'): partner_* 字段必填 (service 层校验)
 *   - 银行账号格式: ^\d{10,30}$ (DTO 层校验)
 *   - 系统金额只展示，不允许修改 (与开票申请的 amount 字段共用)
 */
@Injectable()
export class ExpenseService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly workflowService: WorkflowService,
  ) {}

  // -----------------------------------------------------------------------
  // 数据可见性
  // -----------------------------------------------------------------------
  private async getRoleCodes(userId: number) {
    const rows = await this.db
      .select({ roleCode: userRole.roleCode })
      .from(userRole)
      .where(eq(userRole.userId, userId));
    return rows.map((r) => r.roleCode);
  }

  // -----------------------------------------------------------------------
  // 业务校验: 差旅费/合作费特殊规则
  // -----------------------------------------------------------------------
  private validateBusinessRules(dto: CreateExpenseDto | UpdateExpenseDto) {
    if (!(EXPENSE_TYPES as readonly string[]).includes(dto.expenseType)) {
      throw new BadRequestException(`未知的费用类型: ${dto.expenseType}`);
    }
    if (dto.expenseType === '合作费') {
      if (!dto.partnerName || !dto.partnerAmount || !dto.partnerInvoiceType || !dto.partnerTaxRate) {
        throw new BadRequestException(
          '合作费请款时，合作方信息（名称/合同金额/发票类型/发票税率）必填',
        );
      }
    }
    // 差旅费: invoiceType/taxRate/invoiceAmount 可为空，无额外校验
  }

  // -----------------------------------------------------------------------
  // 创建 (DRAFT, 不启动 workflow)
  // -----------------------------------------------------------------------
  async create(dto: CreateExpenseDto, userId: number) {
    if (dto.systems.length === 0) {
      throw new BadRequestException('请至少选择一个系统');
    }
    this.validateBusinessRules(dto);

    // 校验合同存在 + 已 APPROVED
    const [c] = await this.db
      .select({ id: contract.id, reviewStatus: contract.reviewStatus })
      .from(contract)
      .where(and(eq(contract.id, dto.contractId), eq(contract.deleted, false)))
      .limit(1);
    if (!c) throw new NotFoundException('合同不存在');
    if (c.reviewStatus !== 'APPROVED') {
      throw new BadRequestException('只能为已审核通过的合同创建费用请款');
    }

    await this.assertSystemsBelongToContract(
      dto.systems.map((s) => s.systemId),
      dto.contractId,
    );

    return this.db.transaction(async (tx) => {
      const [app] = await tx
        .insert(financeExpenseRequest)
        .values({
          contractId: dto.contractId,
          expenseType: dto.expenseType,
          requestAmount: dto.requestAmount.toFixed(2),
          invoiceType: dto.invoiceType ?? null,
          taxRate: dto.taxRate ?? null,
          invoiceAmount: dto.invoiceAmount != null ? dto.invoiceAmount.toFixed(2) : null,
          payeeName: dto.payeeName,
          payeeBank: dto.payeeBank,
          payeeAccount: dto.payeeAccount,
          partnerId: dto.partnerId ?? null,
          partnerName: dto.partnerName ?? null,
          partnerAmount: dto.partnerAmount != null ? dto.partnerAmount.toFixed(2) : null,
          partnerInvoiceType: dto.partnerInvoiceType ?? null,
          partnerTaxRate: dto.partnerTaxRate ?? null,
          remark: dto.remark ?? null,
          status: 'DRAFT',
          createdBy: userId,
          updatedBy: userId,
        })
        .returning();

      await tx.insert(financeExpenseRequestSystem).values(
        dto.systems.map((s) => ({
          expenseRequestId: app.id,
          projectSystemItemId: s.systemId,
        })),
      );

      return app;
    });
  }

  // -----------------------------------------------------------------------
  // 编辑 (DRAFT/REJECTED 且本人，或 super_admin)
  // -----------------------------------------------------------------------
  async update(id: number, dto: UpdateExpenseDto, userId: number) {
    const [app] = await this.db
      .select()
      .from(financeExpenseRequest)
      .where(eq(financeExpenseRequest.id, id))
      .limit(1);
    if (!app) throw new NotFoundException('费用请款不存在');

    if (app.createdBy !== userId) {
      const roles = await this.getRoleCodes(userId);
      if (!roles.includes('super_admin')) {
        throw new ForbiddenException('只能编辑自己创建的费用请款');
      }
    }
    if (app.status !== 'DRAFT' && app.status !== 'REJECTED') {
      throw new BadRequestException('当前状态不可编辑');
    }

    if (dto.systems.length === 0) {
      throw new BadRequestException('请至少选择一个系统');
    }
    this.validateBusinessRules(dto);
    await this.assertSystemsBelongToContract(
      dto.systems.map((s) => s.systemId),
      dto.contractId,
    );

    return this.db.transaction(async (tx) => {
      // 重写关联表
      await tx
        .delete(financeExpenseRequestSystem)
        .where(eq(financeExpenseRequestSystem.expenseRequestId, id));
      await tx.insert(financeExpenseRequestSystem).values(
        dto.systems.map((s) => ({
          expenseRequestId: id,
          projectSystemItemId: s.systemId,
        })),
      );

      // REJECTED 编辑后回到 DRAFT
      const newStatus = app.status === 'REJECTED' ? 'DRAFT' : app.status;

      const [updated] = await tx
        .update(financeExpenseRequest)
        .set({
          contractId: dto.contractId,
          expenseType: dto.expenseType,
          requestAmount: dto.requestAmount.toFixed(2),
          invoiceType: dto.invoiceType ?? null,
          taxRate: dto.taxRate ?? null,
          invoiceAmount: dto.invoiceAmount != null ? dto.invoiceAmount.toFixed(2) : null,
          payeeName: dto.payeeName,
          payeeBank: dto.payeeBank,
          payeeAccount: dto.payeeAccount,
          partnerId: dto.partnerId ?? null,
          partnerName: dto.partnerName ?? null,
          partnerAmount: dto.partnerAmount != null ? dto.partnerAmount.toFixed(2) : null,
          partnerInvoiceType: dto.partnerInvoiceType ?? null,
          partnerTaxRate: dto.partnerTaxRate ?? null,
          remark: dto.remark ?? null,
          status: newStatus,
          updatedBy: userId,
          updatedAt: new Date(),
        })
        .where(eq(financeExpenseRequest.id, id))
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
      .from(financeExpenseRequest)
      .where(eq(financeExpenseRequest.id, id))
      .limit(1);
    if (!app) throw new NotFoundException('费用请款不存在');
    if (app.status !== 'DRAFT') {
      throw new BadRequestException('只有草稿状态可以提交');
    }
    if (app.createdBy !== userId) {
      const roles = await this.getRoleCodes(userId);
      if (!roles.includes('super_admin')) {
        throw new ForbiddenException('只能提交自己创建的费用请款');
      }
    }

    await this.workflowService.startInstance(
      DEF_KEY,
      'EXPENSE',
      id,
      userId,
      { requestAmount: app.requestAmount, contractId: app.contractId },
    );

    await this.db
      .update(financeExpenseRequest)
      .set({ status: 'SUBMITTED', updatedBy: userId, updatedAt: new Date() })
      .where(eq(financeExpenseRequest.id, id));

    return { success: true };
  }

  // -----------------------------------------------------------------------
  // 审核 (部门负责人 / 财务)
  // -----------------------------------------------------------------------
  async review(id: number, dto: ReviewExpenseDto, userId: number) {
    const [app] = await this.db
      .select()
      .from(financeExpenseRequest)
      .where(eq(financeExpenseRequest.id, id))
      .limit(1);
    if (!app) throw new NotFoundException('费用请款不存在');

    // 找到当前 wf_instance + 待审核 task
    const [inst] = await this.db
      .select({ id: wfInstance.id, currentNode: wfInstance.currentNode })
      .from(wfInstance)
      .where(
        and(
          eq(wfInstance.bizType, 'EXPENSE'),
          eq(wfInstance.bizId, id),
          eq(wfInstance.status, 'RUNNING'),
        ),
      )
      .limit(1);
    if (!inst) throw new BadRequestException('找不到运行中的工作流实例');

    const roles = await this.getRoleCodes(userId);
    const isSuperAdmin = roles.includes('super_admin');
    const isDeptManager = roles.includes('dept_manager');
    const isFinance = roles.includes('finance');

    // 校验审核权限是否匹配当前节点
    if (inst.currentNode === DEPT_NODE) {
      if (app.status !== 'SUBMITTED') {
        throw new BadRequestException('当前状态不可审核');
      }
      if (!isDeptManager && !isSuperAdmin) {
        throw new ForbiddenException('当前节点仅部门负责人可审核');
      }
    } else if (inst.currentNode === FIN_NODE) {
      if (app.status !== 'DEPT_APPROVED') {
        throw new BadRequestException('当前状态不可审核');
      }
      if (!isFinance && !isSuperAdmin) {
        throw new ForbiddenException('当前节点仅财务可审核');
      }
    } else {
      throw new BadRequestException(`未知的审核节点: ${inst.currentNode}`);
    }

    const [task] = await this.db
      .select({ id: wfTask.id })
      .from(wfTask)
      .where(
        and(
          eq(wfTask.instanceId, inst.id),
          eq(wfTask.nodeKey, inst.currentNode),
          eq(wfTask.status, 'PENDING'),
        ),
      )
      .limit(1);
    if (!task) throw new BadRequestException('找不到待审核任务');

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
      .from(financeExpenseRequest)
      .where(eq(financeExpenseRequest.id, id))
      .limit(1);
    if (!app) throw new NotFoundException('费用请款不存在');
    if (app.status !== 'DRAFT') {
      throw new BadRequestException('只有草稿状态可以删除');
    }
    if (app.createdBy !== userId) {
      const roles = await this.getRoleCodes(userId);
      if (!roles.includes('super_admin')) {
        throw new ForbiddenException('只能删除自己创建的费用请款');
      }
    }

    return this.db.transaction(async (tx) => {
      await tx
        .delete(financeExpenseRequestSystem)
        .where(eq(financeExpenseRequestSystem.expenseRequestId, id));
      await tx
        .delete(financeExpenseRequest)
        .where(eq(financeExpenseRequest.id, id));
      return { success: true };
    });
  }

  // -----------------------------------------------------------------------
  // 详情
  // -----------------------------------------------------------------------
  async findById(id: number, _userId: number) {
    const [app] = await this.db
      .select({
        id: financeExpenseRequest.id,
        contractId: financeExpenseRequest.contractId,
        expenseType: financeExpenseRequest.expenseType,
        requestAmount: financeExpenseRequest.requestAmount,
        invoiceType: financeExpenseRequest.invoiceType,
        taxRate: financeExpenseRequest.taxRate,
        invoiceAmount: financeExpenseRequest.invoiceAmount,
        payeeName: financeExpenseRequest.payeeName,
        payeeBank: financeExpenseRequest.payeeBank,
        payeeAccount: financeExpenseRequest.payeeAccount,
        partnerId: financeExpenseRequest.partnerId,
        partnerName: financeExpenseRequest.partnerName,
        partnerAmount: financeExpenseRequest.partnerAmount,
        partnerInvoiceType: financeExpenseRequest.partnerInvoiceType,
        partnerTaxRate: financeExpenseRequest.partnerTaxRate,
        remark: financeExpenseRequest.remark,
        status: financeExpenseRequest.status,
        createdBy: financeExpenseRequest.createdBy,
        createdAt: financeExpenseRequest.createdAt,
        updatedAt: financeExpenseRequest.updatedAt,
        creatorName: userAccount.displayName,
        contractNo: contract.contractNo,
        contractName: contract.contractName,
        contractAmount: contract.paymentAmount,
        contractInvoiceType: contract.invoiceType,
        contractTaxRate: contract.taxRate,
        serviceContent: contract.serviceContent,
        customerId: contract.customerId,
        customerName: customer.fullName,
      })
      .from(financeExpenseRequest)
      .leftJoin(contract, eq(contract.id, financeExpenseRequest.contractId))
      .leftJoin(customer, eq(customer.id, contract.customerId))
      .leftJoin(userAccount, eq(userAccount.id, financeExpenseRequest.createdBy))
      .where(eq(financeExpenseRequest.id, id))
      .limit(1);

    if (!app) throw new NotFoundException('费用请款不存在');

    const systems = await this.db
      .select({
        id: projectSystemItem.id,
        systemNo: projectSystemItem.systemNo,
        systemName: projectSystemItem.systemName,
        securityLevel: projectSystemItem.securityLevel,
        amount: projectSystemItem.amount,
        applicationName: projectRegister.applicationName,
      })
      .from(financeExpenseRequestSystem)
      .innerJoin(
        projectSystemItem,
        eq(projectSystemItem.id, financeExpenseRequestSystem.projectSystemItemId),
      )
      .innerJoin(
        projectRegister,
        eq(projectRegister.id, projectSystemItem.projectRegisterId),
      )
      .where(eq(financeExpenseRequestSystem.expenseRequestId, id))
      .orderBy(asc(projectSystemItem.sortOrder));

    return { ...app, systems };
  }

  // -----------------------------------------------------------------------
  // 列表 (按可见性)
  //   super_admin / chairman / finance: 全部
  //   dept_manager: 状态 != DRAFT 的所有 (即提交过的) — 因为他要审核
  //   其它角色: 自己创建的
  // -----------------------------------------------------------------------
  async findPage(query: QueryExpenseDto, userId: number) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10;

    const roleCodes = await this.getRoleCodes(userId);
    const isSuperAdmin = roleCodes.includes('super_admin');
    const isChairman = roleCodes.includes('chairman');
    const hasFinance = roleCodes.includes('finance');
    const hasDeptManager = roleCodes.includes('dept_manager');

    const conditions: SQL[] = [];

    if (!isSuperAdmin && !isChairman && !hasFinance) {
      if (hasDeptManager) {
        // 部门经理: 看所有非 DRAFT (即提交过的)
        conditions.push(
          or(
            eq(financeExpenseRequest.createdBy, userId),
            inArray(financeExpenseRequest.status, ['SUBMITTED', 'DEPT_APPROVED', 'APPROVED', 'REJECTED']),
          )!,
        );
      } else {
        // 普通用户: 只看自己创建的
        conditions.push(eq(financeExpenseRequest.createdBy, userId));
      }
    }

    if (query.status) {
      conditions.push(eq(financeExpenseRequest.status, query.status));
    }
    if (query.expenseType) {
      conditions.push(eq(financeExpenseRequest.expenseType, query.expenseType));
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
      .from(financeExpenseRequest)
      .leftJoin(contract, eq(contract.id, financeExpenseRequest.contractId))
      .where(whereClause);

    const list = await this.db
      .select({
        id: financeExpenseRequest.id,
        contractId: financeExpenseRequest.contractId,
        contractNo: contract.contractNo,
        contractName: contract.contractName,
        serviceContent: contract.serviceContent,
        expenseType: financeExpenseRequest.expenseType,
        requestAmount: financeExpenseRequest.requestAmount,
        invoiceAmount: financeExpenseRequest.invoiceAmount,
        status: financeExpenseRequest.status,
        createdBy: financeExpenseRequest.createdBy,
        creatorName: userAccount.displayName,
        createdAt: financeExpenseRequest.createdAt,
        updatedAt: financeExpenseRequest.updatedAt,
      })
      .from(financeExpenseRequest)
      .leftJoin(contract, eq(contract.id, financeExpenseRequest.contractId))
      .leftJoin(userAccount, eq(userAccount.id, financeExpenseRequest.createdBy))
      .where(whereClause)
      .orderBy(desc(financeExpenseRequest.createdAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize);

    return { list, total: Number(total), page, pageSize };
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
