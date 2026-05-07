import {
  Inject,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { eq, and, count, desc, inArray, SQL } from 'drizzle-orm';
import { DRIZZLE, DrizzleDB } from '../../database/database.module';
import { recycleBin } from '../../database/schema/common';
import {
  contract,
  contractGroup,
  contractSystemItem,
  projectRegister,
  projectSystemItem,
  registrationPlatform,
} from '../../database/schema/business';
import { userAccount } from '../../database/schema/user';
import { QueryRecycleDto } from './dto/recycle.dto';

// 业务类型枚举（与前端约定）
export type RecycleBizType =
  | 'CONTRACT'
  | 'CONTRACT_GROUP'
  | 'PROJECT_REGISTER'
  | 'PLATFORM';

// softDelete 入参
export interface SoftDeleteOptions {
  bizType: RecycleBizType;
  bizId: number;
  /** 列表展示名（如 contractName / groupName / applicationName / "P-0001 测试平台"）*/
  displayName: string | null;
  /** 完整快照（用于审计 + 未来可能的字段对比）*/
  snapshot: unknown;
  userId: number;
  /** 业务侧定义的"打 deleted=true"动作（含连带子记录），与写 recycle_bin 同事务执行 */
  applyDelete: (tx: any) => Promise<void>;
}

@Injectable()
export class RecycleService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  // -----------------------------------------------------------------------
  // 通用软删除入口 — 业务侧应统一调用此方法
  // 事务内执行：业务 applyDelete 动作 + 写 recycle_bin
  // -----------------------------------------------------------------------
  async softDelete(opts: SoftDeleteOptions): Promise<void> {
    await this.db.transaction(async (tx) => {
      await opts.applyDelete(tx);
      await tx.insert(recycleBin).values({
        bizType: opts.bizType,
        bizId: opts.bizId,
        displayName: opts.displayName,
        snapshotJson: opts.snapshot as any,
        deletedBy: opts.userId,
      });
    });
  }

  // -----------------------------------------------------------------------
  // 列表（含 deletedByName 用户名 enrich）
  // -----------------------------------------------------------------------
  async findPage(query: QueryRecycleDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const conditions: SQL[] = [];
    if (query.bizType) {
      conditions.push(eq(recycleBin.bizType, query.bizType));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [totalResult, rows] = await Promise.all([
      this.db.select({ total: count() }).from(recycleBin).where(whereClause),
      this.db
        .select()
        .from(recycleBin)
        .where(whereClause)
        .orderBy(desc(recycleBin.deletedAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
    ]);

    // Enrich deletedByName
    const ids = [...new Set(rows.map((r) => r.deletedBy))];
    const userMap = new Map<number, string>();
    if (ids.length > 0) {
      const users = await this.db
        .select({ id: userAccount.id, displayName: userAccount.displayName })
        .from(userAccount)
        .where(inArray(userAccount.id, ids));
      for (const u of users) userMap.set(u.id, u.displayName);
    }
    const enriched = rows.map((row) => ({
      ...row,
      deletedByName: userMap.get(row.deletedBy) ?? null,
    }));

    return { list: enriched, total: totalResult[0]?.total ?? 0, page, pageSize };
  }

  // -----------------------------------------------------------------------
  // 恢复 — 业务表 deleted=false + 删 recycle_bin 记录
  // 含子记录连带恢复 + 唯一性校验
  // -----------------------------------------------------------------------
  async restore(id: number) {
    const [record] = await this.db
      .select()
      .from(recycleBin)
      .where(eq(recycleBin.id, id))
      .limit(1);
    if (!record) throw new NotFoundException(`回收站记录 #${id} 不存在`);

    await this.db.transaction(async (tx) => {
      switch (record.bizType as RecycleBizType) {
        case 'CONTRACT': {
          // 唯一性校验：合同编号冲突
          const snap = record.snapshotJson as any;
          if (snap?.contractNo) {
            const conflict = await tx
              .select({ id: contract.id })
              .from(contract)
              .where(
                and(eq(contract.contractNo, snap.contractNo), eq(contract.deleted, false)),
              )
              .limit(1);
            if (conflict.length > 0) {
              throw new BadRequestException(
                `恢复失败：合同编号 ${snap.contractNo} 已存在`,
              );
            }
          }
          await tx
            .update(contract)
            .set({ deleted: false, deletedAt: null })
            .where(eq(contract.id, record.bizId));
          // 连带恢复子记录（系统明细）
          await tx
            .update(contractSystemItem)
            .set({ deleted: false })
            .where(eq(contractSystemItem.contractId, record.bizId));
          break;
        }
        case 'CONTRACT_GROUP': {
          await tx
            .update(contractGroup)
            .set({ deleted: false, deletedAt: null })
            .where(eq(contractGroup.id, record.bizId));
          break;
        }
        case 'PROJECT_REGISTER': {
          // 唯一性校验：合同+年份不能与现有项目冲突
          const snap = record.snapshotJson as any;
          if (snap?.contractId && snap?.contractYear) {
            const conflict = await tx
              .select({ id: projectRegister.id })
              .from(projectRegister)
              .where(
                and(
                  eq(projectRegister.contractId, snap.contractId),
                  eq(projectRegister.contractYear, snap.contractYear),
                  eq(projectRegister.deleted, false),
                ),
              )
              .limit(1);
            if (conflict.length > 0) {
              throw new BadRequestException(
                '恢复失败：已存在相同合同+年份的项目登记记录',
              );
            }
          }
          await tx
            .update(projectRegister)
            .set({ deleted: false, deletedAt: null })
            .where(eq(projectRegister.id, record.bizId));
          // 连带恢复子记录（系统明细）
          await tx
            .update(projectSystemItem)
            .set({ deleted: false })
            .where(eq(projectSystemItem.projectRegisterId, record.bizId));
          break;
        }
        case 'PLATFORM': {
          await tx
            .update(registrationPlatform)
            .set({ deleted: false, deletedAt: null })
            .where(eq(registrationPlatform.id, record.bizId));
          break;
        }
        default:
          throw new BadRequestException(`不支持的业务类型: ${record.bizType}`);
      }

      await tx.delete(recycleBin).where(eq(recycleBin.id, id));
    });

    return { success: true };
  }

  // -----------------------------------------------------------------------
  // 永久删除 — 物理 DELETE 原表 + 删 recycle_bin 记录
  // 不会释放主键 ID（PG sequence 单调递增）
  // -----------------------------------------------------------------------
  async permanentDelete(id: number) {
    const [record] = await this.db
      .select()
      .from(recycleBin)
      .where(eq(recycleBin.id, id))
      .limit(1);
    if (!record) throw new NotFoundException(`回收站记录 #${id} 不存在`);

    await this.db.transaction(async (tx) => {
      switch (record.bizType as RecycleBizType) {
        case 'CONTRACT': {
          // 子记录先删
          await tx
            .delete(contractSystemItem)
            .where(eq(contractSystemItem.contractId, record.bizId));
          await tx.delete(contract).where(eq(contract.id, record.bizId));
          break;
        }
        case 'CONTRACT_GROUP': {
          await tx.delete(contractGroup).where(eq(contractGroup.id, record.bizId));
          break;
        }
        case 'PROJECT_REGISTER': {
          await tx
            .delete(projectSystemItem)
            .where(eq(projectSystemItem.projectRegisterId, record.bizId));
          await tx
            .delete(projectRegister)
            .where(eq(projectRegister.id, record.bizId));
          break;
        }
        case 'PLATFORM': {
          await tx
            .delete(registrationPlatform)
            .where(eq(registrationPlatform.id, record.bizId));
          break;
        }
        default:
          throw new BadRequestException(`不支持的业务类型: ${record.bizType}`);
      }

      await tx.delete(recycleBin).where(eq(recycleBin.id, id));
    });

    return { success: true };
  }
}
