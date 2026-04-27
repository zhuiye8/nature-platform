import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { and, desc, eq, sql } from 'drizzle-orm';
import { DRIZZLE, DrizzleDB } from '../../database/database.module';
import { contract, contractPaymentRecord } from '../../database/schema/business';
import { userAccount } from '../../database/schema/user';
import { userRole } from '../../database/schema/iam';
import { CreatePaymentRecordDto } from './dto/payment-record.dto';

/**
 * 回款明细服务。
 *
 * 设计要点:
 *   - 编辑入口仅在合同财务详情页，service 接收的 contractId 来自 URL 参数
 *   - 回款日期必须 ≤ today (BadRequestException)
 *   - 创建后事务内重新计算 contract.payment_status:
 *       sum(amount) >= contract.payment_amount → PAID
 *       sum(amount) > 0                         → PARTIAL
 *       否则                                     → UNPAID
 *   - 列表只读 + 留痕 (created_by + created_at)，不允许编辑
 */
@Injectable()
export class PaymentRecordService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  // -----------------------------------------------------------------------
  // 创建回款记录
  // -----------------------------------------------------------------------
  async create(contractId: number, dto: CreatePaymentRecordDto, userId: number) {
    // 1. 校验合同存在
    const [c] = await this.db
      .select({ id: contract.id, paymentAmount: contract.paymentAmount })
      .from(contract)
      .where(and(eq(contract.id, contractId), eq(contract.deleted, false)))
      .limit(1);

    if (!c) throw new NotFoundException('合同不存在');

    // 2. 校验回款日期 ≤ today
    const paidAt = new Date(dto.paidAt);
    const today = new Date();
    today.setHours(23, 59, 59, 999); // 当天结束
    if (paidAt > today) {
      throw new BadRequestException('回款日期不能晚于今天');
    }

    // 3. 事务: 插入 + 重新计算 paymentStatus
    return this.db.transaction(async (tx) => {
      const [created] = await tx
        .insert(contractPaymentRecord)
        .values({
          contractId,
          amount: dto.amount.toFixed(2),
          paidAt: dto.paidAt,
          payer: dto.payer ?? null,
          remark: dto.remark ?? null,
          createdBy: userId,
        })
        .returning();

      // 累计回款
      const [{ total }] = await tx
        .select({ total: sql<string>`COALESCE(SUM(amount), 0)` })
        .from(contractPaymentRecord)
        .where(eq(contractPaymentRecord.contractId, contractId));

      const totalPaid = Number(total);
      const contractAmount = c.paymentAmount ? Number(c.paymentAmount) : 0;

      let newStatus = 'UNPAID';
      if (contractAmount > 0 && totalPaid >= contractAmount) {
        newStatus = 'PAID';
      } else if (totalPaid > 0) {
        newStatus = 'PARTIAL';
      }

      await tx
        .update(contract)
        .set({ paymentStatus: newStatus, updatedAt: new Date() })
        .where(eq(contract.id, contractId));

      return created;
    });
  }

  // -----------------------------------------------------------------------
  // 列表 (按合同；含累计回款汇总)
  // -----------------------------------------------------------------------
  async findByContract(contractId: number, currentUserId: number) {
    // 注：访问权限由调用方/Guard 控制；这里只做合同存在性校验
    const [c] = await this.db
      .select({ id: contract.id, paymentAmount: contract.paymentAmount })
      .from(contract)
      .where(and(eq(contract.id, contractId), eq(contract.deleted, false)))
      .limit(1);
    if (!c) throw new NotFoundException('合同不存在');

    const records = await this.db
      .select({
        id: contractPaymentRecord.id,
        contractId: contractPaymentRecord.contractId,
        amount: contractPaymentRecord.amount,
        paidAt: contractPaymentRecord.paidAt,
        payer: contractPaymentRecord.payer,
        remark: contractPaymentRecord.remark,
        createdBy: contractPaymentRecord.createdBy,
        createdAt: contractPaymentRecord.createdAt,
        creatorName: userAccount.displayName,
      })
      .from(contractPaymentRecord)
      .leftJoin(userAccount, eq(userAccount.id, contractPaymentRecord.createdBy))
      .where(eq(contractPaymentRecord.contractId, contractId))
      .orderBy(desc(contractPaymentRecord.paidAt), desc(contractPaymentRecord.id));

    const totalPaid = records.reduce((sum, r) => sum + Number(r.amount), 0);
    const contractAmount = c.paymentAmount ? Number(c.paymentAmount) : 0;
    const remaining = Math.max(contractAmount - totalPaid, 0);

    return {
      list: records,
      summary: {
        contractAmount,
        totalPaid,
        remaining,
      },
    };
  }

  // -----------------------------------------------------------------------
  // 删除 (仅 super_admin；用于改正错录)
  // -----------------------------------------------------------------------
  async remove(contractId: number, recordId: number, currentUserId: number) {
    const roles = await this.db
      .select({ roleCode: userRole.roleCode })
      .from(userRole)
      .where(eq(userRole.userId, currentUserId));
    if (!roles.some((r) => r.roleCode === 'super_admin')) {
      throw new BadRequestException('仅超级管理员可删除回款记录');
    }

    return this.db.transaction(async (tx) => {
      await tx
        .delete(contractPaymentRecord)
        .where(
          and(
            eq(contractPaymentRecord.id, recordId),
            eq(contractPaymentRecord.contractId, contractId),
          ),
        );

      // 重算 paymentStatus
      const [c] = await tx
        .select({ paymentAmount: contract.paymentAmount })
        .from(contract)
        .where(eq(contract.id, contractId))
        .limit(1);
      const [{ total }] = await tx
        .select({ total: sql<string>`COALESCE(SUM(amount), 0)` })
        .from(contractPaymentRecord)
        .where(eq(contractPaymentRecord.contractId, contractId));

      const totalPaid = Number(total);
      const contractAmount = c?.paymentAmount ? Number(c.paymentAmount) : 0;
      let newStatus = 'UNPAID';
      if (contractAmount > 0 && totalPaid >= contractAmount) newStatus = 'PAID';
      else if (totalPaid > 0) newStatus = 'PARTIAL';

      await tx
        .update(contract)
        .set({ paymentStatus: newStatus, updatedAt: new Date() })
        .where(eq(contract.id, contractId));

      return { success: true };
    });
  }
}
