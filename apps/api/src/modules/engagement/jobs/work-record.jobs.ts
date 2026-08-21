import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { DomainError } from '../../../core/errors/domain-error';
import { JOBS } from '../../../core/queue/queue.constants';
import { QueueService } from '../../../core/queue/queue.service';
import type { JobResult } from '../../ops/jobs/expiry.jobs';
import { WorkRecordRepository } from '../repository/work-record.repository';
import { WorkRecordService } from '../service/work-record.service';

/**
 * 근무 기록 집계 (docs/02 §12-12.5).
 *
 * 완료된 간병 배정을 코어의 `work_records`로 올립니다.
 *
 * **건너뛴 건을 조용히 넘기지 않습니다.** 24시간 상주(U5)나 활성 배치 없음처럼
 * 집계할 수 없는 건은 사유별로 세어 로그에 남깁니다 — 정산에서 빠진 것을
 * 아무도 모르는 상태가 가장 위험합니다.
 */
@Injectable()
export class WorkRecordJobs implements OnModuleInit {
  private readonly log = new Logger(WorkRecordJobs.name);

  constructor(
    private readonly queue: QueueService,
    private readonly repo: WorkRecordRepository,
    private readonly service: WorkRecordService,
  ) {}

  onModuleInit(): void {
    this.queue.register(JOBS.WORK_RECORD_AGGREGATE.name, () => this.aggregate());
  }

  async aggregate(): Promise<JobResult> {
    const pending = await this.repo.pendingAssignments(JOBS.WORK_RECORD_AGGREGATE.batchSize);
    let acted = 0;
    const skippedBy: Record<string, number> = {};

    for (const row of pending) {
      try {
        await this.service.aggregateAssignment({
          assignmentId: row.assignment_id, actorUserId: null,
        });
        acted++;
      } catch (e) {
        const code = e instanceof DomainError ? e.code : 'UNKNOWN';
        skippedBy[code] = (skippedBy[code] ?? 0) + 1;
        // 예상 못 한 오류는 잡을 멈추지 않되 로그에 남깁니다.
        if (!(e instanceof DomainError)) {
          this.log.error(`work-record-aggregate: ${row.assignment_id} — ${e}`);
        }
      }
    }

    const skipped = Object.values(skippedBy).reduce((a, b) => a + b, 0);
    if (skipped > 0) {
      const detail = Object.entries(skippedBy).map(([k, v]) => `${k}=${v}`).join(' · ');
      this.log.warn(
        `work-record-aggregate: 대상 ${pending.length} · 집계 ${acted} · 건너뜀 ${skipped} (${detail})`,
      );
      // U5로 막힌 건은 별도로 짚습니다. 시간이 지나도 안 풀리는 건이라
      // 다른 실패와 섞이면 묻힙니다.
      const blocked = skippedBy['ENGAGEMENT_PAYOUT_UNAVAILABLE'] ?? 0;
      if (blocked > 0) {
        this.log.warn(
          `  ↳ ${blocked}건은 24시간 상주라 U5(휴게·대기 시간 판정) 확정 전까지 집계할 수 없습니다`,
        );
      }
    } else if (pending.length > 0) {
      this.log.log(`work-record-aggregate: 집계 ${acted}건`);
    }

    return { job: JOBS.WORK_RECORD_AGGREGATE.name, scanned: pending.length, acted, skipped };
  }
}
