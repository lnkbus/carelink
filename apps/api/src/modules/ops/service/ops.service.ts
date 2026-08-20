import { Injectable } from '@nestjs/common';
import { DomainError } from '../../../core/errors/domain-error';
import { CandidateService } from '../../talent/service/candidate.service';
import { MetricsRepository } from '../repository/metrics.repository';
import { AuditService } from './audit.service';

export interface BulkOutcome {
  requested: number;
  succeeded: number;
  failures: { candidateId: string; code: string; detail?: unknown }[];
}

@Injectable()
export class OpsService {
  constructor(
    private readonly metrics: MetricsRepository,
    private readonly candidates: CandidateService,
    private readonly audit: AuditService,
  ) {}

  async dashboard() {
    const [byTrack, supplyPipeline, channelInflow, referral, todayQueue, exclusionBreakdown] = await Promise.all([
      this.metrics.byTrack(),
      this.metrics.supplyPipeline(),
      this.metrics.channelInflow(),
      this.metrics.referralInflow(),
      this.metrics.todayQueue(),
      this.metrics.exclusionBreakdown(),
    ]);
    return { byTrack, supplyPipeline, channelInflow, referral, todayQueue, exclusionBreakdown };
  }

  /**
   * 일괄 처리. 후보자 100명 단위로 파이프라인을 밀어야 하므로 필수다 (SCR-502 notes).
   *
   * 한 건이 실패해도 나머지를 진행한다. 대신 실패를 삼키지 않고 건별로 사유를 돌려준다 —
   * 100건 중 3건이 조용히 빠지면 운영자는 그 사실을 영영 모른다.
   */
  async bulkUpdate(input: {
    candidateIds: string[];
    operation: 'STATUS' | 'ASSIGNEE' | 'TAG';
    status?: string; assigneeId?: string; tag?: string;
    actorUserId: string;
  }): Promise<BulkOutcome> {
    const failures: BulkOutcome['failures'] = [];
    let succeeded = 0;

    for (const candidateId of input.candidateIds) {
      try {
        switch (input.operation) {
          case 'STATUS':
            if (!input.status) throw new DomainError('COMMON_NOT_FOUND', { reason: 'status is required' });
            // 상태머신을 통과한다. 일괄 처리라고 전이 규칙을 건너뛰지 않는다.
            await this.candidates.changeStatus(candidateId, input.status as never, input.actorUserId);
            break;
          case 'ASSIGNEE':
            await this.candidates.updateProfile(candidateId, { assignee_id: input.assigneeId ?? null }, input.actorUserId);
            break;
          case 'TAG': {
            const before = await this.candidates.getById(candidateId);
            const tags = new Set(before.tags ?? []);
            if (input.tag) tags.add(input.tag);
            await this.candidates.updateProfile(candidateId, { tags: [...tags] }, input.actorUserId);
            break;
          }
        }
        succeeded++;
      } catch (err) {
        const code = err instanceof DomainError ? err.code : 'COMMON_ERROR';
        const detail = err instanceof DomainError ? err.details : undefined;
        failures.push({ candidateId, code, detail });
      }
    }

    await this.audit.record({
      actorUserId: input.actorUserId, action: 'STATUS_CHANGE', targetType: 'candidate_bulk',
      targetId: null,
      after: { operation: input.operation, requested: input.candidateIds.length, succeeded, failed: failures.length },
    });
    return { requested: input.candidateIds.length, succeeded, failures };
  }
}
