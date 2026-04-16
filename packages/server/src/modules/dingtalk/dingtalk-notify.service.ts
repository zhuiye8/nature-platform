import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { eq } from 'drizzle-orm';
import { DRIZZLE, DrizzleDB } from '../../database/database.module';
import { userAccount } from '../../database/schema/user';

@Injectable()
export class DingtalkNotifyService {
  private readonly logger = new Logger(DingtalkNotifyService.name);

  private readonly appKey: string;
  private readonly appSecret: string;
  private readonly agentId: string;
  private readonly appUrl: string;

  // In-memory corp access token cache (7200s lifetime)
  private corpAccessToken: string | null = null;
  private tokenExpiresAt = 0;

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly configService: ConfigService,
  ) {
    this.appKey = this.configService.get('DINGTALK_APP_KEY', '');
    this.appSecret = this.configService.get('DINGTALK_APP_SECRET', '');
    this.agentId = this.configService.get('DINGTALK_AGENT_ID', '');
    this.appUrl = this.configService.get('APP_URL', '');
  }

  /** Whether DingTalk notifications are configured and usable */
  get enabled(): boolean {
    return !!(this.appKey && this.appSecret && this.agentId);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Corp-level access_token (AppKey + AppSecret → token, cached 7200s)
  // ─────────────────────────────────────────────────────────────────────────
  async getCorpAccessToken(): Promise<string> {
    if (this.corpAccessToken && Date.now() < this.tokenExpiresAt) {
      return this.corpAccessToken;
    }

    const res = await axios.get(
      'https://oapi.dingtalk.com/gettoken',
      { params: { appkey: this.appKey, appsecret: this.appSecret } },
    );

    if (res.data?.errcode !== 0) {
      throw new Error(`DingTalk gettoken failed: ${res.data?.errmsg}`);
    }

    this.corpAccessToken = res.data.access_token;
    // Expire 5 minutes early to be safe
    this.tokenExpiresAt = Date.now() + (res.data.expires_in - 300) * 1000;
    return this.corpAccessToken!;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // UnionId → Corp UserId
  // ─────────────────────────────────────────────────────────────────────────
  async getCorpUserIdByUnionId(unionId: string): Promise<string | null> {
    try {
      const token = await this.getCorpAccessToken();
      const res = await axios.post(
        `https://oapi.dingtalk.com/topapi/user/getbyunionid?access_token=${token}`,
        { unionid: unionId },
      );
      if (res.data?.errcode === 0 && res.data?.result?.userid) {
        return res.data.result.userid as string;
      }
      this.logger.warn(`getbyunionid returned: ${res.data?.errmsg}`);
      return null;
    } catch (e) {
      this.logger.warn(`getCorpUserIdByUnionId failed: ${(e as Error).message}`);
      return null;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Send markdown work notification
  // ─────────────────────────────────────────────────────────────────────────
  private async sendWorkNotice(
    corpUserId: string,
    title: string,
    markdownText: string,
  ): Promise<void> {
    const token = await this.getCorpAccessToken();
    const res = await axios.post(
      `https://oapi.dingtalk.com/topapi/message/corpconversation/asyncsend_v2?access_token=${token}`,
      {
        agent_id: Number(this.agentId),
        userid_list: corpUserId,
        msg: {
          msgtype: 'markdown',
          markdown: { title, text: markdownText },
        },
      },
    );

    if (res.data?.errcode !== 0) {
      this.logger.warn(
        `DingTalk send failed for ${corpUserId}: ${res.data?.errmsg}`,
      );
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Public API: send notification to a system user if they have DingTalk bound
  // ─────────────────────────────────────────────────────────────────────────
  async sendIfBound(
    userId: number,
    title: string,
    content: string,
    refType?: string,
    refId?: number,
  ): Promise<void> {
    if (!this.enabled) return;

    const rows = await this.db
      .select({
        dingUserId: userAccount.dingUserId,
        dingUnionId: userAccount.dingUnionId,
        displayName: userAccount.displayName,
      })
      .from(userAccount)
      .where(eq(userAccount.id, userId))
      .limit(1);

    const user = rows[0];
    if (!user?.dingUnionId) return; // Not bound to DingTalk

    // Resolve corp userId — auto-correct if stored value is an openId
    let corpUserId = user.dingUserId;
    if (!corpUserId || !this.looksLikeCorpUserId(corpUserId)) {
      corpUserId = await this.getCorpUserIdByUnionId(user.dingUnionId);
      if (corpUserId) {
        // Persist corrected value so we don't look it up every time
        await this.db
          .update(userAccount)
          .set({ dingUserId: corpUserId })
          .where(eq(userAccount.id, userId));
        this.logger.log(
          `Auto-corrected ding_user_id for user #${userId} → ${corpUserId}`,
        );
      }
    }

    if (!corpUserId) return;

    // Build markdown message with optional link
    let link = '';
    if (this.appUrl && refType && refId) {
      const routeMap: Record<string, string> = {
        CONTRACT: `/contract/${refId}`,
        PROJECT_REGISTER: `/project/${refId}`,
      };
      const path = routeMap[refType] || '/dashboard';
      link = `\n\n[点击查看 →](${this.appUrl}${path})`;
    }

    const markdownText = `### ${title}\n\n${content}${link}`;
    await this.sendWorkNotice(corpUserId, title, markdownText);
  }

  /**
   * Heuristic to distinguish corp userId from openId/unionId.
   *
   * Corp userIds: typically numeric ("01204260314624245988") or short
   * alphanumeric ("manager4220"). Always start with a digit or lowercase.
   *
   * OpenIds/UnionIds: Base64-style mixed case like "HCl7sBe1jzG44BCDCJnn1wiEiE".
   * They contain uppercase letters mixed with lowercase — a pattern that corp
   * userIds never have.
   */
  private looksLikeCorpUserId(id: string): boolean {
    if (!id) return false;
    // If it has mixed case (both upper and lower), it's likely an openId/unionId
    const hasUpper = /[A-Z]/.test(id);
    const hasLower = /[a-z]/.test(id);
    if (hasUpper && hasLower) return false;
    return true;
  }
}
