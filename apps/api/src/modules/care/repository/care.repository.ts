import { Injectable } from '@nestjs/common';
import { DbService } from '../../../core/db/db.service';
import type { AssignmentStatus, CareRequestStatus } from '../state/care.state';

export interface CareRequestRow {
  id: string; requester_id: string; organization_id: string | null;
  hospital_id: string | null; hospital_name: string | null;
  ward: string | null; service_type: string;
  shift_pattern_code: string | null; shift_approved_by: string | null;
  restricted_flags: string[] | null;
  start_at: Date; end_at: Date | null;
  support_items: string[] | null; mobility_level: string | null;
  cautions: string | null; status: CareRequestStatus;
  sla_due_at: Date | null; created_at: Date;
}

export interface CareAssignmentRow {
  id: string; care_request_id: string; caregiver_id: string;
  status: AssignmentStatus; offered_at: Date; responded_at: Date | null;
  confirmed_by: string | null;
  shift_start_time: string | null; shift_end_time: string | null;
  started_at: Date | null; ended_at: Date | null;
  caregiver_display_code?: string;
}

/**
 * 매칭에 넣을 간병사 사실.
 *
 * **국적이 없습니다.** 타입에도 쿼리에도 없어야 실수로 쓰이지 않습니다 (§5.10).
 * 보호자 화면에도 나가지 않습니다 (§6-21, 2026-08-21 확정).
 */
export interface CaregiverFactsRow {
  caregiver_id: string; user_id: string; display_code: string;
  experience_yrs: number; rating_avg: number | null; completed_count: number;
  available: boolean;
}

const REQUEST_COLS = `r.id, r.requester_id, r.organization_id, r.hospital_id, r.ward,
       r.service_type::text AS service_type, r.shift_pattern_code, r.shift_approved_by,
       r.restricted_flags, r.start_at, r.end_at, r.support_items, r.mobility_level,
       r.cautions, r.status::text AS status, r.sla_due_at, r.created_at,
       h.name AS hospital_name`;
const REQUEST_FROM = `FROM care_requests r LEFT JOIN hospitals h ON h.id = r.hospital_id`;

@Injectable()
export class CareRepository {
  constructor(private readonly db: DbService) {}

  findRequest(id: string): Promise<CareRequestRow | null> {
    return this.db.one<CareRequestRow>(`SELECT ${REQUEST_COLS} ${REQUEST_FROM} WHERE r.id = $1`, [id]);
  }

  /** SCR-505 칸반. 상태별로 묶어 보여주므로 정렬은 SLA 임박 순입니다. */
  listRequests(filter: { status?: string; requesterId?: string; organizationId?: string }): Promise<CareRequestRow[]> {
    return this.db.query<CareRequestRow>(
      `SELECT ${REQUEST_COLS} ${REQUEST_FROM}
        WHERE ($1::text IS NULL OR r.status::text = $1)
          AND ($2::uuid IS NULL OR r.requester_id = $2)
          AND ($3::uuid IS NULL OR r.organization_id = $3)
        ORDER BY r.sla_due_at NULLS LAST, r.created_at DESC`,
      [filter.status ?? null, filter.requesterId ?? null, filter.organizationId ?? null],
    );
  }

  async createRequest(input: {
    requesterId: string; organizationId: string | null; hospitalId: string | null;
    ward: string | null; serviceType: string; shiftPatternCode: string | null;
    startAt: string; endAt: string | null; supportItems: string[];
    mobilityLevel: string | null; cautions: string | null;
    restrictedFlags: string[]; status: CareRequestStatus; slaHours: number;
  }): Promise<CareRequestRow> {
    const row = await this.db.one<{ id: string }>(
      `INSERT INTO care_requests
         (requester_id, organization_id, hospital_id, ward, service_type, shift_pattern_code,
          start_at, end_at, support_items, mobility_level, cautions, restricted_flags,
          status, sla_due_at)
       VALUES ($1,$2,$3,$4,$5::care_service_type,$6,$7,$8,$9,$10,$11,$12,
               $13::care_request_status, now() + ($14 || ' hours')::interval)
       RETURNING id`,
      [input.requesterId, input.organizationId, input.hospitalId, input.ward,
       input.serviceType, input.shiftPatternCode, input.startAt, input.endAt,
       input.supportItems, input.mobilityLevel, input.cautions, input.restrictedFlags,
       input.status, String(input.slaHours)],
    );
    return (await this.findRequest(row!.id))!;
  }

  async setRequestStatus(id: string, status: CareRequestStatus): Promise<void> {
    await this.db.query(
      `UPDATE care_requests SET status = $2::care_request_status WHERE id = $1`,
      [id, status],
    );
  }

  /** 교대 패턴 승인 기록. H24_LIVE_IN은 이것 없이 배정되지 않습니다 (§5.12). */
  async approveShiftPattern(id: string, approvedBy: string): Promise<void> {
    await this.db.query(
      `UPDATE care_requests SET shift_approved_by = $2 WHERE id = $1`, [id, approvedBy],
    );
  }

  findShiftPattern(code: string): Promise<{ code: string; requires_approval: boolean; label_ko: string } | null> {
    return this.db.one(
      `SELECT code, requires_approval, label_ko FROM shift_patterns WHERE code = $1`, [code],
    );
  }

  /**
   * 배정 후보 간병사.
   *
   * 국적·실명을 조회하지 않습니다. 보호자에게는 경력·자격·평점만 나갑니다
   * (§6-21). 가용 여부는 caregiver_availability로 판정합니다 — 이 데이터가
   * 없으면 운영자가 전화로 확인하게 되고 '매칭 시간 단축'이 무너집니다.
   */
  caregiverCandidates(startAt: string, endAt: string | null): Promise<CaregiverFactsRow[]> {
    return this.db.query<CaregiverFactsRow>(
      `SELECT cg.id AS caregiver_id, cg.user_id, cg.display_code,
              COALESCE(cg.experience_yrs, 0)::float AS experience_yrs,
              cg.rating_avg::float AS rating_avg,
              cg.completed_count,
              EXISTS (
                SELECT 1 FROM caregiver_availability a
                 WHERE a.caregiver_id = cg.id AND a.kind = 'AVAILABLE'
                   AND a.starts_at <= $1::timestamptz
                   AND a.ends_at >= COALESCE($2::timestamptz, $1::timestamptz)
              ) AS available
         FROM caregivers cg
        WHERE cg.is_active
        ORDER BY cg.rating_avg DESC NULLS LAST, cg.completed_count DESC`,
      [startAt, endAt],
    );
  }

  listAssignments(careRequestId: string): Promise<CareAssignmentRow[]> {
    return this.db.query<CareAssignmentRow>(
      `SELECT a.id, a.care_request_id, a.caregiver_id, a.status::text AS status,
              a.offered_at, a.responded_at, a.confirmed_by,
              a.shift_start_time::text AS shift_start_time,
              a.shift_end_time::text AS shift_end_time,
              a.started_at, a.ended_at, cg.display_code AS caregiver_display_code
         FROM care_assignments a
         JOIN caregivers cg ON cg.id = a.caregiver_id
        WHERE a.care_request_id = $1
        ORDER BY a.offered_at`,
      [careRequestId],
    );
  }

  findAssignment(id: string): Promise<CareAssignmentRow | null> {
    return this.db.one<CareAssignmentRow>(
      `SELECT a.id, a.care_request_id, a.caregiver_id, a.status::text AS status,
              a.offered_at, a.responded_at, a.confirmed_by,
              a.shift_start_time::text AS shift_start_time,
              a.shift_end_time::text AS shift_end_time,
              a.started_at, a.ended_at, cg.display_code AS caregiver_display_code
         FROM care_assignments a
         JOIN caregivers cg ON cg.id = a.caregiver_id
        WHERE a.id = $1`,
      [id],
    );
  }

  async createAssignment(input: {
    careRequestId: string; caregiverId: string;
    shiftStartTime: string | null; shiftEndTime: string | null;
  }): Promise<CareAssignmentRow> {
    const row = await this.db.one<{ id: string }>(
      `INSERT INTO care_assignments (care_request_id, caregiver_id, shift_start_time, shift_end_time)
       VALUES ($1,$2,$3::time,$4::time) RETURNING id`,
      [input.careRequestId, input.caregiverId, input.shiftStartTime, input.shiftEndTime],
    );
    return (await this.findAssignment(row!.id))!;
  }

  async setAssignmentStatus(
    id: string, status: AssignmentStatus, confirmedBy: string | null,
  ): Promise<void> {
    await this.db.query(
      `UPDATE care_assignments
          SET status = $2::assignment_status,
              responded_at = CASE WHEN $2::text IN ('ACCEPTED','DECLINED')
                                  THEN now() ELSE responded_at END,
              confirmed_by = COALESCE($3, confirmed_by),
              started_at = CASE WHEN $2::text = 'IN_SERVICE' THEN now() ELSE started_at END,
              ended_at   = CASE WHEN $2::text = 'COMPLETED'  THEN now() ELSE ended_at END
        WHERE id = $1`,
      [id, status, confirmedBy],
    );
  }

  /**
   * SLA를 넘긴 미배정 요청. care-assignment-sla 잡이 씁니다.
   *
   * **OPS_REVIEW도 포함합니다.** 업무범위 검토로 막힌 건은 오히려 더 위험합니다 —
   * 운영자가 설명하러 연락하지 않으면 보호자는 그냥 기다리고, 검토 큐는
   * 아무도 보지 않는 곳이 됩니다. 보호자 입장에서 '검토 중'과 '배정 중'은
   * 구분되지 않고 둘 다 그냥 기다리는 시간입니다.
   *
   * DRAFT는 뺍니다 — 아직 제출하지 않은 것이라 기다리는 사람이 없습니다.
   */
  overdueRequests(): Promise<CareRequestRow[]> {
    return this.db.query<CareRequestRow>(
      `SELECT ${REQUEST_COLS} ${REQUEST_FROM}
        WHERE r.status IN ('SUBMITTED','MATCHING','OFFER_SENT','OPS_REVIEW')
          AND r.sla_due_at IS NOT NULL AND r.sla_due_at <= now()
        ORDER BY r.sla_due_at`,
    );
  }

  listServiceItems(): Promise<{ code: string; label_ko: string }[]> {
    return this.db.query(
      `SELECT code, label_ko FROM care_service_items WHERE is_active ORDER BY code`,
    );
  }

  listHospitals(): Promise<{ id: string; name: string; region: string | null; active_caregivers: number }[]> {
    // 공급이 없는 병원을 노출하면 신청은 들어오고 배정은 안 되어 취소율이 오릅니다.
    return this.db.query(
      `SELECT id, name, region, active_caregivers FROM hospitals WHERE is_partner ORDER BY name`,
    );
  }
}
