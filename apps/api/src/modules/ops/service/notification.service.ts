import { Injectable, Logger } from '@nestjs/common';
import { DbService } from '../../../core/db/db.service';

/**
 * 알림. docs/02 §10 — 백엔드는 코드만 남기고 문구는 클라이언트가 번역한다.
 * 템플릿은 notification_templates(code, locale, channel)에서 조회한다.
 *
 * 수신자의 users.locale을 따른다 — 베트남어 사용자에게 한국어 알림을 보내면
 * 도달은 해도 읽히지 않는다.
 */
@Injectable()
export class NotificationService {
  private readonly log = new Logger(NotificationService.name);

  constructor(private readonly db: DbService) {}

  async enqueue(userId: string, code: string, payload: Record<string, unknown>, channel = 'PUSH'): Promise<void> {
    await this.db.query(
      `INSERT INTO notifications (user_id, code, payload, channel) VALUES ($1, $2, $3, $4)`,
      [userId, code, JSON.stringify(payload), channel],
    );
  }

  /** 같은 코드·대상으로 오늘 이미 보냈는지. 만료 알림이 매일 중복 발송되는 것을 막는다. */
  async sentToday(userId: string, code: string, dedupeKey: string): Promise<boolean> {
    const row = await this.db.one<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM notifications
          WHERE user_id = $1 AND code = $2
            AND payload->>'dedupeKey' = $3
            AND created_at >= date_trunc('day', now())
       ) AS exists`,
      [userId, code, dedupeKey],
    );
    return row?.exists ?? false;
  }
}
