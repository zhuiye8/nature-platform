import {
  Inject,
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { eq, asc } from 'drizzle-orm';
import { DRIZZLE, DrizzleDB } from '../../database/database.module';
import { iamRole, iamPermission, iamRolePermission } from '../../database/schema/iam';
import { CreateRoleDto, UpdateRoleDto, AssignPermissionsDto } from './dto/role.dto';

@Injectable()
export class RoleService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  // -----------------------------------------------------------------------
  // List all roles
  // -----------------------------------------------------------------------
  async findAll() {
    return this.db
      .select()
      .from(iamRole)
      .orderBy(asc(iamRole.sortOrder), asc(iamRole.id));
  }

  // -----------------------------------------------------------------------
  // Single role with permissions
  // -----------------------------------------------------------------------
  async findById(id: number) {
    const rows = await this.db
      .select()
      .from(iamRole)
      .where(eq(iamRole.id, id))
      .limit(1);

    if (!rows[0]) throw new NotFoundException(`Role #${id} not found`);

    const perms = await this.db
      .select({ permissionCode: iamRolePermission.permissionCode })
      .from(iamRolePermission)
      .where(eq(iamRolePermission.roleCode, rows[0].roleCode));

    return {
      ...rows[0],
      permissionCodes: perms.map((p) => p.permissionCode),
    };
  }

  // -----------------------------------------------------------------------
  // Create
  // -----------------------------------------------------------------------
  async create(dto: CreateRoleDto) {
    const existing = await this.db
      .select({ id: iamRole.id })
      .from(iamRole)
      .where(eq(iamRole.roleCode, dto.roleCode))
      .limit(1);
    if (existing.length > 0) {
      throw new BadRequestException(`Role code "${dto.roleCode}" already exists`);
    }

    const result = await this.db
      .insert(iamRole)
      .values({
        roleCode: dto.roleCode,
        roleName: dto.roleName,
        description: dto.description ?? null,
        systemFlag: false,
        enabled: true,
      })
      .returning();

    return result[0];
  }

  // -----------------------------------------------------------------------
  // Update
  // -----------------------------------------------------------------------
  async update(id: number, dto: UpdateRoleDto) {
    const role = await this.findById(id);
    if (role.systemFlag && dto.enabled === false) {
      throw new ForbiddenException('Cannot disable system roles');
    }

    const result = await this.db
      .update(iamRole)
      .set({ ...dto, updatedAt: new Date() })
      .where(eq(iamRole.id, id))
      .returning();

    return result[0];
  }

  // -----------------------------------------------------------------------
  // Delete (non-system only)
  // -----------------------------------------------------------------------
  async remove(id: number) {
    const role = await this.findById(id);
    if (role.systemFlag) {
      throw new ForbiddenException('Cannot delete system roles');
    }

    await this.db
      .delete(iamRolePermission)
      .where(eq(iamRolePermission.roleCode, role.roleCode));
    await this.db.delete(iamRole).where(eq(iamRole.id, id));
    return { success: true };
  }

  // -----------------------------------------------------------------------
  // Assign permissions
  // -----------------------------------------------------------------------
  async assignPermissions(roleCode: string, dto: AssignPermissionsDto) {
    // Verify role exists
    const roles = await this.db
      .select({ id: iamRole.id })
      .from(iamRole)
      .where(eq(iamRole.roleCode, roleCode))
      .limit(1);
    if (!roles[0]) throw new NotFoundException(`Role "${roleCode}" not found`);

    // Clear and re-insert
    await this.db
      .delete(iamRolePermission)
      .where(eq(iamRolePermission.roleCode, roleCode));

    if (dto.permissionCodes.length > 0) {
      await this.db.insert(iamRolePermission).values(
        dto.permissionCodes.map((code) => ({
          roleCode,
          permissionCode: code,
        })),
      );
    }

    return { success: true };
  }

  // -----------------------------------------------------------------------
  // All permissions (grouped by category for UI tree)
  // -----------------------------------------------------------------------
  async getAllPermissions() {
    const all = await this.db
      .select()
      .from(iamPermission)
      .where(eq(iamPermission.enabled, true))
      .orderBy(asc(iamPermission.category), asc(iamPermission.id));

    // Group by category
    const grouped: Record<string, typeof all> = {};
    for (const p of all) {
      if (!grouped[p.category]) grouped[p.category] = [];
      grouped[p.category].push(p);
    }

    return grouped;
  }
}
