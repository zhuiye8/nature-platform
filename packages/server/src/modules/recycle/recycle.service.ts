import {
  Inject,
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { eq, and, count, desc, SQL } from 'drizzle-orm';
import { DRIZZLE, DrizzleDB } from '../../database/database.module';
import { recycleBin } from '../../database/schema/common';
import { contract } from '../../database/schema/business';
import { projectRegister } from '../../database/schema/business';
import { QueryRecycleDto } from './dto/recycle.dto';

@Injectable()
export class RecycleService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  // -----------------------------------------------------------------------
  // Paginated list
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

    return { list: rows, total: totalResult[0]?.total ?? 0, page, pageSize };
  }

  // -----------------------------------------------------------------------
  // Restore
  // -----------------------------------------------------------------------
  async restore(id: number) {
    const rows = await this.db
      .select()
      .from(recycleBin)
      .where(eq(recycleBin.id, id))
      .limit(1);

    if (!rows[0]) throw new NotFoundException(`Recycle bin record #${id} not found`);
    const record = rows[0];

    if (record.bizType === 'CONTRACT') {
      await this.db
        .update(contract)
        .set({ deleted: false, deletedAt: null })
        .where(eq(contract.id, record.bizId));
    } else if (record.bizType === 'PROJECT_REGISTER') {
      // Check uniqueness before restoring
      const existing = await this.db
        .select({ id: projectRegister.id })
        .from(projectRegister)
        .where(
          and(
            eq(projectRegister.contractId, (record.snapshotJson as any)?.contractId),
            eq(projectRegister.contractYear, (record.snapshotJson as any)?.contractYear),
            eq(projectRegister.deleted, false),
          ),
        )
        .limit(1);

      if (existing.length > 0) {
        throw new BadRequestException(
          '恢复失败：已存在相同合同+年份的项目登记记录',
        );
      }

      await this.db
        .update(projectRegister)
        .set({ deleted: false, deletedAt: null })
        .where(eq(projectRegister.id, record.bizId));
    }

    // Remove from recycle bin
    await this.db.delete(recycleBin).where(eq(recycleBin.id, id));
    return { success: true };
  }

  // -----------------------------------------------------------------------
  // Permanent delete (remove recovery option)
  // -----------------------------------------------------------------------
  async permanentDelete(id: number) {
    const rows = await this.db
      .select()
      .from(recycleBin)
      .where(eq(recycleBin.id, id))
      .limit(1);

    if (!rows[0]) throw new NotFoundException(`Recycle bin record #${id} not found`);

    await this.db.delete(recycleBin).where(eq(recycleBin.id, id));
    return { success: true };
  }
}
