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

  async primaryTrackId(candidateId: string): Promise<string | null> {
    const row = await this.db.one<{ track_id: string }>(
      `SELECT track_id FROM candidate_tracks WHERE candidate_id = $1 AND is_primary LIMIT 1`,
      [candidateId],
    );
    return row?.track_id ?? null;
  }
}
