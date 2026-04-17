import { Inject, Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { eq, and, ilike, count, desc, gte, lte, inArray, SQL } from 'drizzle-orm';
import { DRIZZLE, DrizzleDB } from '../../database/database.module';
import { registrationPlatform } from '../../database/schema/business';
import { userAccount } from '../../database/schema/user';
import { CreatePlatformDto, UpdatePlatformDto, QueryPlatformDto } from './dto/platform.dto';

@Injectable()
export class PlatformService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  private buildConditions(query: QueryPlatformDto): SQL[] {
    const conditions: SQL[] = [eq(registrationPlatform.deleted, false)];
    if (query.platformName) {
      conditions.push(ilike(registrationPlatform.platformName, `%${query.platformName}%`));
    }
    if (query.websiteUrl) {
      conditions.push(ilike(registrationPlatform.websiteUrl, `%${query.websiteUrl}%`));
    }
    if (query.hasCa === 'true') {
      conditions.push(eq(registrationPlatform.hasCa, true));
    } else if (query.hasCa === 'false') {
      conditions.push(eq(registrationPlatform.hasCa, false));
    }
    if (query.caExpireDateFrom) {
      conditions.push(gte(registrationPlatform.caExpireDate, query.caExpireDateFrom));
    }
    if (query.caExpireDateTo) {
      conditions.push(lte(registrationPlatform.caExpireDate, query.caExpireDateTo));
    }
    if (query.createdByUserId) {
      conditions.push(eq(registrationPlatform.createdBy, query.createdByUserId));
    }
    return conditions;
  }

  private async batchResolveUserNames(ids: number[]): Promise<Map<number, string>> {
    const map = new Map<number, string>();
    if (ids.length === 0) return map;
    const users = await this.db
      .select({ id: userAccount.id, displayName: userAccount.displayName })
      .from(userAccount)
      .where(inArray(userAccount.id, ids));
    for (const u of users) map.set(u.id, u.displayName);
    return map;
  }

  async findPage(query: QueryPlatformDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const whereClause = and(...this.buildConditions(query))!;

    const [totalResult, rows] = await Promise.all([
      this.db.select({ total: count() }).from(registrationPlatform).where(whereClause),
      this.db
        .select()
        .from(registrationPlatform)
        .where(whereClause)
        .orderBy(desc(registrationPlatform.createdAt), desc(registrationPlatform.id))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
    ]);

    const creatorIds = [...new Set(rows.map((r) => r.createdBy).filter(Boolean))] as number[];
    const nameMap = await this.batchResolveUserNames(creatorIds);
    const enriched = rows.map((row) => ({
      ...row,
      creatorName: (row.createdBy && nameMap.get(row.createdBy)) ?? null,
    }));

    return { list: enriched, total: totalResult[0]?.total ?? 0, page, pageSize };
  }

  // Export: same as findPage but no pagination
  async findAll(query: QueryPlatformDto) {
    const rows = await this.db
      .select()
      .from(registrationPlatform)
      .where(and(...this.buildConditions(query))!)
      .orderBy(desc(registrationPlatform.createdAt), desc(registrationPlatform.id));

    const creatorIds = [...new Set(rows.map((r) => r.createdBy).filter(Boolean))] as number[];
    const nameMap = await this.batchResolveUserNames(creatorIds);
    return rows.map((row) => ({
      ...row,
      creatorName: (row.createdBy && nameMap.get(row.createdBy)) ?? null,
    }));
  }

  async findById(id: number) {
    const rows = await this.db
      .select()
      .from(registrationPlatform)
      .where(and(eq(registrationPlatform.id, id), eq(registrationPlatform.deleted, false)))
      .limit(1);
    if (!rows[0]) throw new NotFoundException('平台记录不存在');
    return rows[0];
  }

  async create(dto: CreatePlatformDto, userId: number) {
    const result = await this.db
      .insert(registrationPlatform)
      .values({
        platformName: dto.platformName ?? null,
        websiteUrl: dto.websiteUrl ?? null,
        account: dto.account ?? null,
        password: dto.password ?? null,
        hasCa: dto.hasCa ?? false,
        caExpireDate: dto.caExpireDate ?? null,
        caPassword: dto.caPassword ?? null,
        contactName: dto.contactName ?? null,
        contactPhone: dto.contactPhone ?? null,
        remark: dto.remark ?? null,
        createdBy: userId,
      })
      .returning();
    return result[0];
  }

  async update(id: number, dto: UpdatePlatformDto, userId: number) {
    await this.findById(id);
    const result = await this.db
      .update(registrationPlatform)
      .set({
        platformName: dto.platformName ?? null,
        websiteUrl: dto.websiteUrl ?? null,
        account: dto.account ?? null,
        password: dto.password ?? null,
        hasCa: dto.hasCa ?? false,
        caExpireDate: dto.caExpireDate ?? null,
        caPassword: dto.caPassword ?? null,
        contactName: dto.contactName ?? null,
        contactPhone: dto.contactPhone ?? null,
        remark: dto.remark ?? null,
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(eq(registrationPlatform.id, id))
      .returning();
    return result[0];
  }

  async remove(id: number) {
    await this.findById(id);
    await this.db
      .update(registrationPlatform)
      .set({ deleted: true, deletedAt: new Date() })
      .where(eq(registrationPlatform.id, id));
  }

  // Batch import
  async batchCreate(items: CreatePlatformDto[], userId: number) {
    if (items.length === 0) return { count: 0 };
    await this.db.insert(registrationPlatform).values(
      items.map((dto) => ({
        platformName: dto.platformName ?? null,
        websiteUrl: dto.websiteUrl ?? null,
        account: dto.account ?? null,
        password: dto.password ?? null,
        hasCa: dto.hasCa ?? false,
        caExpireDate: dto.caExpireDate ?? null,
        caPassword: dto.caPassword ?? null,
        contactName: dto.contactName ?? null,
        contactPhone: dto.contactPhone ?? null,
        remark: dto.remark ?? null,
        createdBy: userId,
      })),
    );
    return { count: items.length };
  }
}
