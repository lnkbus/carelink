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
      `SELECT track_id, visa_code, eligibility, target_visa_code, lead_time_months, note
         FROM track_visa_eligibility WHERE track_id = $1 AND visa_code = $2`,
      [trackId, visaCode],
    );
  }

  listVisaEligibility(trackId: string): Promise<VisaEligibilityRow[]> {
    return this.db.query<VisaEligibilityRow>(
      `SELECT track_id, visa_code, eligibility, target_visa_code, lead_time_months, note
         FROM track_visa_eligibility WHERE track_id = $1 ORDER BY visa_code`,
      [trackId],
    );
  }
}
