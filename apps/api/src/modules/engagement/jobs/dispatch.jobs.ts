import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { JOBS } from '../../../core/queue/queue.constants';
import { QueueService } from '../../../core/queue/queue.service';
import type { JobResult } from '../../ops/jobs/expiry.jobs';
import { NotificationService } from '../../ops/service/notification.service';
import { EngagementRepository } from '../repository/engagement.repository';
import { DISPATCH_LIMIT_DAYS } from '../state/dispatch.limit';

/**
 * 파견 2년 한도 사전 경고 (파견법 §6).
 *
 * 한도를 넘기면 사용사업주(기관)에게 **직접고용 의무**가 발생합니다. 과태료가
 * 아니라 고용 관계가 강제로 성립하므로 기관 입장에서는 계약 구조가 통째로
 * 뒤집히고, 그 시점에는 이미 사람이 현장에 있습니다.
 *
 * 그래서 배치 생성 시점의 차단(`EngagementService.assertDispatchAllowed`)과
 * **별개로** 진행 중인 건을 매일 훑습니다. 생성 때는 한도 안이었어도 시간이
 * 지나면 한도에 닿기 때문입니다.
 *
 * 90일/30일 2단계인 이유: 대체 인력을 구하고 인수인계하는 데 시간이 걸립니다.
 * 30일 하나만 두면 그때는 이미 늦습니다.
 */
@Injectable()
export class DispatchJobs implements OnModuleInit {
  private readonly log = new Logger(DispatchJobs.name);

  constructor(
    private readonly queue: QueueService,
    private readonly repo: EngagementRepository,
    private readonly notifications: NotificationService,
  ) {}

  onModuleInit(): void {
    this.queue.register(JOBS.DISPATCH_LIMIT_WARNING.name, () => this.dispatchLimitWarning());
  }

  async dispatchLimitWarning(): Promise<JobResult> {
    const [outerWindow] = JOBS.DISPATCH_LIMIT_WARNING.warnDays;
    const rows = await this.repo.dispatchNearingLimit(outerWindow);

    let acted = 0;
    let skipped = 0;

    for (const row of rows) {
      // 어느 경고 단계에 해당하는지. 30일 이하면 30일 경고로 올립니다.
      const stage = JOBS.DISPATCH_LIMIT_WARNING.warnDays.find((d) => row.days_left <= d);
      if (stage === undefined) { skipped++; continue; }

      // 같은 단계를 하루에 두 번 보내지 않습니다.
      const dedupeKey = `${row.engagement_id}:${stage}`;
      if (await this.notifications.sentToday(row.worker_user_id, 'ENGAGEMENT_DISPATCH_LIMIT_NEAR', dedupeKey)) {
        skipped++;
        continue;
      }

      await this.notifications.enqueue(row.worker_user_id, 'ENGAGEMENT_DISPATCH_LIMIT_NEAR', {
        dedupeKey,
        engagementId: row.engagement_id,
        organizationName: row.organization_name,
        displayCode: row.display_code,
        daysUsed: row.days_used,
        daysLeft: row.days_left,
        limitDays: DISPATCH_LIMIT_DAYS,
        stage,
        // 이미 넘겼다면 경고가 아니라 사고입니다. 알림에 표시해 우선 처리하게 합니다.
        exceeded: row.days_left <= 0,
        // 계약서의 교체 절차를 실행할 시점임을 알림에 함께 보냅니다.
        // 절차가 계약서에 있어도 알려주지 않으면 아무도 시작하지 않습니다.
        action: row.days_left <= 30 ? 'EXECUTE_REPLACEMENT' : 'NOTIFY_ORGANIZATION',
      });
      acted++;
    }

    const exceeded = rows.filter((r) => r.days_left <= 0).length;
    if (exceeded > 0) {
      this.log.error(
        `dispatch-limit-warning: 2년 한도를 이미 초과한 파견 ${exceeded}건 — ` +
        '사용사업주에게 직접고용 의무가 발생했을 수 있습니다',
      );
    }
    this.log.log(`dispatch-limit-warning: 대상 ${rows.length} · 발송 ${acted} · 중복 ${skipped}`);
    return { job: JOBS.DISPATCH_LIMIT_WARNING.name, scanned: rows.length, acted, skipped };
  }
}
