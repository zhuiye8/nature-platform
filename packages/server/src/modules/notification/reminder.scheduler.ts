import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { DRIZZLE, DrizzleDB } from '../../database/database.module';
import {
  projectMember,
  projectRegister,
  projectReminderLog,
  projectSystemItem,
} from '../../database/schema/business';
import { userRole } from '../../database/schema/iam';
import { wfActionLog, wfInstance } from '../../database/schema/workflow';
import { NotificationService } from './notification.service';

type ReminderEvent = 'ENTRY_OVERDUE' | 'REPORT_DUE';

/**
 * 项目级业务提醒定时任务
 *
 * A1 ENTRY_OVERDUE —— 录入超期提醒
 *   触发: 今天 >= MIN(required_entry_date) + 30 天
 *   接收: 所有 project_director 角色的用户
 *   终止: wf_action_log 里存在 FINAL_REVIEW APPROVE 记录（最终审核已通过）
 *
 * A2 REPORT_DUE —— 报告到期提醒
 *   触发: 今天 >= MIN(required_report_delivery_date)（到期当天或之后）
 *   接收: 所有 project_director 角色用户 + 该项目 PM
 *   终止: 同 A1
 *
 * 幂等性: project_reminder_log 表上 (project_id, event_type) UNIQUE
 *        INSERT ... ON CONFLICT DO NOTHING + 仅 .returning() 有结果时发通知
 *        → 并发/重跑/手动触发都只会发一次。
 *
 * 性能: 两个独立聚合 SQL，每次扫描复杂度 O(项目数)。
 *      候选过滤使用 NOT EXISTS 子查询直接在 SQL 层跳过已发/已通过的项目。
 *      通知发送按用户循环调用 NotificationService（钉钉推送内部异步非阻塞）。
 */
@Injectable()
export class ReminderScheduler {
  private readonly logger = new Logger(ReminderScheduler.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly notificationService: NotificationService,
  ) {}

  /**
   * 每天 09:00（Asia/Shanghai）扫描一次。
   * 错过当天不要紧：A1 判断用 ">= 30 天"、A2 用 ">= 到期日"，下次执行会补发。
   */
  @Cron('0 9 * * *', { timeZone: 'Asia/Shanghai' })
  async runDailyReminders(): Promise<void> {
    this.logger.log('Daily reminder scan started');
    try {
      const directorIds = await this.loadDirectorUserIds();
      if (directorIds.length === 0) {
        this.logger.warn(
          'No users with project_director role; skipping reminder scan',
        );
        return;
      }

      const entrySent = await this.scanEntryOverdue(directorIds);
      const reportSent = await this.scanReportDue(directorIds);

      this.logger.log(
        `Daily reminder scan done: ENTRY_OVERDUE=${entrySent}, REPORT_DUE=${reportSent}`,
      );
    } catch (err) {
      // 顶层兜底，避免未捕获异常让调度器失效
      this.logger.error(
        `Daily reminder scan failed: ${(err as Error).message}`,
        (err as Error).stack,
      );
    }
  }

  // -----------------------------------------------------------------------
  private async loadDirectorUserIds(): Promise<number[]> {
    const rows = await this.db
      .select({ userId: userRole.userId })
      .from(userRole)
      .where(eq(userRole.roleCode, 'project_director'));
    return rows.map((r) => r.userId);
  }

  /**
   * A1 扫描：返回实际发送的项目数。
   */
  private async scanEntryOverdue(directorIds: number[]): Promise<number> {
    const candidates = await this.db
      .select({
        projectId: projectRegister.id,
        applicationName: projectRegister.applicationName,
      })
      .from(projectRegister)
      .innerJoin(
        wfInstance,
        and(
          eq(wfInstance.bizId, projectRegister.id),
          eq(wfInstance.bizType, 'PROJECT_REGISTER'),
        ),
      )
      .innerJoin(
        projectSystemItem,
        and(
          eq(projectSystemItem.projectRegisterId, projectRegister.id),
          eq(projectSystemItem.deleted, false),
        ),
      )
      .where(
        and(
          eq(projectRegister.deleted, false),
          eq(wfInstance.status, 'RUNNING'),
          sql`NOT EXISTS (
            SELECT 1 FROM ${wfActionLog}
            WHERE ${wfActionLog.instanceId} = ${wfInstance.id}
              AND ${wfActionLog.nodeKey} = 'FINAL_REVIEW'
              AND ${wfActionLog.action} = 'APPROVE'
          )`,
          sql`NOT EXISTS (
            SELECT 1 FROM ${projectReminderLog}
            WHERE ${projectReminderLog.projectId} = ${projectRegister.id}
              AND ${projectReminderLog.eventType} = 'ENTRY_OVERDUE'
          )`,
        ),
      )
      .groupBy(projectRegister.id, projectRegister.applicationName)
      .having(
        sql`MIN(${projectSystemItem.requiredEntryDate}) IS NOT NULL
          AND MIN(${projectSystemItem.requiredEntryDate}) + INTERVAL '30 days' <= CURRENT_DATE`,
      );

    let sent = 0;
    for (const row of candidates) {
      const ok = await this.sendReminder({
        projectId: row.projectId,
        eventType: 'ENTRY_OVERDUE',
        userIds: directorIds,
        title: '项目录入超期提醒',
        content: `项目「${row.applicationName}」已超过计划录入期 30 天，最终审核仍未通过`,
      });
      if (ok) sent++;
    }
    return sent;
  }

  /**
   * A2 扫描：返回实际发送的项目数。
   */
  private async scanReportDue(directorIds: number[]): Promise<number> {
    const candidates = await this.db
      .select({
        projectId: projectRegister.id,
        applicationName: projectRegister.applicationName,
        earliestReportDate: sql<string>`MIN(${projectSystemItem.requiredReportDeliveryDate})`,
      })
      .from(projectRegister)
      .innerJoin(
        wfInstance,
        and(
          eq(wfInstance.bizId, projectRegister.id),
          eq(wfInstance.bizType, 'PROJECT_REGISTER'),
        ),
      )
      .innerJoin(
        projectSystemItem,
        and(
          eq(projectSystemItem.projectRegisterId, projectRegister.id),
          eq(projectSystemItem.deleted, false),
        ),
      )
      .where(
        and(
          eq(projectRegister.deleted, false),
          eq(wfInstance.status, 'RUNNING'),
          sql`NOT EXISTS (
            SELECT 1 FROM ${wfActionLog}
            WHERE ${wfActionLog.instanceId} = ${wfInstance.id}
              AND ${wfActionLog.nodeKey} = 'FINAL_REVIEW'
              AND ${wfActionLog.action} = 'APPROVE'
          )`,
          sql`NOT EXISTS (
            SELECT 1 FROM ${projectReminderLog}
            WHERE ${projectReminderLog.projectId} = ${projectRegister.id}
              AND ${projectReminderLog.eventType} = 'REPORT_DUE'
          )`,
        ),
      )
      .groupBy(projectRegister.id, projectRegister.applicationName)
      .having(
        sql`MIN(${projectSystemItem.requiredReportDeliveryDate}) IS NOT NULL
          AND MIN(${projectSystemItem.requiredReportDeliveryDate}) <= CURRENT_DATE`,
      );

    if (candidates.length === 0) return 0;

    // 批量查候选项目的 PM userId（避免 N+1）
    const projectIds = candidates.map((c) => c.projectId);
    const pms = await this.db
      .select({
        projectId: projectMember.projectId,
        userId: projectMember.userId,
      })
      .from(projectMember)
      .where(
        and(
          inArray(projectMember.projectId, projectIds),
          eq(projectMember.roleType, 'PM'),
          eq(projectMember.status, 'ACTIVE'),
        ),
      );
    const pmByProject = new Map<number, number>();
    for (const p of pms) pmByProject.set(p.projectId, p.userId);

    let sent = 0;
    for (const row of candidates) {
      const recipients = new Set<number>(directorIds);
      const pmId = pmByProject.get(row.projectId);
      if (pmId) recipients.add(pmId);

      const ok = await this.sendReminder({
        projectId: row.projectId,
        eventType: 'REPORT_DUE',
        userIds: Array.from(recipients),
        title: '项目报告到期提醒',
        content: `项目「${row.applicationName}」的计划出报告日期已到（${row.earliestReportDate}），但最终审核仍未通过`,
      });
      if (ok) sent++;
    }
    return sent;
  }

  /**
   * 原子化 "已发标记 + 发通知"：
   *  1. INSERT ... ON CONFLICT DO NOTHING 尝试插入幂等标记
   *  2. 仅当 returning 结果非空（即本次真的插入了）时发通知
   *
   * 并发安全：如果两个调度器实例同时跑，UNIQUE 约束保证只有一个插入成功，
   * 另一个拿不到 returning 结果，直接跳过发通知。
   */
  private async sendReminder(params: {
    projectId: number;
    eventType: ReminderEvent;
    userIds: number[];
    title: string;
    content: string;
  }): Promise<boolean> {
    const inserted = await this.db
      .insert(projectReminderLog)
      .values({
        projectId: params.projectId,
        eventType: params.eventType,
      })
      .onConflictDoNothing()
      .returning({ id: projectReminderLog.id });

    if (inserted.length === 0) {
      return false;
    }

    const uniqueUserIds = Array.from(new Set(params.userIds));
    for (const userId of uniqueUserIds) {
      try {
        await this.notificationService.createNotification(
          userId,
          params.title,
          params.content,
          params.eventType,
          'PROJECT_REGISTER',
          params.projectId,
        );
      } catch (err) {
        // 单个用户推送失败不影响其他用户（例如钉钉服务暂时不可用）
        // 且 NotificationService 内部钉钉推送本就是非阻塞的，此处只有写通知表失败才会抛。
        this.logger.warn(
          `Failed to notify user #${userId} for project #${params.projectId} (${params.eventType}): ${(err as Error).message}`,
        );
      }
    }
    return true;
  }
}
