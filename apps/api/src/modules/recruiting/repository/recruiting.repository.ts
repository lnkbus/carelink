import { Injectable } from '@nestjs/common';
import { DbService } from '../../../core/db/db.service';
import type { CohortStage, CohortStatus } from '../state/cohort.state';

export interface PartnerRow {
  id: string; partner_type: string; name: string; region: string | null;
  status: string; contact_name: string | null; contact_phone: string | null;
  contract_signed_on: Date | null; note: string | null;
}

export interface CohortRow {
  id: string; channel_id: string; code: string; name: string;
  training_partner_id: string | null; target_size: number | null;
  starts_on: Date | null; expected_placement_on: Date | null; status: CohortStatus; note: string | null;
  channel_code?: string;
}

export interface CohortMemberRow {
  id: string; cohort_id: string; candidate_id: string; stage: CohortStage;
  joined_at: Date; dropped_at: Date | null; dropped_stage: string | null;
  drop_reason: string | null; placed_at: Date | null; display_code?: string;
}

@Injectable()
export class RecruitingRepository {
  constructor(private readonly db: DbService) {}

  listPartners(type?: string): Promise<PartnerRow[]> {
    return this.db.query<PartnerRow>(
      `SELECT id, partner_type::text AS partner_type, name, region, status::text AS status,
              contact_name, contact_phone, contract_signed_on, note
         FROM partners WHERE ($1::text IS NULL OR partner_type::text = $1)
        ORDER BY name`,
      [type ?? null],
    );
  }

  listChannels(): Promise<{ id: string; code: string; label_ko: string; target_headcount_3y: number | null; priority_order: number; is_active: boolean }[]> {
    return this.db.query(
      `SELECT id, code, label_ko, target_headcount_3y, priority_order, is_active
         FROM recruiting_channels ORDER BY priority_order`,
    );
  }

  /**
   * 채널별 CAC. 캠페인 비용 ÷ 배치 성공 인원 (docs/08 §7.4).
   * 배치 0명이면 CAC를 계산하지 않는다 — 0으로 나눈 값보다 '아직 없음'이 정직하다.
   */
  channelCac(): Promise<{ channel_code: string; label_ko: string; cost: string; candidates: string; placed: string; cac: string | null }[]> {
    return this.db.query(
      `SELECT rc.code AS channel_code, rc.label_ko,
              COALESCE(SUM(rcam.cost_amount), 0)::text AS cost,
              (SELECT count(*) FROM candidates c WHERE c.channel_id = rc.id)::text AS candidates,
              (SELECT count(*) FROM candidates c WHERE c.channel_id = rc.id AND c.status = 'PLACED')::text AS placed,
              CASE WHEN (SELECT count(*) FROM candidates c WHERE c.channel_id = rc.id AND c.status = 'PLACED') > 0
                   THEN round(COALESCE(SUM(rcam.cost_amount), 0)::numeric
                        / (SELECT count(*) FROM candidates c WHERE c.channel_id = rc.id AND c.status = 'PLACED'))::text
                   ELSE NULL END AS cac
         FROM recruiting_channels rc
         LEFT JOIN recruiting_campaigns rcam ON rcam.channel_id = rc.id
        GROUP BY rc.id, rc.code, rc.label_ko, rc.priority_order
        ORDER BY rc.priority_order`,
    );
  }

  findChannelIdByCode(code: string): Promise<{ id: string } | null> {
    return this.db.one<{ id: string }>(
      `SELECT id FROM recruiting_channels WHERE code = $1 AND is_active = true`, [code],
    );
  }

  findCampaign(id: string): Promise<{ id: string; channel_id: string } | null> {
    return this.db.one<{ id: string; channel_id: string }>(
      `SELECT id, channel_id FROM recruiting_campaigns WHERE id = $1`, [id],
    );
  }

  /**
   * 기존 인력 추천 집계. 채널이 아니라 별도 축이다 (§5.13).
   *
   * referred_by는 세그먼트 채널과 직교한다 — 동포 채널로 들어온 사람이 지인을
   * 데려올 수 있다. 채널 표에 섞으면 실측상 전환율이 가장 높은 유입 경로가
   * 다른 채널 뒤에 숨는다. 비용은 추천 보상이 정해진 뒤 붙는다.
   */
  referralStats(): Promise<{ candidates: string; placed: string; referrers: string }[]> {
    return this.db.query(
      `SELECT count(*)::text AS candidates,
              count(*) FILTER (WHERE status = 'PLACED')::text AS placed,
              count(DISTINCT referred_by)::text AS referrers
         FROM candidates WHERE referred_by IS NOT NULL`,
    );
  }

  listCohorts(): Promise<CohortRow[]> {
    return this.db.query<CohortRow>(
      `SELECT c.id, c.channel_id, c.code, c.name, c.training_partner_id, c.target_size,
              c.starts_on, c.expected_placement_on, c.status::text AS status, c.note,
              rc.code AS channel_code
         FROM cohorts c JOIN recruiting_channels rc ON rc.id = c.channel_id
        ORDER BY c.starts_on DESC NULLS LAST`,
    );
  }

  findCohort(id: string): Promise<CohortRow | null> {
    return this.db.one<CohortRow>(
      `SELECT c.id, c.channel_id, c.code, c.name, c.training_partner_id, c.target_size,
              c.starts_on, c.expected_placement_on, c.status::text AS status, c.note,
              rc.code AS channel_code
         FROM cohorts c JOIN recruiting_channels rc ON rc.id = c.channel_id WHERE c.id = $1`,
      [id],
    );
  }

  async createCohort(input: {
    channelId: string; code: string; name: string; trainingPartnerId: string | null;
    targetSize: number | null; startsOn: string | null; expectedPlacementOn: string | null;
  }): Promise<CohortRow> {
    const row = await this.db.one<{ id: string }>(
      `INSERT INTO cohorts (channel_id, code, name, training_partner_id, target_size, starts_on, expected_placement_on)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [input.channelId, input.code, input.name, input.trainingPartnerId,
       input.targetSize, input.startsOn, input.expectedPlacementOn],
    );
    return (await this.findCohort(row!.id))!;
  }

  async setCohortStatus(id: string, status: CohortStatus): Promise<void> {
    await this.db.query(`UPDATE cohorts SET status = $2 WHERE id = $1`, [id, status]);
  }

  listMembers(cohortId: string): Promise<CohortMemberRow[]> {
    return this.db.query<CohortMemberRow>(
      `SELECT m.id, m.cohort_id, m.candidate_id, m.stage, m.joined_at, m.dropped_at,
              m.dropped_stage, m.drop_reason, m.placed_at, c.display_code
         FROM cohort_members m JOIN candidates c ON c.id = m.candidate_id
        WHERE m.cohort_id = $1 ORDER BY m.joined_at`,
      [cohortId],
    );
  }

  findMember(id: string): Promise<CohortMemberRow | null> {
    return this.db.one<CohortMemberRow>(
      `SELECT m.id, m.cohort_id, m.candidate_id, m.stage, m.joined_at, m.dropped_at,
              m.dropped_stage, m.drop_reason, m.placed_at, c.display_code
         FROM cohort_members m JOIN candidates c ON c.id = m.candidate_id WHERE m.id = $1`,
      [id],
    );
  }

  async addMember(cohortId: string, candidateId: string): Promise<CohortMemberRow | null> {
    const row = await this.db.one<{ id: string }>(
      `INSERT INTO cohort_members (cohort_id, candidate_id) VALUES ($1, $2)
       ON CONFLICT (cohort_id, candidate_id) DO NOTHING RETURNING id`,
      [cohortId, candidateId],
    );
    return row ? this.findMember(row.id) : null;
  }

  /**
   * 단계 이동. 이탈이면 dropped_stage와 drop_reason을 반드시 함께 남긴다.
   * "이탈률 20%"는 정보가 아니고 "교육 6주차 집중 이탈"은 대응 가능한 정보다 (§5.13).
   */
  async setMemberStage(
    id: string, stage: CohortStage, fromStage: CohortStage, dropReason: string | null,
  ): Promise<void> {
    await this.db.query(
      // $2를 enum 비교와 문자열 비교에 함께 쓰면 PG가 타입을 하나로 좁히지 못한다
      // (inconsistent types deduced for parameter $2). 캐스트를 명시한다.
      `UPDATE cohort_members
          SET stage = $2::text,
              dropped_at    = CASE WHEN $2::text = 'DROPPED' THEN now() ELSE dropped_at END,
              dropped_stage = CASE WHEN $2::text = 'DROPPED' THEN $3::text ELSE dropped_stage END,
              drop_reason   = CASE WHEN $2::text = 'DROPPED' THEN $4::text ELSE drop_reason END,
              placed_at     = CASE WHEN $2::text = 'PLACED' THEN now() ELSE placed_at END
        WHERE id = $1`,
      [id, stage, fromStage, dropReason],
    );
  }

  /**
   * 퍼널 집계. 이탈자는 '도달한 마지막 단계'로 센다.
   *
   * 교육 6주차에 이탈한 사람도 APPLIED·SELECTED·IN_TRAINING은 실제로 지나왔다.
   * 현재 stage(=DROPPED)로만 세면 앞 단계 인원이 통째로 사라져 전환율이 붕괴한다 —
   * 이탈이 많은 기수일수록 퍼널이 더 좋아 보이는 역설이 생긴다 (§5.13 · SCR-511).
   */
  funnel(cohortId: string): Promise<{ stage: string; count: string }[]> {
    return this.db.query(
      `SELECT CASE WHEN stage = 'DROPPED' THEN COALESCE(dropped_stage, 'APPLIED') ELSE stage END AS stage,
              count(*)::text AS count
         FROM cohort_members WHERE cohort_id = $1
        GROUP BY 1`,
      [cohortId],
    );
  }

  dropAnalysis(cohortId: string): Promise<{ dropped_stage: string; drop_reason: string | null; count: string }[]> {
    return this.db.query(
      `SELECT COALESCE(dropped_stage, '(미기록)') AS dropped_stage,
              drop_reason, count(*)::text AS count
         FROM cohort_members WHERE cohort_id = $1 AND stage = 'DROPPED'
        GROUP BY dropped_stage, drop_reason ORDER BY count(*) DESC`,
      [cohortId],
    );
  }
}
