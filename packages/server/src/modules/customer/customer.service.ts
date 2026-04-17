import {
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { eq, and, or, ilike, count, desc, SQL, asc } from 'drizzle-orm';
import { DRIZZLE, DrizzleDB } from '../../database/database.module';
import { customer, customerContact } from '../../database/schema/business';
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
  async findPage(query: QueryCustomerDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    let whereClause: SQL;
    if (query.keyword) {
      const pattern = `%${query.keyword}%`;
      whereClause = and(
        eq(customer.deleted, false),
        ilike(customer.fullName, pattern),
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

    // Batch-load contacts for all customers
    const customerIds = rows.map((r) => r.id);
    const contacts = customerIds.length > 0
      ? await this.db
          .select()
          .from(customerContact)
          .where(
            or(...customerIds.map((id) => eq(customerContact.customerId, id)))!,
          )
          .orderBy(asc(customerContact.sortOrder))
      : [];

    const contactsByCustomerId = new Map<number, typeof contacts>();
    for (const c of contacts) {
      const arr = contactsByCustomerId.get(c.customerId) || [];
      arr.push(c);
      contactsByCustomerId.set(c.customerId, arr);
    }

    const list = rows.map((r) => ({
      ...r,
      contacts: contactsByCustomerId.get(r.id) || [],
    }));

    return {
      list,
      total: totalResult[0]?.total ?? 0,
      page,
      pageSize,
    };
  }

  // -----------------------------------------------------------------------
  // Single record with contacts
  // -----------------------------------------------------------------------
  async findById(id: number) {
    const rows = await this.db
      .select()
      .from(customer)
      .where(and(eq(customer.id, id), eq(customer.deleted, false)))
      .limit(1);

    if (!rows[0]) {
      throw new NotFoundException(`客户不存在`);
    }

    const contacts = await this.db
      .select()
      .from(customerContact)
      .where(eq(customerContact.customerId, id))
      .orderBy(asc(customerContact.sortOrder));

    return { ...rows[0], contacts };
  }

  // -----------------------------------------------------------------------
  // Get contacts for a specific customer (used by contract form)
  // -----------------------------------------------------------------------
  async findContacts(customerId: number) {
    return this.db
      .select()
      .from(customerContact)
      .where(eq(customerContact.customerId, customerId))
      .orderBy(asc(customerContact.sortOrder));
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
        isGovernment: dto.isGovernment ?? false,
        remark: dto.remark ?? null,
        createdBy: userId,
      })
      .returning();

    const created = result[0];

    // Insert contacts
    if (dto.contacts && dto.contacts.length > 0) {
      await this.db.insert(customerContact).values(
        dto.contacts.map((c, i) => ({
          customerId: created.id,
          contactName: c.contactName,
          contactPhone: c.contactPhone ?? null,
          position: c.position ?? null,
          remark: c.remark ?? null,
          sortOrder: i,
        })),
      );
    }

    return this.findById(created.id);
  }

  // -----------------------------------------------------------------------
  // Update
  // -----------------------------------------------------------------------
  async update(id: number, dto: UpdateCustomerDto, userId: number) {
    const oldRecord = await this.findById(id);

    const { contacts, ...customerFields } = dto;

    const result = await this.db
      .update(customer)
      .set({
        ...customerFields,
        updatedBy: userId,
        updatedAt: new Date(),
      })
      .where(eq(customer.id, id))
      .returning();

    // Replace contacts: delete all then re-insert
    if (contacts !== undefined) {
      await this.db
        .delete(customerContact)
        .where(eq(customerContact.customerId, id));

      if (contacts.length > 0) {
        await this.db.insert(customerContact).values(
          contacts.map((c, i) => ({
            customerId: id,
            contactName: c.contactName,
            contactPhone: c.contactPhone ?? null,
            position: c.position ?? null,
            remark: c.remark ?? null,
            sortOrder: i,
          })),
        );
      }
    }

    // Audit trail — log changed fields
    await this.logFieldChanges(
      'customer',
      id,
      oldRecord as unknown as Record<string, unknown>,
      customerFields as unknown as Record<string, unknown>,
      userId,
    );

    return this.findById(id);
  }

  // -----------------------------------------------------------------------
  // Soft-delete (creator only)
  // -----------------------------------------------------------------------
  async remove(id: number, userId: number) {
    const record = await this.findById(id);

    if (record.createdBy !== userId) {
      throw new ForbiddenException('只有创建人可以删除此客户');
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
