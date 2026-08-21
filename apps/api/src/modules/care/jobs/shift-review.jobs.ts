import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { JOBS } from '../../../core/queue/queue.constants';
import { QueueService } from '../../../core/queue/queue.service';
import type { JobResult } from '../../ops/jobs/expiry.jobs';
import { CareRepository } from '../repository/care.repository';

/**
 * 24시간 상주 배정 현황 리포트 (docs/07 §5·§7).
 *
 * **알림 잡이 아니라 관찰 잡입니다.** 24시간 상주는 금지가 아니라 하향 관리
 * 대상이고, 관리하려면 숫자가 매일 나와야 합니다. 아무도 보지 않는 지표는
 * 조용히 올라갑니다.
 *
 * 보는 것은 네 가지입니다.
 *   비율      전체 배정 대비 24시간 (건수만 보면 무엇이 늘었는지 모릅니다)
 *   미승인    운영자 승인 없이 24시간으로 돌고 있는 배정 — 0이어야 합니다
 *   직접고용  §5.12 위반. U5 확정 전까지 있어서는 안 됩니다
 *   연속일수  한 사람이 얼마나 오래 붙어 있었는가
 *
 * 마지막 항목이 실제 위험 신호입니다. 총량이 같아도 열 명이 열흘씩 나눠
 * 맡은 것과 한 명이 백일을 맡은 것은 전혀 다른 상태입니다.
 */
const LONG_STINT_DAYS = 30;

@Injectable()
export class ShiftReviewJobs implements OnModuleInit {
  private readonly log = new Logger(ShiftReviewJobs.name);

  constructor(
    private readonly queue: QueueService,
    private readonly repo: CareRepository,
  ) {}

  onModuleInit(): void {
    this.queue.register(JOBS.SHIFT_24H_REVIEW.name, () => this.review());
  }

  async review(): Promise<JobResult> {
    const [snapshot, workers] = await Promise.all([
      this.repo.liveInSnapshot(),
      this.repo.liveInWorkers(),
    ]);

    const liveIn = Number(snapshot?.live_in ?? 0);
    const total = Number(snapshot?.total ?? 0);
    const unapproved = Number(snapshot?.unapproved ?? 0);
    const directEmployment = Number(snapshot?.direct_employment ?? 0);

    if (total === 0) {
      return { job: JOBS.SHIFT_24H_REVIEW.name, scanned: 0, acted: 0, skipped: 0 };
    }

    const ratio = Math.round((liveIn / total) * 1000) / 10;
    this.log.log(`shift-24h-review: 24시간 상주 ${liveIn}/${total}건 (${ratio}%)`);

    // 승인 없이 돌고 있다면 게이트가 뚫린 것입니다. 어디가 뚫렸는지
    // 찾기 전에는 같은 경로로 계속 들어옵니다.
    if (unapproved > 0) {
      this.log.error(
        `  ↳ 운영자 승인 없이 24시간으로 진행 중인 배정 ${unapproved}건 — ` +
        '승인 게이트를 우회한 경로가 있습니다 (§5.12)',
      );
    }

    // §5.12 위반. 근로시간 규정(U5)이 정해지기 전까지 있어서는 안 됩니다.
    if (directEmployment > 0) {
      this.log.error(
        `  ↳ 직접고용 인력의 24시간 배정 ${directEmployment}건 — ` +
        'U5 확정 전까지 배정할 수 없습니다 (§5.12 · docs/12 §3)',
      );
    }

    const longStints = workers.filter((w) => Number(w.days) >= LONG_STINT_DAYS);
    for (const w of longStints) {
      this.log.warn(
        `  ↳ ${w.display_code}: 24시간 상주 ${w.days}일째 (배정 ${w.assignments}건) — ` +
        '교대 인력 투입을 검토하세요',
      );
    }

    return {
      job: JOBS.SHIFT_24H_REVIEW.name,
      scanned: total,
      acted: liveIn,
      // 사람이 봐야 하는 건수. 0이면 오늘은 볼 것이 없다는 뜻입니다.
      skipped: unapproved + directEmployment + longStints.length,
    };
  }
}
