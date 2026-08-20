import { Injectable, Logger } from '@nestjs/common';
import { DbService } from '../../../core/db/db.service';
import type { AuditEntry } from '../../../core/audit/audit.types';

/**
 * 감사 로그 적재. docs/02 §13 · docs/11 §5.
 *
 * audit_logs는 append-only다 (CLAUDE.md §5.4). UPDATE/DELETE 경로를 만들지 않는다.
 * 적재 실패가 본 기능을 막아서는 안 되지만 조용히 사라져서도 안 되므로,
 * 예외는 삼키되 반드시 에러 로그로 남긴다.
 */
@Injectable()
export class AuditService {
  private readonly log = new Logger(AuditService.name);

  constructor(private readonly db: DbService) {}

  async record(entry: AuditEntry): Promise<void> {
    try {
      await this.db.query(
        `INSERT INTO audit_logs (actor_id, action, target_type, target_id, before, after, ip_address)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          entry.actorUserId,
          entry.action,
          entry.targetType,
          entry.targetId,
          entry.before ? JSON.stringify(entry.before) : null,
          entry.after ? JSON.stringify(entry.after) : null,
          entry.ip ?? null,
        ],
      );
    } catch (err) {
      this.log.error(`audit_logs 적재 실패: ${entry.action} ${entry.targetType}/${entry.targetId}`, err as Error);
    }
  }

  /**
   * 개인정보 조회 기록. 조회는 성공했는데 기록이 없으면 안 되므로
   * 호출부에서 반드시 await 한다 (docs/11 §5 — 조회 전량 적재).
   */
  async recordPiiView(actorUserId: string | null, targetType: string, targetId: string, fields: string[]): Promise<void> {
    await this.record({
      actorUserId,
      action: 'VIEW_PII',
      targetType,
      targetId,
      after: { fields },
    });
  }
}
