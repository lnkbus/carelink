import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { JOBS } from '../../../core/queue/queue.constants';
import { QueueService } from '../../../core/queue/queue.service';
import { RetentionService } from '../service/retention.service';
import type { JobResult } from './expiry.jobs';

/**
 * 보존기간 자동 파기 (CLAUDE.md §7).
 *
 * **없으면 생기는 일**: 수동 파기 정책은 지켜지지 않습니다. 보존기간이 지난
 * 범죄경력·건강진단서 원본이 계속 남고, 유출 사고가 나면 "지웠어야 하는데
 * 안 지웠다"가 됩니다.
 *
 * 처리하지 않은 정책도 결과에 담습니다 — 조용히 통과시키면 정책을 넣고도
 * 아무 일이 일어나지 않는 것을 아무도 모릅니다.
 */
@Injectable()
export class RetentionJobs implements OnModuleInit {
  private readonly log = new Logger(RetentionJobs.name);

  constructor(
    private readonly queue: QueueService,
    private readonly retention: RetentionService,
  ) {}

  onModuleInit(): void {
    this.queue.register(JOBS.DATA_RETENTION_PURGE.name, () => this.purge());
  }

  async purge(): Promise<JobResult> {
    const outcomes = await this.retention.purgeAll(JOBS.DATA_RETENTION_PURGE.batchSize);
    const purged = outcomes.reduce((n, o) => n + o.purged, 0);
    const unconfirmed = outcomes.reduce((n, o) => n + o.unconfirmed, 0);
    const skipped = outcomes.filter((o) => o.skippedReason !== null);

    if (purged > 0) {
      const detail = outcomes
        .filter((o) => o.purged > 0)
        .map((o) => `${o.dataType}=${o.purged}`)
        .join(' · ');
      this.log.warn(`data-retention-purge: ${purged}건 파기 (${detail})`);
    }
    if (unconfirmed > 0) {
      this.log.warn(`  ↳ ${unconfirmed}건은 오브젝트 저장소 삭제를 확인하지 못했습니다`);
    }
    // 처리 구현이 없는 정책은 매번 알립니다. 한 번 조용히 지나가면
    // 그 정책은 영원히 지나갑니다.
    for (const o of skipped) {
      this.log.log(`  ↳ ${o.dataType} (${o.strategy}) 건너뜀 — ${o.skippedReason}`);
    }

    return {
      job: JOBS.DATA_RETENTION_PURGE.name,
      scanned: outcomes.length,
      acted: purged,
      skipped: skipped.length,
    };
  }
}
