import { Inject, Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { eq, and, ilike, count, desc, gte, lte, SQL } from 'drizzle-orm';
import { DRIZZLE, DrizzleDB } from '../../database/database.module';
import { registrationPlatform } from '../../database/schema/business';
import { userAccount } from '../../database/schema/user';
import { CreatePlatformDto, UpdatePlatformDto, QueryPlatformDto } from './dto/platform.dto';

@Injectable()
export class PlatformService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async findPage(query: QueryPlatformDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

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

    const whereClause = and(...conditions)!;

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

    // Enrich with creator name
    const enriched = await Promise.all(
      rows.map(async (row) => {
        let creatorName: string | null = null;
        if (row.createdBy) {
          const users = await this.db
            .select({ displayName: userAccount.displayName })
            .from(userAccount)
            .where(eq(userAccount.id, row.createdBy))
            .limit(1);
          creatorName = users[0]?.displayName ?? null;
        }
        return { ...row, creatorName };
      }),
    );

    return { list: enriched, total: totalResult[0]?.total ?? 0, page, pageSize };
  }

  // Export: same as findPage but no pagination
  async findAll(query: QueryPlatformDto) {
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

    const rows = await this.db
      .select()
      .from(registrationPlatform)
      .where(and(...conditions)!)
      .orderBy(desc(registrationPlatform.createdAt), desc(registrationPlatform.id));

    const enriched = await Promise.all(
      rows.map(async (row) => {
        let creatorName: string | null = null;
        if (row.createdBy) {
          const users = await this.db
            .select({ displayName: userAccount.displayName })
            .from(userAccount)
            .where(eq(userAccount.id, row.createdBy))
            .limit(1);
          creatorName = users[0]?.displayName ?? null;
        }
        return { ...row, creatorName };
      }),
    );

    return enriched;
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
        caExpireDate: dto.caExpireDate || null,
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
