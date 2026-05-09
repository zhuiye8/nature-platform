import { Inject, Injectable, Logger } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';
import { eq, and, count, desc } from 'drizzle-orm';
import { DRIZZLE, DrizzleDB } from '../../database/database.module';
import { systemNotification } from '../../database/schema/common';
import { DingtalkNotifyService } from '../dingtalk/dingtalk-notify.service';

interface MessageEvent {
  data: string | object;
  id?: string;
  type?: string;
  retry?: number;
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);
  private readonly streams = new Map<number, Subject<MessageEvent>>();

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly dingtalkNotifyService: DingtalkNotifyService,
  ) {}

  // -----------------------------------------------------------------------
  // SSE stream management
  // -----------------------------------------------------------------------
  createStream(userId: number): Observable<MessageEvent> {
    let subject = this.streams.get(userId);
    if (!subject) {
      subject = new Subject<MessageEvent>();
      this.streams.set(userId, subject);
    }
    return subject.asObservable();
  }

  removeStream(userId: number) {
    const subject = this.streams.get(userId);
    if (subject) {
      subject.complete();
      this.streams.delete(userId);
    }
  }

  pushToUser(userId: number, data: object) {
    const subject = this.streams.get(userId);
    if (subject) {
      subject.next({ data });
    }
  }

  // -----------------------------------------------------------------------
  // Create notification + push
  // -----------------------------------------------------------------------
  async createNotification(
    receiverId: number,
    title: string,
    content: string,
    eventType: string,
    refType?: string,
    refId?: number,
    targetUrl?: string | null,
  ) {
    const result = await this.db
      .insert(systemNotification)
      .values({
        receiverId,
        title,
        content,
        eventType,
        refType: refType ?? null,
        refId: refId ?? null,
        targetUrl: targetUrl ?? null,
        readFlag: false,
      })
      .returning();

    const notification = result[0];

    this.pushToUser(receiverId, {
      type: 'NOTIFICATION',
      notification,
    });

    // DingTalk work notification (async, non-blocking)
    this.dingtalkNotifyService
      .sendIfBound(receiverId, title, content, refType, refId)
      .catch((e) =>
        this.logger.warn(
          `DingTalk notify failed for user #${receiverId}: ${(e as Error).message}`,
        ),
      );

    return notification;
  }

  // -----------------------------------------------------------------------
  // List notifications for user
  // -----------------------------------------------------------------------
  async findByUser(userId: number, page: number = 1, pageSize: number = 20) {
    const conditions = [eq(systemNotification.receiverId, userId)];
    const whereClause = and(...conditions)!;

    const [totalResult, rows] = await Promise.all([
      this.db
        .select({ total: count() })
        .from(systemNotification)
        .where(whereClause),
      this.db
        .select()
        .from(systemNotification)
        .where(whereClause)
        .orderBy(desc(systemNotification.createdAt))
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
  // Unread count
  // -----------------------------------------------------------------------
  async getUnreadCount(userId: number) {
    const result = await this.db
      .select({ total: count() })
      .from(systemNotification)
      .where(
        and(
          eq(systemNotification.receiverId, userId),
          eq(systemNotification.readFlag, false),
        ),
      );

    return { count: result[0]?.total ?? 0 };
  }

  // -----------------------------------------------------------------------
  // Mark single as read
  // -----------------------------------------------------------------------
  async markRead(id: number, userId: number) {
    await this.db
      .update(systemNotification)
      .set({ readFlag: true })
      .where(
        and(
          eq(systemNotification.id, id),
          eq(systemNotification.receiverId, userId),
        ),
      );
  }

  // -----------------------------------------------------------------------
  // Mark all as read
  // -----------------------------------------------------------------------
  async markAllRead(userId: number) {
    await this.db
      .update(systemNotification)
      .set({ readFlag: true })
      .where(eq(systemNotification.receiverId, userId));
  }

  // -----------------------------------------------------------------------
  // Delete notification
  // -----------------------------------------------------------------------
  async remove(id: number, userId: number) {
    await this.db
      .delete(systemNotification)
      .where(
        and(
          eq(systemNotification.id, id),
          eq(systemNotification.receiverId, userId),
        ),
      );
  }
}
