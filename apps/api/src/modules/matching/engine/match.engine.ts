import { Injectable, Logger } from '@nestjs/common';
import type { MatchExclusion, MatchReason, MatchResult, MatchRunResult } from './match.types';

/** matching_rules 한 행. 점수를 코드에 하드코딩하지 않는다 (§5.5). */
export interface MatchingRule {
  ruleCode: string;
  maxPoints: number;
  params: Record<string, unknown>;
}

export interface JobCriteria {
  jobId: string;
  trackId: string;
  region: string;
  employmentType: string | null;
  minExperienceYears: number;
  languageLevel: string | null;
  dormProvided: boolean;
  startDate: Date | null;
  mandatoryRequirements: string[];
}

/** 매칭에 들어가는 후보자 정보. 국적은 여기 없다 — 의도적이다 (§5.10). */
export interface CandidateFacts {
  candidateId: string;
  displayCode: string;
  status: string;
  regions: string[];
  availableFrom: Date | null;
  dormRequired: boolean;
  employmentTypes: string[];
  experienceMonths: number;
  /** 'TOPIK_4' 형태. 국적이 아니라 객관 지표로 평가한다 (docs/07 §2.2). */
  koreanLevelCode: string | null;
  mandatoryTrainingDone: boolean;
  documentsAllVerified: boolean;
  documentsPartiallyVerified: boolean;
  visaStatusCode: string | null;
  visaExpiresOn: Date | null;
  /** 6개 클리어런스가 전부 PASS인가 (§5.11). */
  clearanceComplete: boolean;
  clearanceMissing: string[];
  /** track_visa_eligibility 조회 결과. 점수 계산 이전에 적용된다 (§5.9). */
  visaEligibility: string;
  visaExcludes: boolean;
  visaBlocksAutoAssignment: boolean;
  visaReasonKey: string;
}

const TOPIK_ORDER = ['BASIC', 'TOPIK_1', 'TOPIK_2', 'TOPIK_3', 'TOPIK_4', 'TOPIK_5', 'TOPIK_6', 'NATIVE'];

/**
 * 룰 기반 매칭 엔진 (docs/02 §7).
 *
 * V1에 AI를 넣지 않는다. 학습 데이터가 없기도 하지만, 더 중요한 이유는
 * 기관이 점수가 아니라 **근거**를 요구하기 때문이다. 룰 기반은 근거를
 * 문장으로 출력할 수 있다.
 *
 * 순수 함수로 둔다 — DB 접근은 호출자가 하고 여기서는 계산만 한다.
 * 그래야 골든 케이스 테스트를 DB 없이 돌릴 수 있다 (docs/02 §13).
 */
@Injectable()
export class MatchEngine {
  private readonly log = new Logger(MatchEngine.name);

  run(job: JobCriteria, candidates: CandidateFacts[], rules: MatchingRule[]): MatchRunResult {
    const matched: MatchResult[] = [];
    const excluded: MatchExclusion[] = [];

    for (const c of candidates) {
      const exclusion = this.hardFilter(job, c);
      if (exclusion) {
        excluded.push(exclusion);
        // 자동 배정만 막는 경우(PENDING_CONFIRMATION)는 목록에는 남긴다.
        // 운영자 검토 큐로 가야 하므로 점수도 계산해 둔다 (§5.9).
        if (exclusion.severity !== 'BLOCKED_FOR_REVIEW') continue;
      }
      matched.push(this.score(job, c, rules));
    }

    matched.sort((a, b) => b.score - a.score);
    return { jobId: job.jobId, matched, excluded, scanned: candidates.length };
  }

  /**
   * 하드 필터. 점수 계산 **이전에** 적용한다 (docs/06 §9.1).
   *
   * 비자 부적격 인력을 배치하면 불법 취업 알선이 된다. 편의 기능이 아니라
   * 컴플라이언스 게이트이므로 점수가 아무리 높아도 통과시키지 않는다.
   */
  private hardFilter(job: JobCriteria, c: CandidateFacts): MatchExclusion | null {
    const base = { candidateId: c.candidateId, displayCode: c.displayCode };

    // 체류자격을 가장 먼저 본다. 나머지 조건이 아무리 좋아도 이게 막히면 끝이다.
    if (c.visaExcludes) {
      return {
        ...base, filterCode: 'VISA_ELIGIBILITY', reasonKey: c.visaReasonKey,
        params: { eligibility: c.visaEligibility }, severity: 'EXCLUDED',
      };
    }

    // 배치 예정일 이후에 체류자격이 만료되면 그 배치는 불법 취업으로 끝난다.
    if (job.startDate && c.visaExpiresOn && c.visaExpiresOn < job.startDate) {
      return {
        ...base, filterCode: 'VISA_EXPIRES_BEFORE_START', reasonKey: 'match.exclude.visaExpiresBeforeStart',
        params: { visaExpiresOn: iso(c.visaExpiresOn), startDate: iso(job.startDate) }, severity: 'EXCLUDED',
      };
    }

    // 클리어런스 6개가 전부 PASS여야 한다. 운영자 예외 처리 경로는 만들지 않는다 (§5.11).
    if (!c.clearanceComplete) {
      return {
        ...base, filterCode: 'CLEARANCE_INCOMPLETE', reasonKey: 'match.exclude.clearanceIncomplete',
        params: { missing: c.clearanceMissing }, severity: 'EXCLUDED',
      };
    }

    if (c.status !== 'READY') {
      return {
        ...base, filterCode: 'STATUS_NOT_READY', reasonKey: 'match.exclude.statusNotReady',
        params: { status: c.status }, severity: 'EXCLUDED',
      };
    }

    if (job.startDate && c.availableFrom && c.availableFrom > job.startDate) {
      return {
        ...base, filterCode: 'AVAILABILITY', reasonKey: 'match.exclude.notAvailableByStart',
        params: { availableFrom: iso(c.availableFrom), startDate: iso(job.startDate) }, severity: 'EXCLUDED',
      };
    }

    // 회색 영역은 제외가 아니라 자동 배정 차단이다. 사람이 판정해야 한다 (§5.9).
    if (c.visaBlocksAutoAssignment) {
      return {
        ...base, filterCode: 'VISA_ELIGIBILITY', reasonKey: c.visaReasonKey,
        params: { eligibility: c.visaEligibility }, severity: 'BLOCKED_FOR_REVIEW',
      };
    }

    return null;
  }

  /** matching_rules 기본값 위에 track_matching_weights 오버라이드가 이미 얹혀 들어온다. */
  private score(job: JobCriteria, c: CandidateFacts, rules: MatchingRule[]): MatchResult {
    const reasons: MatchReason[] = [];
    const missing: MatchReason[] = [];

    for (const rule of rules) {
      const outcome = this.applyRule(rule, job, c);
      if (!outcome) continue;
      (outcome.points > 0 ? reasons : missing).push(outcome);
    }

    const score = reasons.reduce((sum, r) => sum + r.points, 0);
    return { candidateId: c.candidateId, displayCode: c.displayCode, score, reasons, missingRequirements: missing };
  }

  private applyRule(rule: MatchingRule, job: JobCriteria, c: CandidateFacts): MatchReason | null {
    const p = rule.params as Record<string, number>;
    const base = { ruleCode: rule.ruleCode, maxPoints: rule.maxPoints };

    switch (rule.ruleCode) {
      case 'REGION': {
        // 시/군/구까지 일치하면 만점, 시/도만 일치하면 부분 점수 (docs/02 §7.2).
        const exact = c.regions.some((r) => r === job.region);
        const province = c.regions.some((r) => sameProvince(r, job.region));
        if (exact) return { ...base, messageKey: 'match.reason.regionExact', params: { region: job.region }, points: p.exact ?? rule.maxPoints };
        if (province) return { ...base, messageKey: 'match.reason.regionProvince', params: { region: job.region }, points: p.province ?? 0 };
        return { ...base, messageKey: 'match.missing.regionMismatch', params: { jobRegion: job.region, candidateRegions: c.regions }, points: 0 };
      }

      case 'EXPERIENCE': {
        const years = c.experienceMonths / 12;
        if (years >= job.minExperienceYears) {
          return { ...base, messageKey: 'match.reason.experienceMet', params: { years: round1(years), required: job.minExperienceYears }, points: p.meets ?? rule.maxPoints };
        }
        return { ...base, messageKey: 'match.missing.experienceShort', params: { years: round1(years), required: job.minExperienceYears }, points: p.below ?? 0 };
      }

      case 'TRAINING':
        return c.mandatoryTrainingDone
          ? { ...base, messageKey: 'match.reason.mandatoryTrainingDone', params: {}, points: p.mandatory_completed ?? rule.maxPoints }
          : { ...base, messageKey: 'match.missing.mandatoryTraining', params: {}, points: 0 };

      case 'DOCUMENT':
        if (c.documentsAllVerified) return { ...base, messageKey: 'match.reason.documentsVerified', params: {}, points: p.all_verified ?? rule.maxPoints };
        if (c.documentsPartiallyVerified) return { ...base, messageKey: 'match.reason.documentsPartial', params: {}, points: p.partial ?? 0 };
        return { ...base, messageKey: 'match.missing.documents', params: {}, points: 0 };

      case 'CONDITION': {
        // 숙소와 근무형태를 따로 채점한다. 하나만 맞아도 부분 점수가 나온다.
        let points = 0;
        const met: string[] = [];
        const unmet: string[] = [];
        if (!c.dormRequired || job.dormProvided) { points += p.dorm_match ?? 0; met.push('dorm'); }
        else unmet.push('dorm');
        if (!job.employmentType || c.employmentTypes.includes(job.employmentType)) {
          points += p.employment_type_match ?? 0; met.push('employmentType');
        } else unmet.push('employmentType');
        return points > 0
          ? { ...base, messageKey: 'match.reason.conditionMatch', params: { met, unmet }, points }
          : { ...base, messageKey: 'match.missing.condition', params: { unmet }, points: 0 };
      }

      case 'LANGUAGE': {
        // 국적이 아니라 TOPIK 등급으로 본다. 간병은 의사소통이 업무의 본질이므로
        // 한국어 수준은 정당한 기준이지만 국적은 아니다 (docs/07 §2.2).
        if (!job.languageLevel) return null;
        const need = TOPIK_ORDER.indexOf(job.languageLevel);
        const have = c.koreanLevelCode ? TOPIK_ORDER.indexOf(c.koreanLevelCode) : -1;
        if (have >= need && need >= 0) {
          return { ...base, messageKey: 'match.reason.languageMet', params: { level: c.koreanLevelCode }, points: p.meets ?? rule.maxPoints };
        }
        if (have >= 0 && need - have === 1) {
          return { ...base, messageKey: 'match.reason.languageOneBelow', params: { level: c.koreanLevelCode, required: job.languageLevel }, points: p.one_below ?? 0 };
        }
        return { ...base, messageKey: 'match.missing.language', params: { level: c.koreanLevelCode, required: job.languageLevel }, points: 0 };
      }

      default:
        // 모르는 룰은 조용히 건너뛰지 않는다. 운영 중 추가된 룰이 반영 안 되는 것을
        // 아무도 모르는 상태가 가장 나쁘다.
        this.log.warn(`처리되지 않은 매칭 룰: ${rule.ruleCode}`);
        return null;
    }
  }
}

function sameProvince(a: string, b: string): boolean {
  return a.split(' ')[0] === b.split(' ')[0];
}
function round1(n: number): number { return Math.round(n * 10) / 10; }
function iso(d: Date): string { return d.toISOString().slice(0, 10); }
