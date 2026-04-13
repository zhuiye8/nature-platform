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
import { userRole, iamRole } from '../../database/schema/iam';
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
    // Normalize + format check (defense-in-depth; DTO also checks)
    const username = dto.username?.trim();
    if (!username || !/^[a-zA-Z0-9_]{3,32}$/.test(username)) {
      throw new BadRequestException('用户名只能包含字母、数字和下划线，长度3-32位');
    }

    // Check username uniqueness
    const existing = await this.db
      .select({ id: userAccount.id })
      .from(userAccount)
      .where(eq(userAccount.username, username))
      .limit(1);
    if (existing.length > 0) {
      throw new BadRequestException(`用户名 "${username}" 已存在`);
    }

    const hash = await bcrypt.hash(dto.password, 10);
    const result = await this.db
      .insert(userAccount)
      .values({
        username,
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
  // Check username availability (for form real-time validation)
  // -----------------------------------------------------------------------
  async checkUsername(username: string, excludeId?: number) {
    const trimmed = username?.trim();
    if (!trimmed) {
      return { available: false, reason: '用户名不能为空' };
    }
    if (!/^[a-zA-Z0-9_]{3,32}$/.test(trimmed)) {
      return {
        available: false,
        reason: '用户名只能包含字母、数字和下划线，长度3-32位',
      };
    }

    const rows = await this.db
      .select({ id: userAccount.id })
      .from(userAccount)
      .where(eq(userAccount.username, trimmed))
      .limit(1);

    if (rows.length === 0) {
      return { available: true };
    }
    if (excludeId && rows[0].id === excludeId) {
      return { available: true };
    }
    return { available: false, reason: '该用户名已被使用' };
  }

  // -----------------------------------------------------------------------
  // Simple list for dropdowns
  // -----------------------------------------------------------------------
  async findSimpleList() {
    return this.db
      .select({
        id: userAccount.id,
        username: userAccount.username,
        displayName: userAccount.displayName,
      })
      .from(userAccount)
      .where(eq(userAccount.enabled, true))
      .orderBy(userAccount.displayName);
  }

  // -----------------------------------------------------------------------
  // -----------------------------------------------------------------------
  // Profile — 个人中心（任何登录用户）
  // -----------------------------------------------------------------------
  async getProfile(userId: number) {
    const rows = await this.db
      .select({
        id: userAccount.id,
        username: userAccount.username,
        displayName: userAccount.displayName,
        mobile: userAccount.mobile,
        email: userAccount.email,
        createdAt: userAccount.createdAt,
      })
      .from(userAccount)
      .where(eq(userAccount.id, userId))
      .limit(1);

    if (!rows[0]) throw new NotFoundException('User not found');

    const roles = await this.db
      .select({ roleCode: userRole.roleCode, roleName: iamRole.roleName })
      .from(userRole)
      .innerJoin(iamRole, eq(userRole.roleCode, iamRole.roleCode))
      .where(eq(userRole.userId, userId));

    return {
      ...rows[0],
      roles: roles.map((r) => r.roleCode),
      roleNames: roles.map((r) => r.roleName),
    };
  }

  async updateProfile(
    userId: number,
    data: { username?: string; displayName?: string; mobile?: string; email?: string },
  ) {
    const updateData: any = { updatedAt: new Date() };
    if (data.displayName !== undefined) updateData.displayName = data.displayName;
    if (data.mobile !== undefined) {
      const mobile = data.mobile?.trim() || null;
      if (mobile) {
        const existing = await this.db
          .select({ id: userAccount.id })
          .from(userAccount)
          .where(eq(userAccount.mobile, mobile))
          .limit(1);
        if (existing.length > 0 && existing[0].id !== userId) {
          throw new BadRequestException('该手机号已被其他用户使用');
        }
      }
      updateData.mobile = mobile;
    }
    if (data.email !== undefined) updateData.email = data.email || null;

    // Username change (only for DingTalk auto-created users)
    if (data.username !== undefined && data.username.trim()) {
      const trimmed = data.username.trim();
      if (!/^[a-zA-Z0-9_]{3,32}$/.test(trimmed)) {
        throw new BadRequestException('用户名只能包含字母、数字和下划线，长度3-32位');
      }
      const existing = await this.db
        .select({ id: userAccount.id })
        .from(userAccount)
        .where(eq(userAccount.username, trimmed))
        .limit(1);
      if (existing.length > 0 && existing[0].id !== userId) {
        throw new BadRequestException('该用户名已被使用');
      }
      updateData.username = trimmed;
    }

    await this.db
      .update(userAccount)
      .set(updateData)
      .where(eq(userAccount.id, userId));

    return this.getProfile(userId);
  }

  async changePassword(userId: number, oldPassword: string, newPassword: string) {
    if (!oldPassword || !newPassword) {
      throw new BadRequestException('请填写旧密码和新密码');
    }
    if (newPassword.length < 6) {
      throw new BadRequestException('新密码长度不能少于6位');
    }

    const rows = await this.db
      .select({ passwordHash: userAccount.passwordHash })
      .from(userAccount)
      .where(eq(userAccount.id, userId))
      .limit(1);

    if (!rows[0]) throw new NotFoundException('User not found');

    const valid = await bcrypt.compare(oldPassword, rows[0].passwordHash);
    if (!valid) {
      throw new BadRequestException('旧密码不正确');
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await this.db
      .update(userAccount)
      .set({ passwordHash: newHash, mustChangePwd: false, updatedAt: new Date() })
      .where(eq(userAccount.id, userId));

    return { success: true, message: '密码修改成功' };
  }

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
