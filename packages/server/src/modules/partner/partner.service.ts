import { Inject, Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { eq, asc } from 'drizzle-orm';
import { DRIZZLE, DrizzleDB } from '../../database/database.module';
import { partner } from '../../database/schema/business';
import { CreatePartnerDto, UpdatePartnerDto } from './dto/partner.dto';

@Injectable()
export class PartnerService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  // -----------------------------------------------------------------------
  // List all (no pagination — small dataset)
  // -----------------------------------------------------------------------
  async findAll() {
    return this.db.select().from(partner).orderBy(asc(partner.name));
  }

  // -----------------------------------------------------------------------
  // Find by ID
  // -----------------------------------------------------------------------
  async findById(id: number) {
    const rows = await this.db.select().from(partner).where(eq(partner.id, id));
    if (rows.length === 0) throw new NotFoundException('Partner not found');
    return rows[0];
  }

  // -----------------------------------------------------------------------
  // Create
  // -----------------------------------------------------------------------
  async create(dto: CreatePartnerDto, userId: number) {
    // Check uniqueness
    const existing = await this.db
      .select({ id: partner.id })
      .from(partner)
      .where(eq(partner.name, dto.name));
    if (existing.length > 0) {
      throw new BadRequestException(`合作方「${dto.name}」已存在`);
    }

    const rows = await this.db
      .insert(partner)
      .values({
        name: dto.name,
        contactName: dto.contactName ?? null,
        contactPhone: dto.contactPhone ?? null,
        remark: dto.remark ?? null,
        createdBy: userId,
      })
      .returning();
    return rows[0];
  }

  // -----------------------------------------------------------------------
  // Update
  // -----------------------------------------------------------------------
  async update(id: number, dto: UpdatePartnerDto) {
    await this.findById(id); // ensure exists
    const rows = await this.db
      .update(partner)
      .set({ ...dto, updatedAt: new Date() })
      .where(eq(partner.id, id))
      .returning();
    return rows[0];
  }

  // -----------------------------------------------------------------------
  // Delete
  // -----------------------------------------------------------------------
  async remove(id: number) {
    await this.findById(id);
    await this.db.delete(partner).where(eq(partner.id, id));
    return { success: true };
  }
}
