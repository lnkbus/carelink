import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DbService } from '../../../core/db/db.service';
import { JOBS } from '../../../core/queue/queue.constants';
import { QueueService } from '../../../core/queue/queue.service';
import { DocumentRepository } from '../../talent/repository/document.repository';
import { DocumentService } from '../../talent/service/document.service';
import { NotificationService } from '../service/notification.service';

export interface JobResult {
  job: string;
  scanned: number;
  acted: number;
  skipped: number;
}

/**
 * 만료 관련 반복 잡 3종.
 *
 * 이 잡들이 없으면 "배치 중인 인력의 자격이 조용히 무효화"되고,
 * 체류자격의 경우 만료 상태로 배치가 유지되면 불법 취업이 된다 (CLAUDE.md §7).
 */
@Injectable()
export class ExpiryJobs implements OnModuleInit {
  private readonly log = new Logger(ExpiryJobs.name);

  constructor(
    private readonly queue: QueueService,
    private readonly documents: DocumentRepository,
    private readonly documentService: DocumentService,
    private readonly notifications: NotificationService,
    private readonly db: DbService,
  ) {}

  onModuleInit(): void {
    this.queue.register(JOBS.DOCUMENT_EXPIRY_WARNING.name, () => this.documentExpiryWarning());
    this.queue.register(JOBS.DOCUMENT_EXPIRE.name, () => this.documentExpire());
    this.queue.register(JOBS.VISA_EXPIRY_WARNING.name, () => this.visaExpiryWarning());
  }

  /** 만료 30일 전 서류 알림. 배치 중인 인력을 먼저 처리한다. */
  async documentExpiryWarning(): Promise<JobResult> {
    const rows = await this.documents.expiringWithin(JOBS.DOCUMENT_EXPIRY_WARNING.warnDays);
    let acted = 0, skipped = 0;
    for (const row of rows) {
      const dedupeKey = `${row.id}:${row.expires_at?.toISOString().slice(0, 10)}`;
      if (await this.notifications.sentToday(row.user_id, 'TALENT_DOC_EXPIRING', dedupeKey)) { skipped++; continue; }
      await this.notifications.enqueue(row.user_id, 'TALENT_DOC_EXPIRING', {
        dedupeKey,
        documentId: row.id,
        docType: row.doc_type,
        expiresOn: row.expires_at?.toISOString().slice(0, 10),
        // 배치 중이면 우선 처리 대상임을 알림에 표시한다.
        placed: ['PLACED', 'MATCHED'].includes(row.candidate_status),
      });
      acted++;
    }
    this.log.log(`document-expiry-warning: 대상 ${rows.length} · 발송 ${acted} · 중복 ${skipped}`);
    return { job: JOBS.DOCUMENT_EXPIRY_WARNING.name, scanned: rows.length, acted, skipped };
  }

  /** expires_at 도달 시 EXPIRED 전이. 없으면 만료 서류로 매칭이 나간다. */
  async documentExpire(): Promise<JobResult> {
    const rows = await this.documents.dueForExpiry();
    let acted = 0;
    for (const row of rows) {
      await this.documentService.expire(row.id);
      await this.notifications.enqueue(row.user_id, 'TALENT_DOC_EXPIRED', {
        dedupeKey: row.id, documentId: row.id, docType: row.doc_type,
      });
      acted++;
    }
    this.log.log(`document-expire: ${acted}건 EXPIRED 전이`);
    return { job: JOBS.DOCUMENT_EXPIRE.name, scanned: rows.length, acted, skipped: 0 };
  }

  /**
   * 체류기간 만료 60일/30일 전 알림. 배치 중 인력 우선.
   *
   * 서류 만료보다 이쪽이 중요하다 — 서류가 만료되면 자격이 무효가 되지만
   * 체류자격이 만료되면 불법 취업이 된다 (§5.9).
   */
  async visaExpiryWarning(): Promise<JobResult> {
    const thresholds = [...JOBS.VISA_EXPIRY_WARNING.warnDays];
    const rows = await this.db.query<{
      id: string; user_id: string; visa_status_code: string | null;
      visa_expires_on: Date; status: string; days_left: number;
    }>(
      `SELECT c.id, c.user_id, c.visa_status_code, c.visa_expires_on, c.status,
              (c.visa_expires_on - CURRENT_DATE) AS days_left
         FROM candidates c
        WHERE c.visa_expires_on IS NOT NULL
          AND c.visa_expires_on > CURRENT_DATE
          AND (c.visa_expires_on - CURRENT_DATE) = ANY($1::int[])
        ORDER BY (c.status IN ('PLACED','MATCHED')) DESC, c.visa_expires_on`,
      [thresholds],
    );

    let acted = 0, skipped = 0;
    for (const row of rows) {
      const dedupeKey = `${row.id}:${row.days_left}`;
      if (await this.notifications.sentToday(row.user_id, 'TALENT_VISA_EXPIRING', dedupeKey)) { skipped++; continue; }
      await this.notifications.enqueue(row.user_id, 'TALENT_VISA_EXPIRING', {
        dedupeKey,
        candidateId: row.id,
        daysLeft: row.days_left,
        expiresOn: row.visa_expires_on.toISOString().slice(0, 10),
        placed: ['PLACED', 'MATCHED'].includes(row.status),
      });
      acted++;
    }
    this.log.log(`visa-expiry-warning: 대상 ${rows.length} · 발송 ${acted} · 중복 ${skipped}`);
    return { job: JOBS.VISA_EXPIRY_WARNING.name, scanned: rows.length, acted, skipped };
  }
}
