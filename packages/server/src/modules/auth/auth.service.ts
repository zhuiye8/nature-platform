import {
  Inject,
  Injectable,
  Logger,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as bcrypt from 'bcrypt';
import { eq, inArray, ilike } from 'drizzle-orm';
import { DRIZZLE, DrizzleDB } from '../../database/database.module';
import { userAccount, userRole, iamRolePermission } from '../../database/schema';

interface DingtalkTokenResponse {
  accessToken?: string;
}

interface DingtalkMeResponse {
  unionId?: string;
  openId?: string;
  nick?: string;
  mobile?: string;
  avatarUrl?: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  // ===================================================================
  // Password Login
  // ===================================================================

  async login(username: string, password: string) {
    // Support login by username or mobile
    let rows = await this.db
      .select()
      .from(userAccount)
      .where(eq(userAccount.username, username))
      .limit(1);

    if (rows.length === 0) {
      rows = await this.db
        .select()
        .from(userAccount)
        .where(eq(userAccount.mobile, username))
        .limit(1);
    }

    const user = rows[0];
    if (!user) {
      throw new UnauthorizedException('用户名/手机号或密码错误');
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
        mustChangePassword: user.mustChangePwd,
        dingUnionId: user.dingUnionId,
        mobile: user.mobile,
        permissions,
        roles,
      },
    };
  }

  // ===================================================================
  // DingTalk OAuth
  // ===================================================================

  getDingtalkAuthUrl() {
    const clientId = this.configService.get('DINGTALK_APP_KEY', '');
    const redirectUri = this.configService.get('DINGTALK_REDIRECT_URI', '');
    if (!clientId || !redirectUri) {
      throw new BadRequestException('钉钉登录未配置');
    }
    const state = Math.random().toString(36).substring(2, 15);
    const url = `https://login.dingtalk.com/oauth2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=openid&prompt=consent&state=${state}`;
    return { url, state };
  }

  /**
   * Exchange authCode for DingTalk user info
   */
  private async getDingtalkUserInfo(authCode: string) {
    const clientId = this.configService.get('DINGTALK_APP_KEY', '');
    const clientSecret = this.configService.get('DINGTALK_APP_SECRET', '');

    // Step 1: Exchange authCode for access token
    const tokenRes = await axios.post<DingtalkTokenResponse>(
      'https://api.dingtalk.com/v1.0/oauth2/userAccessToken',
      {
        clientId,
        clientSecret,
        code: authCode,
        grantType: 'authorization_code',
      },
    );
    const accessToken = tokenRes.data?.accessToken;
    if (!accessToken) {
      this.logger.error('DingTalk token exchange failed', tokenRes.data);
      throw new BadRequestException('钉钉授权失败');
    }

    // Step 2: Get user info
    const userRes = await axios.get<DingtalkMeResponse>(
      'https://api.dingtalk.com/v1.0/contact/users/me',
      {
        headers: { 'x-acs-dingtalk-access-token': accessToken },
      },
    );
    const dtUser = userRes.data;
    if (!dtUser?.unionId) {
      this.logger.error('DingTalk user info failed', dtUser);
      throw new BadRequestException('获取钉钉用户信息失败');
    }

    this.logger.log(`DingTalk user: ${dtUser.nick} (unionId: ${dtUser.unionId})`);
    return {
      unionId: dtUser.unionId as string,
      openId: dtUser.openId as string,
      nick: (dtUser.nick || '') as string,
      mobile: (dtUser.mobile || '') as string,
      avatarUrl: (dtUser.avatarUrl || '') as string,
    };
  }

  /**
   * DingTalk login — try to match existing user or return candidates
   */
  async dingtalkLogin(authCode: string) {
    const dtUser = await this.getDingtalkUserInfo(authCode);

    // 1. Check if already bound by unionId
    const boundUser = await this.db
      .select()
      .from(userAccount)
      .where(eq(userAccount.dingUnionId, dtUser.unionId))
      .limit(1);

    if (boundUser[0]) {
      const user = boundUser[0];
      if (!user.enabled) throw new UnauthorizedException('账号已被禁用');
      return this.buildLoginResult(user);
    }

    // 2. Search by display_name (nick)
    const candidates = await this.db
      .select({
        id: userAccount.id,
        username: userAccount.username,
        displayName: userAccount.displayName,
        mobile: userAccount.mobile,
      })
      .from(userAccount)
      .where(eq(userAccount.displayName, dtUser.nick));

    if (candidates.length === 1) {
      // Auto-bind single match
      await this.bindDingtalk(candidates[0].id, dtUser);
      const user = await this.db.select().from(userAccount).where(eq(userAccount.id, candidates[0].id)).limit(1);
      return this.buildLoginResult(user[0]);
    }

    if (candidates.length > 1) {
      // Multiple matches — return candidates for user to choose
      return {
        status: 'NEED_SELECT',
        dingtalkInfo: dtUser,
        candidates: candidates.map(c => ({
          id: c.id,
          displayName: c.displayName,
          mobileLast4: c.mobile ? c.mobile.slice(-4) : '',
        })),
      };
    }

    // 3. No match — need to create
    return {
      status: 'NEED_CREATE',
      dingtalkInfo: dtUser,
    };
  }

  /**
   * Bind DingTalk to existing user after password verification (multi-match scenario)
   */
  async dingtalkBindWithPassword(userId: number, password: string, dingtalkInfo: { unionId: string; openId: string; nick: string; mobile: string }) {
    const users = await this.db.select().from(userAccount).where(eq(userAccount.id, userId)).limit(1);
    const user = users[0];
    if (!user) throw new BadRequestException('用户不存在');
    if (!user.enabled) throw new UnauthorizedException('账号已被禁用');

    const passwordValid = await bcrypt.compare(password, user.passwordHash);
    if (!passwordValid) throw new UnauthorizedException('密码错误');

    await this.bindDingtalk(userId, dingtalkInfo);
    const updated = await this.db.select().from(userAccount).where(eq(userAccount.id, userId)).limit(1);
    return this.buildLoginResult(updated[0]);
  }

  /**
   * Create new user from DingTalk info and bind
   */
  async dingtalkCreateUser(dingtalkInfo: { unionId: string; openId: string; nick: string; mobile: string }) {
    // Generate username from nick (use unionId suffix to avoid conflicts)
    const baseUsername = `dt_${dingtalkInfo.unionId.substring(0, 8)}`;
    let username = baseUsername;
    let counter = 1;
    while (true) {
      const existing = await this.db.select({ id: userAccount.id }).from(userAccount).where(eq(userAccount.username, username)).limit(1);
      if (existing.length === 0) break;
      username = `${baseUsername}_${counter++}`;
    }

    const passwordHash = await bcrypt.hash('123456', 10);

    const result = await this.db
      .insert(userAccount)
      .values({
        username,
        passwordHash,
        displayName: dingtalkInfo.nick,
        mobile: dingtalkInfo.mobile || null,
        sourceType: 'DINGTALK',
        mustChangePwd: true,
        dingUnionId: dingtalkInfo.unionId,
        dingUserId: dingtalkInfo.openId,
      })
      .returning();

    const newUser = result[0];
    this.logger.log(`Created DingTalk user: ${username} (${dingtalkInfo.nick})`);

    // Notify all super_admins
    await this.notifySuperAdmins(newUser.displayName);

    return this.buildLoginResult(newUser);
  }

  // ===================================================================
  // Helpers
  // ===================================================================

  private async bindDingtalk(userId: number, dtUser: { unionId: string; openId: string; nick?: string; mobile?: string }) {
    await this.db
      .update(userAccount)
      .set({
        dingUnionId: dtUser.unionId,
        dingUserId: dtUser.openId,
        updatedAt: new Date(),
      })
      .where(eq(userAccount.id, userId));
  }

  async unbindDingtalk(userId: number) {
    await this.db
      .update(userAccount)
      .set({
        dingUnionId: null,
        dingUserId: null,
        updatedAt: new Date(),
      })
      .where(eq(userAccount.id, userId));
  }

  private async buildLoginResult(user: any) {
    const { roles, permissions } = await this.loadUserPermissions(user.id);
    const payload = { sub: user.id, username: user.username };

    return {
      status: 'OK',
      accessToken: this.jwtService.sign(payload),
      refreshToken: this.jwtService.sign(payload, { expiresIn: '7d' }),
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        mustChangePassword: user.mustChangePwd,
        dingUnionId: user.dingUnionId,
        mobile: user.mobile,
        permissions,
        roles,
      },
    };
  }

  private async notifySuperAdmins(newUserName: string) {
    try {
      const { systemNotification } = await import('../../database/schema/common');
      const admins = await this.db
        .select({ userId: userRole.userId })
        .from(userRole)
        .where(eq(userRole.roleCode, 'super_admin'));

      for (const admin of admins) {
        await this.db.insert(systemNotification).values({
          receiverId: admin.userId,
          title: '新用户待分配角色',
          content: `${newUserName} 已通过钉钉登录自动创建账号，请前往用户管理分配角色`,
          eventType: 'USER_CREATED',
        });
      }
    } catch (e) {
      this.logger.warn('Failed to notify super admins', e);
    }
  }

  // ===================================================================
  // Request Role Assignment
  // ===================================================================

  private lastRoleRequestTime = new Map<number, number>();

  async requestRole(userId: number) {
    // Rate limit: 10 minutes per user
    const now = Date.now();
    const lastTime = this.lastRoleRequestTime.get(userId) || 0;
    if (now - lastTime < 10 * 60 * 1000) {
      return { success: true, message: '已提醒，请耐心等待管理员处理' };
    }
    this.lastRoleRequestTime.set(userId, now);

    const users = await this.db
      .select({ displayName: userAccount.displayName })
      .from(userAccount)
      .where(eq(userAccount.id, userId))
      .limit(1);
    const userName = users[0]?.displayName || '未知用户';

    await this.notifySuperAdmins(`${userName} 请求分配角色，请前往用户管理处理`);
    return { success: true, message: '已通知管理员，请耐心等待' };
  }

  // ===================================================================
  // JWT Validation
  // ===================================================================

  async validateUser(userId: number) {
    const rows = await this.db
      .select({
        id: userAccount.id,
        username: userAccount.username,
        displayName: userAccount.displayName,
        enabled: userAccount.enabled,
        mustChangePwd: userAccount.mustChangePwd,
        dingUnionId: userAccount.dingUnionId,
        mobile: userAccount.mobile,
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
      mustChangePassword: user.mustChangePwd,
      dingUnionId: user.dingUnionId,
      mobile: user.mobile,
      permissions,
      roles,
    };
  }

  private async loadUserPermissions(userId: number) {
    const roleRows = await this.db
      .select({ roleCode: userRole.roleCode })
      .from(userRole)
      .where(eq(userRole.userId, userId));

    const roles = roleRows.map((r) => r.roleCode);

    if (roles.includes('super_admin')) {
      return { roles, permissions: ['*:*'] };
    }

    if (roles.length === 0) {
      return { roles, permissions: [] };
    }

    const permRows = await this.db
      .selectDistinct({ code: iamRolePermission.permissionCode })
      .from(iamRolePermission)
      .where(inArray(iamRolePermission.roleCode, roles));

    const permissions = permRows.map((p) => p.code);

    return { roles, permissions };
  }
}
