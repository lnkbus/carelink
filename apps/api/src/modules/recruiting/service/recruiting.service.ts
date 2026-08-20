import { Injectable } from '@nestjs/common';
import { DomainError } from '../../../core/errors/domain-error';
import { AuditService } from '../../ops/service/audit.service';
import { CandidateService } from '../../talent/service/candidate.service';
import { RecruitingRepository, type CohortMemberRow, type CohortRow } from '../repository/recruiting.repository';
import { cohortMachine, cohortMemberMachine, FUNNEL_STAGES, type CohortStage, type CohortStatus } from '../state/cohort.state';

export interface FunnelRow {
  stage: CohortStage;
  count: number;
  /** 첫 단계를 100%로 한 상대 전환율. FunnelTable의 전환 바 (design/README §4). */
  conversionPct: number;
}

@Injectable()
export class RecruitingService {
  constructor(
    private readonly repo: RecruitingRepository,
    private readonly audit: AuditService,
    private readonly candidates: CandidateService,
  ) {}

  listPartners(type?: string) { return this.repo.listPartners(type); }
  listChannels() { return this.repo.listChannels(); }
  channelCac() { return this.repo.channelCac(); }
  async referralStats() {
    const [row] = await this.repo.referralStats();
    return {
      candidates: Number(row?.candidates ?? 0),
      placed: Number(row?.placed ?? 0),
      referrers: Number(row?.referrers ?? 0),
    };
  }
  listCohorts() { return this.repo.listCohorts(); }
  listMembers(cohortId: string) { return this.repo.listMembers(cohortId); }
  dropAnalysis(cohortId: string) { return this.repo.dropAnalysis(cohortId); }

  async getCohort(id: string): Promise<CohortRow> {
    const row = await this.repo.findCohort(id);
    if (!row) throw new DomainError('COMMON_NOT_FOUND', { targetType: 'cohort', targetId: id });
    return row;
  }

  createCohort(input: Parameters<RecruitingRepository['createCohort']>[0]) {
    return this.repo.createCohort(input);
  }

  async changeCohortStatus(id: string, to: CohortStatus, actorUserId: string): Promise<CohortRow> {
    const before = await this.getCohort(id);
    cohortMachine.assert(before.status, to);
    await this.repo.setCohortStatus(id, to);
    await this.audit.record({
      actorUserId, action: 'STATUS_CHANGE', targetType: 'cohort', targetId: id,
      before: { status: before.status }, after: { status: to },
    });
    return this.getCohort(id);
  }

  /**
   * 기수 편입. 출처가 비어 있으면 기수의 채널을 유입 채널로 기록한다.
   *
   * 오프라인 설명회로 들어온 사람은 링크를 타고 오지 않아 channel_id가 비어 있다.
   * 그대로 두면 그 기수 전원이 CAC 계산에서 빠져 '비용만 있고 성과가 없는 채널'로
   * 보인다 (§5.13). 이미 출처가 있으면 덮어쓰지 않는다 — 첫 접점이 진실이다.
   */
  async addMember(cohortId: string, candidateId: string, actorUserId: string): Promise<CohortMemberRow> {
    const cohort = await this.getCohort(cohortId);
    const row = await this.repo.addMember(cohortId, candidateId);
    if (!row) throw new DomainError('COMMON_NOT_FOUND', { reason: 'candidate is already in this cohort' });
    try {
      await this.candidates.applyAttribution(candidateId, { channelId: cohort.channel_id }, actorUserId);
    } catch (e) {
      // 이미 출처가 기록돼 있으면 편입 자체는 정상이다.
      if (!(e instanceof DomainError) || e.code !== 'RECRUITING_ATTRIBUTION_LOCKED') throw e;
    }
    return row;
  }

  /**
   * 유입 출처 코드를 id로 해석한다.
   *
   * 채널·캠페인·추천인은 recruiting이 소유한 개념이므로 해석도 여기서 한다.
   * talent는 해석된 id만 받아 기록한다 (§5.1).
   */
  async recordAttribution(input: {
    candidateId: string; channelCode?: string; campaignId?: string;
    referralCode?: string; actorUserId: string | null;
  }): Promise<{ applied: string[]; ignored: string[] }> {
    let channelId: string | null = null;
    if (input.channelCode) {
      const ch = await this.repo.findChannelIdByCode(input.channelCode);
      if (!ch) throw new DomainError('RECRUITING_CHANNEL_UNKNOWN', { channelCode: input.channelCode });
      channelId = ch.id;
    }

    let campaignId: string | null = null;
    if (input.campaignId) {
      const cam = await this.repo.findCampaign(input.campaignId);
      if (!cam) throw new DomainError('COMMON_NOT_FOUND', { targetType: 'campaign', targetId: input.campaignId });
      // 캠페인이 다른 채널 소속이면 CAC 분모와 분자가 어긋난다. 조용히 고치지 않고 막는다.
      if (channelId && cam.channel_id !== channelId) {
        throw new DomainError('RECRUITING_CAMPAIGN_MISMATCH', { campaignId: cam.id, channelCode: input.channelCode });
      }
      campaignId = cam.id;
      channelId = channelId ?? cam.channel_id;
    }

    let referredBy: string | null = null;
    if (input.referralCode) {
      // 추천 코드는 기존 인력의 display_code다. 실명이나 전화번호를 코드로 쓰지 않는다.
      const referrer = await this.candidates.getByDisplayCode(input.referralCode);
      if (!referrer) throw new DomainError('RECRUITING_REFERRER_UNKNOWN', { referralCode: input.referralCode });
      referredBy = referrer.user_id;
    }

    return this.candidates.applyAttribution(
      input.candidateId, { channelId, campaignId, referredBy }, input.actorUserId,
    );
  }

  /**
   * 단계 이동.
   *
   * 이탈에는 사유가 필수다. dropped_stage와 drop_reason이 없으면 퍼널 개선이
   * 불가능하다 — 이 두 필드가 recruiting 모듈의 존재 이유다 (§5.13 · docs/08 §7.4).
   */
  async moveStage(input: {
    memberId: string; to: CohortStage; dropReason: string | null; actorUserId: string;
  }): Promise<CohortMemberRow> {
    const before = await this.repo.findMember(input.memberId);
    if (!before) throw new DomainError('COMMON_NOT_FOUND', { targetType: 'cohort_member', targetId: input.memberId });
    cohortMemberMachine.assert(before.stage, input.to);

    if (input.to === 'DROPPED' && !input.dropReason) {
      throw new DomainError('COMMON_INVALID_TRANSITION', {
        machine: 'recruiting.cohortMember', to: 'DROPPED',
        reason: 'a drop reason is mandatory — a bare drop rate cannot be acted on',
      });
    }

    await this.repo.setMemberStage(input.memberId, input.to, before.stage, input.dropReason);
    await this.audit.record({
      actorUserId: input.actorUserId, action: 'STATUS_CHANGE', targetType: 'cohort_member',
      targetId: input.memberId, before: { stage: before.stage },
      after: { stage: input.to, droppedStage: input.to === 'DROPPED' ? before.stage : null, dropReason: input.dropReason },
    });
    return (await this.repo.findMember(input.memberId))!;
  }

  /** SCR-511 퍼널. 첫 단계를 100%로 한 상대 전환율까지 계산해 준다. */
  async funnel(cohortId: string): Promise<FunnelRow[]> {
    const rows = await this.repo.funnel(cohortId);
    const byStage = new Map(rows.map((r) => [r.stage as CohortStage, Number(r.count)]));

    // 각 단계의 인원은 '그 단계 이상 도달한 누적'이다.
    // 현재 IN_TRAINING인 사람도 APPLIED·SELECTED를 지나온 것이므로,
    // 단계별 스냅샷만 세면 앞 단계가 실제보다 적게 보인다.
    // repo.funnel()이 이탈자를 dropped_stage로 환산해 주므로 여기서는 누적만 계산한다.
    const cumulative: FunnelRow[] = [];
    for (let i = 0; i < FUNNEL_STAGES.length; i++) {
      const reached = FUNNEL_STAGES.slice(i).reduce((sum, s) => sum + (byStage.get(s) ?? 0), 0);
      cumulative.push({ stage: FUNNEL_STAGES[i], count: reached, conversionPct: 0 });
    }
    const base = cumulative[0]?.count ?? 0;
    return cumulative.map((r) => ({ ...r, conversionPct: base === 0 ? 0 : Math.round((r.count / base) * 1000) / 10 }));
  }
}
