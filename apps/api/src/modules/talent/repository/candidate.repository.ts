import { Injectable } from '@nestjs/common';
import { DbService } from '../../../core/db/db.service';
import type { CandidateStatus } from '../state/candidate-status.state';

export interface CandidateRow {
  id: string; user_id: string; display_code: string;
  name: string | null; birth_date: Date | null; gender: string | null;
  nationality: string | null;
  visa_status_code: string | null; visa_expires_on: Date | null;
  visa_verified_by: string | null; visa_verified_at: Date | null;
  current_location: string | null; preferred_regions: string[] | null;
  employment_types: string[] | null; dorm_required: boolean; available_from: Date | null;
  status: CandidateStatus; assignee_id: string | null;
  channel_id: string | null; campaign_id: string | null; referred_by: string | null;
  tags: string[] | null; created_at: Date;
  /** users 조인 — 연락처는 users.phone이 원본이다. */
  phone?: string | null;
}

/** 매칭 입력. 국적 필드가 없는 것은 의도다 (§5.10). */
export interface MatchingCandidateRow {
  candidate_id: string; display_code: string; user_id: string; status: string;
  regions: string[]; available_from: Date | null; dorm_required: boolean;
  employment_types: string[]; visa_status_code: string | null; visa_expires_on: Date | null;
  experience_months: number; korean_level_code: string | null;
  mandatory_training_done: boolean;
  documents_all_verified: boolean; documents_partially_verified: boolean;
}

export interface CandidateTrackRow {
  candidate_id: string; track_id: string; is_primary: boolean;
  track_code: string; label_ko: string; qualification_type: string;
}

const SELECT_CANDIDATE = `
  SELECT c.id, c.user_id, c.display_code, c.name, c.birth_date, c.gender, c.nationality,
         c.visa_status_code, c.visa_expires_on, c.visa_verified_by, c.visa_verified_at,
         c.current_location, c.preferred_regions, c.employment_types, c.dorm_required,
         c.available_from, c.status, c.assignee_id, c.channel_id, c.campaign_id,
         c.referred_by, c.tags, c.created_at, u.phone
    FROM candidates c JOIN users u ON u.id = c.user_id`;

@Injectable()
export class CandidateRepository {
  constructor(private readonly db: DbService) {}

  findById(id: string): Promise<CandidateRow | null> {
    return this.db.one<CandidateRow>(`${SELECT_CANDIDATE} WHERE c.id = $1`, [id]);
  }

  findByUserId(userId: string): Promise<CandidateRow | null> {
    return this.db.one<CandidateRow>(`${SELECT_CANDIDATE} WHERE c.user_id = $1`, [userId]);
  }

  /**
   * display_code는 기관에 노출되는 유일한 식별자다. 순번으로 발급한다 —
   * UUID를 노출하면 화면에서 읽히지 않고, 사람이 부를 수 없다.
   */
  async create(userId: string, channelId: string | null, campaignId: string | null, referredBy: string | null): Promise<CandidateRow> {
    const row = await this.db.one<CandidateRow>(
      `INSERT INTO candidates (user_id, display_code, channel_id, campaign_id, referred_by)
       VALUES ($1, 'C-' || LPAD(nextval('candidate_display_seq')::text, 5, '0'), $2, $3, $4)
       RETURNING id`,
      [userId, channelId, campaignId, referredBy],
    );
    return (await this.findById(row!.id))!;
  }

  findByDisplayCode(displayCode: string): Promise<CandidateRow | null> {
    return this.db.one<CandidateRow>(`${SELECT_CANDIDATE} WHERE c.display_code = $1`, [displayCode]);
  }

  /**
   * 유입 출처 기록. COALESCE로 '먼저 기록된 값이 이긴다'.
   *
   * 첫 접점이 진실이다. 나중 값으로 덮어쓰면 채널별 CAC가 마지막으로 만진 채널에
   * 몰려 예산 배분이 틀어진다 (§5.13 · docs/08 §7.4).
   * 반환값은 실제로 채워진 컬럼 — 이미 값이 있던 컬럼은 조용히 무시된 것이므로
   * 호출부가 사용자에게 그대로 알려줄 수 있어야 한다.
   */
  async setAttribution(
    id: string, channelId: string | null, campaignId: string | null, referredBy: string | null,
  ): Promise<{ channel_id: string | null; campaign_id: string | null; referred_by: string | null }> {
    const row = await this.db.one<{ channel_id: string | null; campaign_id: string | null; referred_by: string | null }>(
      `UPDATE candidates
          SET channel_id  = COALESCE(channel_id,  $2::uuid),
              campaign_id = COALESCE(campaign_id, $3::uuid),
              referred_by = COALESCE(referred_by, $4::uuid),
              updated_at  = now()
        WHERE id = $1
        RETURNING channel_id, campaign_id, referred_by`,
      [id, channelId, campaignId, referredBy],
    );
    return row!;
  }

  async updateProfile(id: string, patch: Record<string, unknown>): Promise<void> {
    const cols = Object.keys(patch);
    if (cols.length === 0) return;
    const sets = cols.map((c, i) => `${c} = $${i + 2}`).join(', ');
    await this.db.query(
      `UPDATE candidates SET ${sets}, updated_at = now(), last_activity_at = now() WHERE id = $1`,
      [id, ...cols.map((c) => patch[c])],
    );
  }

  async updateStatus(id: string, status: CandidateStatus): Promise<void> {
    await this.db.query(`UPDATE candidates SET status = $2, updated_at = now() WHERE id = $1`, [id, status]);
  }

  /** 운영자가 확인한 체류자격 결과를 기록한다. 시스템이 판정하지 않는다. */
  async recordVisaVerification(
    id: string, visaStatusCode: string, visaExpiresOn: string | null, verifiedBy: string,
  ): Promise<void> {
    await this.db.query(
      `UPDATE candidates
          SET visa_status_code = $2, visa_expires_on = $3,
              visa_verified_by = $4, visa_verified_at = now(), updated_at = now()
        WHERE id = $1`,
      [id, visaStatusCode, visaExpiresOn, verifiedBy],
    );
  }

  listTracks(candidateId: string): Promise<CandidateTrackRow[]> {
    return this.db.query<CandidateTrackRow>(
      `SELECT ct.candidate_id, ct.track_id, ct.is_primary,
              t.code AS track_code, t.label_ko, t.qualification_type
         FROM candidate_tracks ct JOIN tracks t ON t.id = ct.track_id
        WHERE ct.candidate_id = $1
        ORDER BY ct.is_primary DESC, t.sort_order`,
      [candidateId],
    );
  }

  /**
   * 트랙 선택. is_primary는 후보자당 하나로 강제한다 — 여러 개면 KPI를
   * 트랙별로 분리 집계할 수 없다 (SCR-103 notes · §5.8).
   */
  async addTrack(candidateId: string, trackId: string, isPrimary: boolean): Promise<void> {
    await this.db.tx(async (client) => {
      if (isPrimary) {
        await client.query(`UPDATE candidate_tracks SET is_primary = false WHERE candidate_id = $1`, [candidateId]);
      }
      await client.query(
        `INSERT INTO candidate_tracks (candidate_id, track_id, is_primary) VALUES ($1, $2, $3)
         ON CONFLICT (candidate_id, track_id) DO UPDATE SET is_primary = EXCLUDED.is_primary`,
        [candidateId, trackId, isPrimary],
      );
    });
  }

  async removeTrack(candidateId: string, trackId: string): Promise<void> {
    await this.db.query(`DELETE FROM candidate_tracks WHERE candidate_id = $1 AND track_id = $2`, [candidateId, trackId]);
  }

  /**
   * 매칭 엔진에 넣을 후보자 사실. matching 모듈이 candidates를 직접 SELECT 하지 않고
   * 이 메서드를 통한다 (§5.1 · docs/02 §4).
   *
   * 국적은 조회하지 않는다. 타입에도 없고 쿼리에도 없어야 실수로 쓰이지 않는다 (§5.10).
   * 경력은 experiences_current 뷰를 쓴다 — 재직 중인 경력을 오늘까지로 계산해야
   * 실제보다 짧게 집계되지 않는다.
   */
  getCandidatesForMatching(trackId: string): Promise<MatchingCandidateRow[]> {
    return this.db.query<MatchingCandidateRow>(
      `SELECT c.id                         AS candidate_id,
              c.display_code,
              c.user_id,
              c.status::text               AS status,
              COALESCE(c.preferred_regions, '{}')  AS regions,
              c.available_from,
              c.dorm_required,
              COALESCE(c.employment_types, '{}')   AS employment_types,
              c.visa_status_code,
              c.visa_expires_on,
              COALESCE((SELECT sum(e.months_to_date) FROM experiences_current e
                         WHERE e.candidate_id = c.id), 0)::int AS experience_months,
              (SELECT l.level_code FROM languages l
                WHERE l.candidate_id = c.id AND l.language = 'ko' LIMIT 1) AS korean_level_code,
              EXISTS (SELECT 1 FROM training_enrollments te
                        JOIN training_programs tp ON tp.id = te.program_id
                       WHERE te.candidate_id = c.id AND tp.is_mandatory
                         AND te.status = 'COMPLETED'
                       HAVING count(*) >= (SELECT count(*) FROM training_programs WHERE is_mandatory)
                     ) AS mandatory_training_done,
              NOT EXISTS (SELECT 1 FROM documents d
                           WHERE d.candidate_id = c.id AND d.status <> 'VERIFIED')
                AND EXISTS (SELECT 1 FROM documents d WHERE d.candidate_id = c.id) AS documents_all_verified,
              EXISTS (SELECT 1 FROM documents d
                       WHERE d.candidate_id = c.id AND d.status = 'VERIFIED') AS documents_partially_verified
         FROM candidates c
         JOIN candidate_tracks ct ON ct.candidate_id = c.id AND ct.track_id = $1
        WHERE c.status NOT IN ('INACTIVE', 'SUSPENDED')`,
      [trackId],
    );
  }

  async primaryTrackId(candidateId: string): Promise<string | null> {
    const row = await this.db.one<{ track_id: string }>(
      `SELECT track_id FROM candidate_tracks WHERE candidate_id = $1 AND is_primary LIMIT 1`,
      [candidateId],
    );
    return row?.track_id ?? null;
  }
}
