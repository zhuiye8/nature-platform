import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { eq, inArray } from 'drizzle-orm';
import { DRIZZLE, DrizzleDB } from '../../database/database.module';
import { userAccount, userRole, iamRolePermission } from '../../database/schema';

@Injectable()
export class AuthService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly jwtService: JwtService,
  ) {}

  async login(username: string, password: string) {
    const rows = await this.db
      .select()
      .from(userAccount)
      .where(eq(userAccount.username, username))
      .limit(1);

    const user = rows[0];
    if (!user) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    if (!user.enabled) {
      throw new UnauthorizedException('账号已被禁用');
    }

    const passwordValid = await bcrypt.compare(password, user.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    const { roles, permissions } = await this.loadUserPermissions(user.id);
    const payload = { sub: user.id, username: user.username };

    return {
      accessToken: this.jwtService.sign(payload),
      refreshToken: this.jwtService.sign(payload, { expiresIn: '7d' }),
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        permissions,
        roles,
      },
    };
  }

  async validateUser(userId: number) {
    const rows = await this.db
      .select({
        id: userAccount.id,
        username: userAccount.username,
        displayName: userAccount.displayName,
        enabled: userAccount.enabled,
      })
      .from(userAccount)
      .where(eq(userAccount.id, userId))
      .limit(1);

    const user = rows[0];
    if (!user || !user.enabled) {
      throw new UnauthorizedException('用户不存在或已被禁用');
    }

    const { roles, permissions } = await this.loadUserPermissions(user.id);

    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      permissions,
      roles,
    };
  }

  private async loadUserPermissions(userId: number) {
    // Load user's role codes
    const roleRows = await this.db
      .select({ roleCode: userRole.roleCode })
      .from(userRole)
      .where(eq(userRole.userId, userId));

    const roles = roleRows.map((r) => r.roleCode);

    // Super admin gets wildcard permission
    if (roles.includes('super_admin')) {
      return { roles, permissions: ['*:*'] };
    }

    if (roles.length === 0) {
      return { roles, permissions: [] };
    }

    // Load permissions for all user roles
    const permRows = await this.db
      .selectDistinct({ code: iamRolePermission.permissionCode })
      .from(iamRolePermission)
      .where(inArray(iamRolePermission.roleCode, roles));

    const permissions = permRows.map((p) => p.code);

    return { roles, permissions };
  }
}
