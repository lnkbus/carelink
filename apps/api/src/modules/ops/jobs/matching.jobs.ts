import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { JOBS } from '../../../core/queue/queue.constants';
import { QueueService } from '../../../core/queue/queue.service';
import { ApplicationService } from '../../matching/service/application.service';
import { ClearanceService } from '../../quality/service/clearance.service';
import { NotificationService } from '../service/notification.service';
import type { JobResult } from './expiry.jobs';

/**
 * 매칭·클리어런스 관련 반복 잡.
 *
 * application-no-response가 없으면 지원자가 "연락이 없다"며 이탈한다.
 * clearance-expire가 없으면 무검증 인력이 계속 배정된다 (CLAUDE.md §7).
 */
@Injectable()
export class MatchingJobs implements OnModuleInit {
  private readonly log = new Logger(MatchingJobs.name);

  constructor(
    private readonly queue: QueueService,
    private readonly applications: ApplicationService,
    private readonly clearances: ClearanceService,
    private readonly notifications: NotificationService,
  ) {}

  onModuleInit(): void {
    this.queue.register(JOBS.APPLICATION_NO_RESPONSE.name, () => this.applicationNoResponse());
    this.queue.register(JOBS.CLEARANCE_EXPIRY_WARNING.name, () => this.clearanceExpiryWarning());
    this.queue.register(JOBS.CLEARANCE_EXPIRE.name, () => this.clearanceExpire());
  }

  /** 상태 변경 후 7일 무응답 → 운영자 태스크. */
  async applicationNoResponse(): Promise<JobResult> {
    const rows = await this.applications.staleApplications(JOBS.APPLICATION_NO_RESPONSE.days);
    let acted = 0, skipped = 0;
    for (const row of rows) {
      const dedupeKey = `${row.id}:${row.status}`;
      if (await this.notifications.sentToday(row.candidate_user_id, 'MATCHING_APPLICATION_STALE', dedupeKey)) { skipped++; continue; }
      // 후보자와 운영자 양쪽에 알린다. 후보자는 기다리고 있고, 운영자는 밀어야 한다.
      await this.notifications.enqueue(row.candidate_user_id, 'MATCHING_APPLICATION_STALE', {
        dedupeKey, applicationId: row.id, status: row.status,
        organizationName: row.organization_name, daysStale: JOBS.APPLICATION_NO_RESPONSE.days,
      });
      acted++;
    }
    this.log.log(`application-no-response: 대상 ${rows.length} · 발송 ${acted} · 중복 ${skipped}`);
    return { job: JOBS.APPLICATION_NO_RESPONSE.name, scanned: rows.length, acted, skipped };
  }

  /** 클리어런스 만료 30일 전 알림. 배치 중 인력 우선. */
  async clearanceExpiryWarning(): Promise<JobResult> {
    const rows = await this.clearances.expiringWithin(JOBS.CLEARANCE_EXPIRY_WARNING.warnDays);
    let acted = 0, skipped = 0;
    for (const row of rows) {
      const dedupeKey = `${row.id}:${row.expires_on?.toISOString().slice(0, 10)}`;
      if (await this.notifications.sentToday(row.worker_user_id, 'QUALITY_CLEARANCE_EXPIRING', dedupeKey)) { skipped++; continue; }
      await this.notifications.enqueue(row.worker_user_id, 'QUALITY_CLEARANCE_EXPIRING', {
        dedupeKey, clearanceType: row.clearance_type,
        expiresOn: row.expires_on?.toISOString().slice(0, 10),
        placed: ['PLACED', 'MATCHED'].includes(row.candidate_status ?? ''),
      });
      acted++;
    }
    this.log.log(`clearance-expiry-warning: 대상 ${rows.length} · 발송 ${acted} · 중복 ${skipped}`);
    return { job: JOBS.CLEARANCE_EXPIRY_WARNING.name, scanned: rows.length, acted, skipped };
  }

  /**
   * 만료 시 EXPIRED 전이 + 신규 배정 차단.
   *
   * 차단은 별도 처리가 필요 없다 — 매칭 하드 필터가 클리어런스 6개 PASS를
   * 요구하므로, EXPIRED가 되는 순간 그 인력은 매칭 결과에서 빠진다.
   */
  async clearanceExpire(): Promise<JobResult> {
    const rows = await this.clearances.dueForExpiry();
    for (const row of rows) {
      await this.clearances.setResult(row.id, 'EXPIRED');
      await this.notifications.enqueue(row.worker_user_id, 'QUALITY_CLEARANCE_EXPIRED', {
        dedupeKey: row.id, clearanceType: row.clearance_type,
      });
    }
    this.log.log(`clearance-expire: ${rows.length}건 EXPIRED 전이 — 해당 인력은 매칭 결과에서 제외된다`);
    return { job: JOBS.CLEARANCE_EXPIRE.name, scanned: rows.length, acted: rows.length, skipped: 0 };
  }
}
