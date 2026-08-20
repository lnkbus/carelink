import { Injectable, Logger } from '@nestjs/common';
import { DomainError } from '../../../core/errors/domain-error';
import { OrganizationService } from '../../org/service/organization.service';
import { ClearanceService } from '../../quality/service/clearance.service';
import { CandidateService } from '../../talent/service/candidate.service';
import { TracksService } from '../../tracks/service/tracks.service';
import { MatchEngine, type CandidateFacts, type JobCriteria, type MatchingRule } from '../engine/match.engine';
import type { MatchRunResult } from '../engine/match.types';
import { JobRepository, type JobRow } from '../repository/job.repository';
import { MatchRepository } from '../repository/match.repository';
import { isJobOpen } from '../state/job.state';

/**
 * 매칭 실행. docs/02 §7.
 *
 * 모듈 경계: candidates 테이블을 직접 SELECT 하지 않고
 * talent의 getCandidatesForMatching()을 통한다 (§5.1).
 */
@Injectable()
export class MatchingService {
  private readonly log = new Logger(MatchingService.name);

  constructor(
    private readonly jobs: JobRepository,
    private readonly matches: MatchRepository,
    private readonly engine: MatchEngine,
    private readonly candidates: CandidateService,
    private readonly tracks: TracksService,
    private readonly clearances: ClearanceService,
    private readonly orgs: OrganizationService,
  ) {}

  async runMatching(jobId: string, actorId: string | null): Promise<MatchRunResult> {
    const job = await this.jobs.findById(jobId);
    if (!job) throw new DomainError('COMMON_NOT_FOUND', { targetType: 'job', targetId: jobId });
    if (!isJobOpen(job.status)) throw new DomainError('MATCHING_JOB_NOT_OPEN', { jobId, status: job.status });

    // 검증되지 않은 기관에는 후보자가 나가지 않는다 (§6-6).
    await this.orgs.assertCanViewCandidates(job.organization_id);

    const [rows, ruleRows, trackWeights, mandatory] = await Promise.all([
      this.candidates.getCandidatesForMatching(job.track_id),
      this.matches.listActiveRules(),
      this.tracks.getWeights(job.track_id),
      this.jobs.listMandatoryRequirements(jobId),
    ]);

    // 트랙별 오버라이드를 기본 룰 위에 얹는다 (§5.5 · docs/02 §7.2).
    const rules: MatchingRule[] = ruleRows.map((r) => ({
      ruleCode: r.rule_code,
      maxPoints: trackWeights[r.rule_code] ?? r.max_points,
      params: scaleParams(r.params as Record<string, number>, r.max_points, trackWeights[r.rule_code]),
    }));

    // 클리어런스와 비자 적격성을 후보자 수만큼 쿼리하지 않도록 한 번에 모은다.
    const readiness = await this.clearances.readinessByWorker(rows.map((r) => r.user_id));
    const visaChecks = new Map<string, Awaited<ReturnType<TracksService['checkVisaEligibility']>>>();
    for (const code of new Set(rows.map((r) => r.visa_status_code))) {
      visaChecks.set(code ?? '', await this.tracks.checkVisaEligibility(job.track_id, code));
    }

    const facts: CandidateFacts[] = rows.map((r) => {
      const ready = readiness.get(r.user_id) ?? { ready: false, missing: [], expired: [] };
      const visa = visaChecks.get(r.visa_status_code ?? '')!;
      return {
        candidateId: r.candidate_id,
        displayCode: r.display_code,
        status: r.status,
        regions: r.regions ?? [],
        availableFrom: r.available_from,
        dormRequired: r.dorm_required,
        employmentTypes: r.employment_types ?? [],
        experienceMonths: r.experience_months,
        koreanLevelCode: r.korean_level_code,
        mandatoryTrainingDone: r.mandatory_training_done,
        documentsAllVerified: r.documents_all_verified,
        documentsPartiallyVerified: r.documents_partially_verified,
        visaStatusCode: r.visa_status_code,
        visaExpiresOn: r.visa_expires_on,
        clearanceComplete: ready.ready,
        clearanceMissing: [...ready.missing, ...ready.expired],
        visaEligibility: visa.eligibility,
        visaExcludes: visa.excludeFromMatching,
        visaBlocksAutoAssignment: visa.blocksAutoAssignment,
        visaReasonKey: visa.reasonKey,
      };
    });

    const criteria: JobCriteria = {
      jobId: job.id,
      trackId: job.track_id,
      region: job.region,
      employmentType: job.employment_type,
      minExperienceYears: Number(job.min_experience_yrs ?? 0),
      languageLevel: job.language_level,
      dormProvided: job.dorm_provided,
      startDate: job.start_date,
      mandatoryRequirements: mandatory.map((m) => m.requirement),
    };

    const result = this.engine.run(criteria, facts, rules);
    await this.matches.saveMatches(jobId, result.matched);

    // 추천과 제외를 전부 남긴다. 이 로그가 Phase 4 AI 매칭의 학습 데이터다.
    await this.matches.logDecisions(
      jobId,
      [
        ...result.matched.map((m) => ({ candidateId: m.candidateId, action: 'RECOMMENDED', score: m.score, reason: null })),
        ...result.excluded.map((e) => ({ candidateId: e.candidateId, action: 'EXCLUDED', score: null, reason: `${e.filterCode}:${e.reasonKey}` })),
      ],
      actorId,
    );

    this.log.log(`매칭 ${jobId}: 모수 ${result.scanned} · 제안 ${result.matched.length} · 제외 ${result.excluded.length}`);
    return result;
  }

  getJob(jobId: string): Promise<JobRow | null> { return this.jobs.findById(jobId); }
  listMatches(jobId: string) { return this.matches.listMatches(jobId); }
  exclusionSummary(jobId: string) { return this.matches.exclusionSummary(jobId); }
}

/**
 * 트랙 오버라이드로 만점이 바뀌면 세부 배점도 같은 비율로 맞춘다.
 * 그러지 않으면 DOCUMENT 만점을 25로 올려도 all_verified가 15에 머물러
 * 오버라이드가 사실상 무효가 된다.
 */
function scaleParams(params: Record<string, number>, baseMax: number, override?: number): Record<string, number> {
  if (!override || override === baseMax || baseMax === 0) return params;
  const ratio = override / baseMax;
  return Object.fromEntries(Object.entries(params).map(([k, v]) => [k, Math.round(v * ratio)]));
}
