import {
  Inject,
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { eq, and, or, ilike, count, desc, SQL } from 'drizzle-orm';
import * as bcrypt from 'bcrypt';
import { DRIZZLE, DrizzleDB } from '../../database/database.module';
import { userAccount } from '../../database/schema/user';
import { userRole } from '../../database/schema/iam';
import { fieldChangeLog } from '../../database/schema/common';
import {
  CreateUserDto,
  UpdateUserDto,
  QueryUserDto,
  AssignRolesDto,
  ResetPasswordDto,
} from './dto/user.dto';

@Injectable()
export class UserService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  // -----------------------------------------------------------------------
  // Paginated list (excludes passwordHash)
  // -----------------------------------------------------------------------
  async findPage(query: QueryUserDto) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;

    const conditions: SQL[] = [];
    if (query.keyword) {
      const pattern = `%${query.keyword}%`;
      conditions.push(
        or(
          ilike(userAccount.username, pattern),
          ilike(userAccount.displayName, pattern),
          ilike(userAccount.mobile, pattern),
        )!,
      );
    }
    if (query.enabled !== undefined) {
      conditions.push(eq(userAccount.enabled, query.enabled));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [totalResult, rows] = await Promise.all([
      this.db.select({ total: count() }).from(userAccount).where(whereClause),
      this.db
        .select({
          id: userAccount.id,
          username: userAccount.username,
          displayName: userAccount.displayName,
          mobile: userAccount.mobile,
          email: userAccount.email,
          enabled: userAccount.enabled,
          sourceType: userAccount.sourceType,
          deptId: userAccount.deptId,
          createdAt: userAccount.createdAt,
        })
        .from(userAccount)
        .where(whereClause)
        .orderBy(desc(userAccount.createdAt))
        .limit(pageSize)
        .offset((page - 1) * pageSize),
    ]);

    return { list: rows, total: totalResult[0]?.total ?? 0, page, pageSize };
  }

  // -----------------------------------------------------------------------
  // Single record (with roles)
  // -----------------------------------------------------------------------
  async findById(id: number) {
    const rows = await this.db
      .select({
        id: userAccount.id,
        username: userAccount.username,
        displayName: userAccount.displayName,
        mobile: userAccount.mobile,
        email: userAccount.email,
        enabled: userAccount.enabled,
        sourceType: userAccount.sourceType,
        deptId: userAccount.deptId,
        createdAt: userAccount.createdAt,
      })
      .from(userAccount)
      .where(eq(userAccount.id, id))
      .limit(1);

    if (!rows[0]) throw new NotFoundException(`User #${id} not found`);

    const roles = await this.db
      .select({ roleCode: userRole.roleCode, sortOrder: userRole.sortOrder })
      .from(userRole)
      .where(eq(userRole.userId, id));

    return { ...rows[0], roles: roles.map((r) => r.roleCode) };
  }

  // -----------------------------------------------------------------------
  // Create
  // -----------------------------------------------------------------------
  async create(dto: CreateUserDto) {
    // Check username uniqueness
    const existing = await this.db
      .select({ id: userAccount.id })
      .from(userAccount)
      .where(eq(userAccount.username, dto.username))
      .limit(1);
    if (existing.length > 0) {
      throw new BadRequestException(`Username "${dto.username}" already exists`);
    }

    const hash = await bcrypt.hash(dto.password, 10);
    const result = await this.db
      .insert(userAccount)
      .values({
        username: dto.username,
        passwordHash: hash,
        displayName: dto.displayName,
        mobile: dto.mobile ?? null,
        email: dto.email ?? null,
        deptId: dto.deptId ?? null,
        enabled: dto.enabled ?? true,
        sourceType: 'LOCAL',
      })
      .returning({
        id: userAccount.id,
        username: userAccount.username,
        displayName: userAccount.displayName,
      });

    return result[0];
  }

  // -----------------------------------------------------------------------
  // Update
  // -----------------------------------------------------------------------
  async update(id: number, dto: UpdateUserDto, operatorId: number) {
    const old = await this.findById(id);

    const result = await this.db
      .update(userAccount)
      .set({ ...dto, updatedAt: new Date() })
      .where(eq(userAccount.id, id))
      .returning({
        id: userAccount.id,
        username: userAccount.username,
        displayName: userAccount.displayName,
      });

    await this.logFieldChanges('user_account', id, old as any, dto as any, operatorId);
    return result[0];
  }

  // -----------------------------------------------------------------------
  // Toggle enabled
  // -----------------------------------------------------------------------
  async toggleEnabled(id: number, currentUserId: number) {
    if (id === currentUserId) {
      throw new ForbiddenException('Cannot disable yourself');
    }
    const user = await this.findById(id);
    await this.db
      .update(userAccount)
      .set({ enabled: !user.enabled, updatedAt: new Date() })
      .where(eq(userAccount.id, id));
    return { enabled: !user.enabled };
  }

  // -----------------------------------------------------------------------
  // Assign roles
  // -----------------------------------------------------------------------
  async assignRoles(id: number, dto: AssignRolesDto) {
    await this.findById(id); // existence check
    await this.db.delete(userRole).where(eq(userRole.userId, id));

    if (dto.roleCodes.length > 0) {
      await this.db.insert(userRole).values(
        dto.roleCodes.map((code, idx) => ({
          userId: id,
          roleCode: code,
          sortOrder: idx,
        })),
      );
    }

    return { success: true };
  }

  // -----------------------------------------------------------------------
  // Reset password
  // -----------------------------------------------------------------------
  async resetPassword(id: number, dto: ResetPasswordDto) {
    await this.findById(id);
    const hash = await bcrypt.hash(dto.newPassword, 10);
    await this.db
      .update(userAccount)
      .set({ passwordHash: hash, updatedAt: new Date() })
      .where(eq(userAccount.id, id));
    return { success: true };
  }

  // -----------------------------------------------------------------------
  // Simple list for dropdowns
  // -----------------------------------------------------------------------
  async findSimpleList() {
    return this.db
      .select({ id: userAccount.id, displayName: userAccount.displayName })
      .from(userAccount)
      .where(eq(userAccount.enabled, true))
      .orderBy(userAccount.displayName);
  }

  // -----------------------------------------------------------------------
  // Find users by role code (for dropdown in workflow assignment)
  // -----------------------------------------------------------------------
  async findByRoleCode(roleCode: string) {
    return this.db
      .select({ id: userAccount.id, displayName: userAccount.displayName })
      .from(userAccount)
      .innerJoin(userRole, eq(userAccount.id, userRole.userId))
      .where(
        and(eq(userRole.roleCode, roleCode), eq(userAccount.enabled, true)),
      )
      .orderBy(userRole.sortOrder, userAccount.displayName);
  }

  // -----------------------------------------------------------------------
  // Audit helper
  // -----------------------------------------------------------------------
  private async logFieldChanges(
    bizType: string,
    bizId: number,
    oldRecord: Record<string, unknown>,
    newValues: Record<string, unknown>,
    operatorId: number,
  ) {
    const entries: any[] = [];
    for (const key of Object.keys(newValues)) {
      if (newValues[key] === undefined) continue;
      if (String(oldRecord[key] ?? '') !== String(newValues[key] ?? '')) {
        entries.push({
          bizType, bizId, fieldName: key,
          oldValue: oldRecord[key] != null ? String(oldRecord[key]) : null,
          newValue: newValues[key] != null ? String(newValues[key]) : null,
          operatorId,
        });
      }
    }
    if (entries.length > 0) {
      await this.db.insert(fieldChangeLog).values(entries);
    }
  }
}
