import { Injectable, Logger } from '@nestjs/common';
import { DbService } from '../../../core/db/db.service';

/**
 * 알림. docs/02 §10 — 백엔드는 코드만 남기고 문구는 클라이언트가 번역한다.
 * 템플릿은 notification_templates(code, locale, channel)에서 조회한다.
 *
 * 수신자의 users.locale을 따른다 — 베트남어 사용자에게 한국어 알림을 보내면
 * 도달은 해도 읽히지 않는다.
 */
/** 한 건. `title`·`body`는 템플릿에서 왔고 아직 치환 전입니다. */
export interface NotificationRow {
  id: string;
  code: string;
  payload: Record<string, unknown>;
  channel: string;
  read_at: Date | null;
  created_at: Date;
  title: string | null;
  body: string | null;
}

/**
 * 템플릿 치환.
 *
 * `{organizationName}` 같은 자리를 payload로 채웁니다. 없는 키는 **그대로
 * 둡니다** — 빈 문자열로 지우면 '님의 신청이 되었습니다'처럼 말이 되는데
 * 뜻이 없는 문장이 나가고, 그건 틀린 줄도 모릅니다.
 */
export function renderTemplate(text: string | null, payload: Record<string, unknown>): string | null {
  if (!text) return text;
  return text.replace(/\{(\w+)\}/g, (whole, key: string) => {
    const v = payload[key];
    return v === undefined || v === null ? whole : String(v);
  });
}

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

  /**
   * 내 알림.
   *
   * ── 여기가 없어서 알림이 전부 묻혀 있었습니다 ──────────────────────
   * `enqueue`를 부르는 곳이 11군데인데 **읽는 경로가 없었습니다.**
   * 서류 만료도, 지원 상태 변경도, SLA 초과도 전부 표에만 쌓였습니다.
   * 쓰기만 하는 표는 없는 것과 같습니다.
   *
   * ── 문구는 서버가 붙입니다 (docs/02 §10 · §5.15) ─────────────────
   * 오류 코드와 다릅니다. 오류는 클라이언트가 번역하지만, 알림 문구는
   * `notification_templates(code, locale, channel)`에서 옵니다 —
   * 같은 알림이 PUSH·SMS·알림톡으로 나갈 때 채널마다 길이가 달라야 하고,
   * 그 표는 운영자가 코드 배포 없이 고칩니다.
   *
   * **수신자의 locale을 따릅니다.** 베트남어 사용자에게 한국어 알림을
   * 보내면 도달은 해도 읽히지 않습니다. 그 언어 템플릿이 없으면 ko로
   * 내려갑니다 — 문구가 없다고 알림 자체를 감추면, 사용자는 아무 일도
   * 일어나지 않은 줄 압니다.
   */
  listForUser(userId: string, opts: { unreadOnly?: boolean; limit?: number } = {}): Promise<NotificationRow[]> {
    return this.db.query<NotificationRow>(
      `SELECT n.id, n.code, n.payload, n.channel, n.read_at, n.created_at,
              coalesce(t.title, tk.title) AS title,
              coalesce(t.body,  tk.body)  AS body
         FROM notifications n
         JOIN users u ON u.id = n.user_id
         LEFT JOIN notification_templates t
                ON t.code = n.code AND t.channel = n.channel AND t.locale = u.locale
         -- 수신자 언어 템플릿이 없을 때의 대비. 없으면 코드가 그대로 화면에 뜹니다.
         LEFT JOIN notification_templates tk
                ON tk.code = n.code AND tk.channel = n.channel AND tk.locale = 'ko'
        WHERE n.user_id = $1
          AND ($2::boolean IS NOT TRUE OR n.read_at IS NULL)
        ORDER BY n.created_at DESC
        LIMIT $3`,
      [userId, opts.unreadOnly ?? false, opts.limit ?? 50],
    );
  }

  /**
   * 읽음 처리. **본인 것만** — WHERE에 user_id가 들어가는 것이 요점입니다.
   * 컨트롤러에서 확인하고 여기서 빼면, 다음 호출자가 그 확인을 잊습니다.
   */
  async markRead(notificationId: string, userId: string): Promise<boolean> {
    const rows = await this.db.query(
      `UPDATE notifications SET read_at = now()
        WHERE id = $1 AND user_id = $2 AND read_at IS NULL
        RETURNING id`,
      [notificationId, userId],
    );
    return rows.length > 0;
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
