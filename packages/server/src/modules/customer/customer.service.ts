import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { eq, and, or, ilike, count, desc, SQL } from 'drizzle-orm';
import { DRIZZLE, DrizzleDB } from '../../database/database.module';
import { customer } from '../../database/schema/business';
import { fieldChangeLog } from '../../database/schema/common';
import {
  CreateCustomerDto,
  UpdateCustomerDto,
  QueryCustomerDto,
} from './dto/customer.dto';

@Injectable()
export class CustomerService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  // -----------------------------------------------------------------------
  // Paginated list
  // -----------------------------------------------------------------------
  async findPage(query: QueryCustomerDto, _currentUserId: number) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    let whereClause: SQL;
    if (query.keyword) {
      const pattern = `%${query.keyword}%`;
      whereClause = and(
        eq(customer.deleted, false),
        or(
          ilike(customer.fullName, pattern),
          ilike(customer.contactName, pattern),
        ),
      )!;
    } else {
      whereClause = eq(customer.deleted, false);
    }

    const [totalResult, rows] = await Promise.all([
      this.db
        .select({ total: count() })
        .from(customer)
        .where(whereClause),
      this.db
        .select()
        .from(customer)
        .where(whereClause)
        .orderBy(desc(customer.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
    ]);

    return {
      list: rows,
      total: totalResult[0]?.total ?? 0,
      page,
      pageSize,
    };
  }

  // -----------------------------------------------------------------------
  // Single record
  // -----------------------------------------------------------------------
  async findById(id: number) {
    const rows = await this.db
      .select()
      .from(customer)
      .where(and(eq(customer.id, id), eq(customer.deleted, false)))
      .limit(1);

    if (!rows[0]) {
      throw new NotFoundException(`Customer #${id} not found`);
    }

    return rows[0];
  }

  // -----------------------------------------------------------------------
  // Create
  // -----------------------------------------------------------------------
  async create(dto: CreateCustomerDto, userId: number) {
    const result = await this.db
      .insert(customer)
      .values({
        fullName: dto.fullName,
        industry: dto.industry ?? null,
        region: dto.region ?? null,
        addressDetail: dto.addressDetail ?? null,
        uscc: dto.uscc ?? null,
        contactName: dto.contactName ?? null,
        mobilePhone: dto.mobilePhone ?? null,
        isGovernment: dto.isGovernment ?? false,
        remark: dto.remark ?? null,
        createdBy: userId,
      })
      .returning();

    return result[0];
  }

  // -----------------------------------------------------------------------
  // Update
  // -----------------------------------------------------------------------
  async update(id: number, dto: UpdateCustomerDto, userId: number) {
    const oldRecord = await this.findById(id);

    const result = await this.db
      .update(customer)
      .set({
        ...dto,
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(eq(customer.id, id))
      .returning();

    // Audit trail — log changed fields
    await this.logFieldChanges(
      'customer',
      id,
      oldRecord as unknown as Record<string, unknown>,
      dto as unknown as Record<string, unknown>,
      userId,
    );

    return result[0];
  }

  // -----------------------------------------------------------------------
  // Soft-delete (creator only)
  // -----------------------------------------------------------------------
  async remove(id: number, userId: number) {
    const record = await this.findById(id);

    if (record.createdBy !== userId) {
      throw new ForbiddenException('Only the creator can delete this customer');
    }

    await this.db
      .update(customer)
      .set({
        deleted: true,
        deletedAt: new Date(),
      })
      .where(eq(customer.id, id));
  }

  // -----------------------------------------------------------------------
  // Reusable audit-diff helper
  // -----------------------------------------------------------------------
  private async logFieldChanges(
    bizType: string,
    bizId: number,
    oldRecord: Record<string, unknown>,
    newValues: Record<string, unknown>,
    operatorId: number,
  ) {
    const entries: {
      bizType: string;
      bizId: number;
      fieldName: string;
      oldValue: string | null;
      newValue: string | null;
      operatorId: number;
    }[] = [];

    for (const key of Object.keys(newValues)) {
      if (newValues[key] === undefined) continue;

      const oldVal = oldRecord[key];
      const newVal = newValues[key];

      if (String(oldVal ?? '') !== String(newVal ?? '')) {
        entries.push({
          bizType,
          bizId,
          fieldName: key,
          oldValue: oldVal != null ? String(oldVal) : null,
          newValue: newVal != null ? String(newVal) : null,
          operatorId,
        });
      }
    }

    if (entries.length > 0) {
      await this.db.insert(fieldChangeLog).values(entries);
    }
  }
}
