import { Injectable } from '@nestjs/common';
import { DbService } from '../../../core/db/db.service';
import type { VisaEligibility } from '../tracks.types';

export interface IndustryRow { id: string; code: string; label_ko: string; is_active: boolean; sort_order: number }
export interface TrackRow {
  id: string; industry_id: string; code: string; label_ko: string; label_vi: string | null;
  qualification_type: string; visa_types: string[] | null; is_active: boolean; sort_order: number;
}
export interface TrackRequirementRow {
  id: string; track_id: string; kind: string; ref_code: string; is_mandatory: boolean; note: string | null;
}
export interface TrackWeightRow { track_id: string; rule_code: string; max_points: number }
export interface VisaEligibilityRow {
  track_id: string; visa_code: string; eligibility: VisaEligibility;
  target_visa_code: string | null; lead_time_months: number | null; note: string | null;
  /** 잠정 판정이면 뒤집힐 것을 전제로 운영해야 합니다. */
  is_provisional: boolean;
  decided_by: string | null;
  decided_at: Date | null;
}

@Injectable()
export class TracksRepository {
  constructor(private readonly db: DbService) {}

  listIndustries(activeOnly: boolean): Promise<IndustryRow[]> {
    return this.db.query<IndustryRow>(
      `SELECT id, code, label_ko, is_active, sort_order FROM industries
        WHERE ($1::boolean IS NOT TRUE OR is_active) ORDER BY sort_order`,
      [activeOnly],
    );
  }

  listTracks(industryId: string | null, activeOnly: boolean): Promise<TrackRow[]> {
    return this.db.query<TrackRow>(
      `SELECT id, industry_id, code, label_ko, label_vi, qualification_type, visa_types, is_active, sort_order
         FROM tracks
        WHERE ($1::uuid IS NULL OR industry_id = $1)
          AND ($2::boolean IS NOT TRUE OR is_active)
        ORDER BY sort_order`,
      [industryId, activeOnly],
    );
  }

  findTrack(trackId: string): Promise<TrackRow | null> {
    return this.db.one<TrackRow>(
      `SELECT id, industry_id, code, label_ko, label_vi, qualification_type, visa_types, is_active, sort_order
         FROM tracks WHERE id = $1`,
      [trackId],
    );
  }

  listRequirements(trackId: string): Promise<TrackRequirementRow[]> {
    return this.db.query<TrackRequirementRow>(
      `SELECT id, track_id, kind, ref_code, is_mandatory, note
         FROM track_requirements WHERE track_id = $1 ORDER BY kind, ref_code`,
      [trackId],
    );
  }

  listWeightOverrides(trackId: string): Promise<TrackWeightRow[]> {
    return this.db.query<TrackWeightRow>(
      `SELECT track_id, rule_code, max_points FROM track_matching_weights WHERE track_id = $1`,
      [trackId],
    );
  }

  findVisaEligibility(trackId: string, visaCode: string): Promise<VisaEligibilityRow | null> {
    return this.db.one<VisaEligibilityRow>(
      `SELECT track_id, visa_code, eligibility, target_visa_code, lead_time_months, note,
              is_provisional, decided_by, decided_at
         FROM track_visa_eligibility WHERE track_id = $1 AND visa_code = $2`,
      [trackId, visaCode],
    );
  }

  /**
   * 적격성 판정 기록.
   *
   * **시스템이 판정하지 않습니다.** 사람이 확인한 결과를 받아 적습니다
   * (§6-1 · §6-11). 이력은 append-only로 별도 테이블에 쌓입니다 —
   * 현재 상태만 들고 있으면 뒤집혔을 때 무엇이 바뀌었는지 알 수 없습니다.
   */
  async recordEligibilityDecision(input: {
    trackId: string; visaCode: string; toEligibility: string;
    isProvisional: boolean; basis: string | null; decidedBy: string;
  }): Promise<{ from: string | null; to: string }> {
    const before = await this.findVisaEligibility(input.trackId, input.visaCode);

    await this.db.query(
      `INSERT INTO visa_eligibility_decisions
         (track_id, visa_code, from_eligibility, to_eligibility, is_provisional, basis, decided_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [input.trackId, input.visaCode, before?.eligibility ?? null, input.toEligibility,
       input.isProvisional, input.basis, input.decidedBy],
    );

    await this.db.query(
      `INSERT INTO track_visa_eligibility
         (track_id, visa_code, eligibility, is_provisional, decided_by, decided_at, note)
       VALUES ($1,$2,$3,$4,$5,now(),$6)
       ON CONFLICT (track_id, visa_code) DO UPDATE
         SET eligibility = EXCLUDED.eligibility,
             is_provisional = EXCLUDED.is_provisional,
             decided_by = EXCLUDED.decided_by,
             decided_at = now(),
             note = COALESCE(EXCLUDED.note, track_visa_eligibility.note)`,
      [input.trackId, input.visaCode, input.toEligibility, input.isProvisional,
       input.decidedBy, input.basis],
    );

    return { from: before?.eligibility ?? null, to: input.toEligibility };
  }

  /**
   * 적격성을 뒤집을 때 영향받는 인력.
   *
   * **이 조회가 잠정 판정을 운영할 수 있게 하는 유일한 근거입니다.**
   * F-4를 열어 배치한 뒤 불가로 뒤집히면 이미 현장에 있는 사람이 불법 취업
   * 상태가 됩니다. 몇 분 안에 명단이 나와야 대응이 됩니다 —
   * 배치 중인 인력을 먼저 내보냅니다.
   */
  affectedByEligibilityChange(trackId: string, visaCode: string): Promise<{
    candidate_id: string; display_code: string; worker_user_id: string;
    candidate_status: string; engagement_id: string | null; organization_name: string | null;
  }[]> {
    return this.db.query(
      `SELECT c.id AS candidate_id, c.display_code, c.user_id AS worker_user_id,
              c.status::text AS candidate_status,
              e.id AS engagement_id, o.name AS organization_name
         FROM candidates c
         JOIN candidate_tracks ct ON ct.candidate_id = c.id AND ct.track_id = $1
         LEFT JOIN engagements e ON e.worker_user_id = c.user_id
                                AND e.track_id = $1
                                AND e.status IN ('ACTIVE', 'CONTRACT_PENDING')
         LEFT JOIN organizations o ON o.id = e.organization_id
        WHERE c.visa_status_code = $2
          AND c.status NOT IN ('INACTIVE', 'SUSPENDED')
        ORDER BY (e.id IS NOT NULL) DESC, c.status DESC`,
      [trackId, visaCode],
    );
  }

  listVisaEligibility(trackId: string): Promise<VisaEligibilityRow[]> {
    return this.db.query<VisaEligibilityRow>(
      `SELECT track_id, visa_code, eligibility, target_visa_code, lead_time_months, note,
              is_provisional, decided_by, decided_at
         FROM track_visa_eligibility WHERE track_id = $1 ORDER BY visa_code`,
      [trackId],
    );
  }
}
