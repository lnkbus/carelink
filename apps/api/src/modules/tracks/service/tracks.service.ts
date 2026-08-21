import { Injectable } from '@nestjs/common';
import { AuditService } from '../../ops/service/audit.service';
import { DomainError } from '../../../core/errors/domain-error';
import {
  TracksRepository, type IndustryRow, type TrackRequirementRow, type TrackRow, type VisaEligibilityRow,
} from '../repository/tracks.repository';
import { VISA_EXCLUDES_FROM_MATCHING, VISA_BLOCKS_AUTO_ASSIGNMENT, type VisaEligibility } from '../tracks.types';

export interface VisaCheckResult {
  eligibility: VisaEligibility;
  /** 매칭 결과에서 아예 빼야 하는가. */
  excludeFromMatching: boolean;
  /** 목록에는 남기되 자동 배정만 막고 운영자 검토 큐로 보내야 하는가. */
  blocksAutoAssignment: boolean;
  targetVisaCode: string | null;
  leadTimeMonths: number | null;
  /** 매칭 제외·차단 시 화면에 함께 노출할 사유 키 (docs/09 §4.1-2). */
  reasonKey: string;
  note: string | null;
}

/**
 * tracks — 산업·트랙·요구사항·매칭 가중치·비자 적격성 (docs/02 §4).
 *
 * 다른 모듈에 노출: getRequirements() · getWeights() · checkVisaEligibility().
 * 트랙 코드를 상수로 하드코딩하지 않는다 — 새 산업을 열 때 배포가 필요해진다 (§5.8).
 */
@Injectable()
export class TracksService {
  constructor(
    private readonly repo: TracksRepository,
    private readonly audit: AuditService,
  ) {}

  listIndustries(activeOnly = true): Promise<IndustryRow[]> {
    return this.repo.listIndustries(activeOnly);
  }

  listTracks(industryId: string | null, activeOnly = true): Promise<TrackRow[]> {
    return this.repo.listTracks(industryId, activeOnly);
  }

  async getTrack(trackId: string): Promise<TrackRow> {
    const track = await this.repo.findTrack(trackId);
    if (!track) throw new DomainError('COMMON_NOT_FOUND', { targetType: 'track', targetId: trackId });
    return track;
  }

  // ── SCR-507 — 버티컬 확장의 실행 창구 ────────────────────────────────

  async createIndustry(input: {
    code: string; labelKo: string; sortOrder: number; actorUserId: string;
  }): Promise<IndustryRow> {
    const row = await this.repo.createIndustry(input);
    await this.audit.record({
      actorUserId: input.actorUserId, action: 'STATUS_CHANGE',
      targetType: 'industry', targetId: row.id,
      after: { code: row.code, labelKo: row.label_ko, isActive: false },
    });
    return row;
  }

  /**
   * 산업·트랙 공개.
   *
   * 만드는 것과 여는 것을 분리한 이유는, 트랙과 요건이 갖춰지기 전에 열면
   * 후보자가 아무것도 할 수 없는 트랙에 지원하기 때문입니다.
   *
   * **트랙을 열 때 요건이 하나도 없으면 막습니다.** 요건 없는 트랙은
   * 아무나 배치 가능하다는 뜻이 되고, 그건 이 플랫폼이 파는 것의 반대입니다.
   */
  async setTrackActive(trackId: string, isActive: boolean, actorUserId: string): Promise<TrackRow> {
    const before = await this.getTrack(trackId);
    if (isActive) {
      const reqs = await this.repo.listRequirements(trackId);
      if (reqs.length === 0) {
        throw new DomainError('TRACK_NO_REQUIREMENTS', {
          trackId, trackCode: before.code,
          reason: 'a track with no requirements would accept anyone; define them before opening it',
        });
      }
    }
    const row = await this.repo.setTrackActive(trackId, isActive);
    await this.audit.record({
      actorUserId, action: 'STATUS_CHANGE', targetType: 'track', targetId: trackId,
      before: { isActive: before.is_active }, after: { isActive },
    });
    return row!;
  }

  async setIndustryActive(id: string, isActive: boolean, actorUserId: string): Promise<IndustryRow> {
    const row = await this.repo.setIndustryActive(id, isActive);
    if (!row) throw new DomainError('COMMON_NOT_FOUND', { targetType: 'industry', targetId: id });
    await this.audit.record({
      actorUserId, action: 'STATUS_CHANGE', targetType: 'industry', targetId: id,
      after: { isActive },
    });
    return row;
  }

  async createTrack(input: {
    industryId: string; code: string; labelKo: string;
    labelVi: string | null; labelEn: string | null;
    qualificationType: string; visaTypes: string[];
    sortOrder: number; actorUserId: string;
  }): Promise<TrackRow> {
    const row = await this.repo.createTrack(input);
    await this.audit.record({
      actorUserId: input.actorUserId, action: 'STATUS_CHANGE',
      targetType: 'track', targetId: row.id,
      after: { code: row.code, industryId: input.industryId, isActive: false },
    });
    return row;
  }

  /**
   * 요건 교체.
   *
   * **자격 요건을 시스템이 판정하지 않습니다** (SCR-507 notes · §6-1).
   * 여기 등록되는 것은 '무엇을 확인해야 하는가'이고, 확인 결과는 사람이
   * 입력합니다. 그래서 요건 행에 합격/불합격 같은 필드가 없습니다.
   */
  async replaceRequirements(trackId: string, rows: {
    kind: string; refCode: string | null; isMandatory: boolean; note: string | null;
  }[], actorUserId: string): Promise<TrackRequirementRow[]> {
    await this.getTrack(trackId);
    const before = await this.repo.listRequirements(trackId);
    await this.repo.replaceRequirements(trackId, rows);
    await this.audit.record({
      actorUserId, action: 'STATUS_CHANGE', targetType: 'track_requirements', targetId: trackId,
      before: { count: before.length, kinds: before.map((r) => r.kind) },
      after: { count: rows.length, kinds: rows.map((r) => r.kind) },
    });
    return this.repo.listRequirements(trackId);
  }

  /** 매칭 가중치 교체. 운영 중 조정이 반드시 발생하므로 코드가 아니라 여기입니다 (§5.5). */
  async replaceWeights(
    trackId: string, rows: { ruleCode: string; maxPoints: number }[], actorUserId: string,
  ): Promise<Record<string, number>> {
    await this.getTrack(trackId);
    const before = await this.getWeights(trackId);
    await this.repo.replaceWeights(trackId, rows);
    await this.audit.record({
      actorUserId, action: 'STATUS_CHANGE', targetType: 'track_matching_weights', targetId: trackId,
      before, after: Object.fromEntries(rows.map((r) => [r.ruleCode, r.maxPoints])),
    });
    return this.getWeights(trackId);
  }

  /** 트랙별 요구 서류·자격·교육. 화면 로직을 분기하지 말고 이 값을 렌더한다. */
  getRequirements(trackId: string): Promise<TrackRequirementRow[]> {
    return this.repo.listRequirements(trackId);
  }

  /**
   * 매칭 가중치. matching_rules 기본값 위에 트랙별 오버라이드를 얹는다.
   * 점수를 코드에 하드코딩하지 않는다 — 운영 중 조정이 반드시 발생한다 (§5.5).
   */
  async getWeights(trackId: string): Promise<Record<string, number>> {
    const base = await this.repo.listWeightOverrides(trackId);
    return Object.fromEntries(base.map((w) => [w.rule_code, w.max_points]));
  }

  listVisaEligibility(trackId: string): Promise<VisaEligibilityRow[]> {
    return this.repo.listVisaEligibility(trackId);
  }

  /**
   * 트랙 × 체류자격 적격성. 매칭 엔진이 점수 계산 **이전에** 호출한다 (docs/06 §9.1).
   *
   * 여기서 적격성을 계산하지 않는다. track_visa_eligibility에 사람이 넣어 둔 값을
   * 읽어 올 뿐이다 — 회색 영역은 PENDING_CONFIRMATION으로 남아 운영자에게 간다
   * (CLAUDE.md §6-11 · docs/06 §9.3).
   *
   * 매트릭스에 없는 조합은 ALLOWED로 넘기지 않는다. 명시되지 않은 조합을
   * 허용으로 해석하면 불법 취업 알선이 될 수 있다 — 모르는 것은 사람에게 보낸다.
   */
  /**
   * 적격성 판정 기록 (§6-1 · §6-11).
   *
   * 시스템은 판정하지 않고 사람이 확인한 결과를 받아 적습니다.
   * 회색 영역은 `PENDING_CONFIRMATION`으로 두고, 경영 판단으로 여는 경우에는
   * `isProvisional`을 참으로 둡니다 — 뒤집힐 것을 전제로 운영해야 하기 때문입니다.
   */
  async recordEligibilityDecision(input: {
    trackId: string; visaCode: string; toEligibility: string;
    isProvisional: boolean; basis: string | null; decidedBy: string;
  }) {
    const result = await this.repo.recordEligibilityDecision(input);
    await this.audit.record({
      actorUserId: input.decidedBy, action: 'STATUS_CHANGE',
      targetType: 'track_visa_eligibility', targetId: `${input.trackId}:${input.visaCode}`,
      before: { eligibility: result.from },
      after: { eligibility: result.to, isProvisional: input.isProvisional, basis: input.basis },
    });
    return result;
  }

  /** 적격성을 바꾸면 누가 영향받는지. 뒤집기 **전에** 확인해야 합니다. */
  affectedByEligibilityChange(trackId: string, visaCode: string) {
    return this.repo.affectedByEligibilityChange(trackId, visaCode);
  }

  async checkVisaEligibility(trackId: string, visaCode: string | null): Promise<VisaCheckResult> {
    if (!visaCode) {
      return {
        eligibility: 'PENDING_CONFIRMATION',
        excludeFromMatching: false,
        blocksAutoAssignment: true,
        targetVisaCode: null,
        leadTimeMonths: null,
        reasonKey: 'visa.check.unknownStatus',
        note: null,
      };
    }

    const row = await this.repo.findVisaEligibility(trackId, visaCode);
    if (!row) {
      return {
        eligibility: 'PENDING_CONFIRMATION',
        excludeFromMatching: false,
        blocksAutoAssignment: true,
        targetVisaCode: null,
        leadTimeMonths: null,
        reasonKey: 'visa.check.combinationNotDefined',
        note: null,
      };
    }

    return {
      eligibility: row.eligibility,
      excludeFromMatching: VISA_EXCLUDES_FROM_MATCHING.includes(row.eligibility),
      blocksAutoAssignment: VISA_BLOCKS_AUTO_ASSIGNMENT.includes(row.eligibility),
      targetVisaCode: row.target_visa_code,
      leadTimeMonths: row.lead_time_months,
      reasonKey: `visa.eligibility.${row.eligibility}`,
      note: row.note,
    };
  }
}
