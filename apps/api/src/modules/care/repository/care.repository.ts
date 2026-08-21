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
  /** 홈 화면용. 환자 신원이 아니라 '어디서 언제'입니다. */
  hospital_name?: string | null;
  ward?: string | null;
  start_at?: Date | null;
}

/**
 * 매칭에 넣을 간병사 사실.
 *
 * **국적이 없습니다.** 타입에도 쿼리에도 없어야 실수로 쓰이지 않습니다 (§5.10).
 * 보호자 화면에도 나가지 않습니다 (§6-21, 2026-08-21 확정).
 */
export interface ServiceLogRow {
  id: string; assignment_id: string; log_type: string; item_code: string | null;
  occurred_at: Date; check_method: string | null; geo_point: unknown | null;
  memo: string | null; correction_of: string | null;
  created_by: string | null; created_at: Date;
  /** 이 기록이 나중에 정정됐는가. 지우지 않으므로 표시로 구분합니다. */
  corrected?: boolean;
}

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

  findShiftPattern(code: string): Promise<{
    code: string; requires_approval: boolean; is_active: boolean;
    label_ko: string; hours_per_worker: number;
  } | null> {
    return this.db.one(
      `SELECT code, requires_approval, is_active, label_ko,
              hours_per_worker::float AS hours_per_worker
         FROM shift_patterns WHERE code = $1`,
      [code],
    );
  }

  /** 신규 요청에서 고를 수 있는 교대 패턴. 비활성은 내려보내지 않습니다. */
  listShiftPatterns(): Promise<{
    code: string; label_ko: string; hours_per_worker: number; workers_per_day: number;
    requires_approval: boolean; is_recommended: boolean; note: string | null;
  }[]> {
    return this.db.query(
      `SELECT code, label_ko, hours_per_worker::float AS hours_per_worker,
              workers_per_day, requires_approval, is_recommended, note
         FROM shift_patterns
        WHERE is_active
        ORDER BY sort_order`,
    );
  }

  /**
   * 이 인력의 직전·직후 근무.
   *
   * **퇴근~출근 간격을 보기 위한 것입니다.** 24시간 패턴을 막아도 8시간
   * 교대를 연달아 세 번 받으면 실제로는 24시간이고, 서류상으로는 합법으로
   * 보입니다 — 그쪽이 더 위험합니다.
   *
   * 종료 시각이 없는 요청은 교대 패턴의 시간으로 채웁니다. 없으면 판단할
   * 근거가 없으므로 그 건은 검사에서 빠집니다 (막지 않습니다).
   */
  neighbouringShifts(caregiverId: string, startAt: string, endAt: string): Promise<{
    care_request_id: string; starts_at: Date; ends_at: Date;
  }[]> {
    return this.db.query(
      `SELECT r.id AS care_request_id,
              r.start_at AS starts_at,
              COALESCE(
                r.end_at,
                r.start_at + make_interval(mins => (sp.hours_per_worker * 60)::int)
              ) AS ends_at
         FROM care_assignments a
         JOIN care_requests r  ON r.id = a.care_request_id
         LEFT JOIN shift_patterns sp ON sp.code = r.shift_pattern_code
        WHERE a.caregiver_id = $1
          AND a.status IN ('OFFERED','ACCEPTED','ASSIGNED','IN_SERVICE')
          AND (r.end_at IS NOT NULL OR sp.hours_per_worker IS NOT NULL)
          -- 검사 대상 구간의 앞뒤 하루씩만 봅니다. 전체를 스캔할 이유가 없습니다.
          AND r.start_at <= ($3::timestamptz + interval '1 day')
          AND COALESCE(
                r.end_at,
                r.start_at + make_interval(mins => (sp.hours_per_worker * 60)::int)
              ) >= ($2::timestamptz - interval '1 day')
        ORDER BY r.start_at`,
      [caregiverId, startAt, endAt],
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

  // ── 근무 기록 (SCR-404 · 306) ─────────────────────────────────────────
  //
  // ***** APPEND-ONLY *****
  /** user_id → caregiver_id. 앱은 자기 id를 모릅니다 — 토큰의 user만 압니다. */
  async caregiverIdForUser(userId: string): Promise<string | null> {
    const row = await this.db.one<{ id: string }>(
      `SELECT id FROM caregivers WHERE user_id = $1`, [userId],
    );
    return row?.id ?? null;
  }

  /** 간병사 본인의 가용/차단 구간 (SCR-402). */
  listAvailability(caregiverId: string): Promise<{
    id: string; starts_at: Date; ends_at: Date; kind: string;
  }[]> {
    return this.db.query(
      `SELECT id, starts_at, ends_at, kind
         FROM caregiver_availability
        WHERE caregiver_id = $1 AND ends_at >= now() - interval '7 days'
        ORDER BY starts_at`,
      [caregiverId],
    );
  }

  async addAvailability(input: {
    caregiverId: string; startsAt: string; endsAt: string; kind: string;
  }): Promise<{ id: string; starts_at: Date; ends_at: Date; kind: string }> {
    return (await this.db.one(
      `INSERT INTO caregiver_availability (caregiver_id, starts_at, ends_at, kind)
       VALUES ($1, $2, $3, $4)
       RETURNING id, starts_at, ends_at, kind`,
      [input.caregiverId, input.startsAt, input.endsAt, input.kind],
    ))!;
  }

  /**
   * 구간 삭제.
   *
   * **배정이 걸려 있으면 지우지 않습니다.** 가용 구간을 지운다고 배정이
   * 사라지지는 않는데, 화면에서는 사라진 것처럼 보입니다 — 그 상태로
   * 간병사가 안 나오면 병실에 사람이 없습니다.
   */
  async deleteAvailability(caregiverId: string, id: string): Promise<'DELETED' | 'BOOKED' | 'NOT_FOUND'> {
    const row = await this.db.one<{ id: string; starts_at: Date; ends_at: Date }>(
      `SELECT id, starts_at, ends_at FROM caregiver_availability WHERE id = $1 AND caregiver_id = $2`,
      [id, caregiverId],
    );
    if (!row) return 'NOT_FOUND';

    const booked = await this.db.one<{ n: string }>(
      `SELECT count(*)::text AS n
         FROM care_assignments a
         JOIN care_requests r ON r.id = a.care_request_id
        WHERE a.caregiver_id = $1
          AND a.status IN ('OFFERED','ACCEPTED','ASSIGNED','IN_SERVICE')
          AND r.start_at < $3
          AND COALESCE(r.end_at, r.start_at) >= $2`,
      [caregiverId, row.starts_at.toISOString(), row.ends_at.toISOString()],
    );
    if (Number(booked?.n ?? 0) > 0) return 'BOOKED';

    await this.db.query(`DELETE FROM caregiver_availability WHERE id = $1`, [id]);
    return 'DELETED';
  }

  /** 간병사 → 인력 user_id. 코어(engagement)에 물어보려면 이 값이 필요합니다. */
  async caregiverUserId(caregiverId: string): Promise<string | null> {
    const row = await this.db.one<{ user_id: string }>(
      `SELECT user_id FROM caregivers WHERE id = $1`, [caregiverId],
    );
    return row?.user_id ?? null;
  }

  /**
   * 24시간 상주 배정 현황 (docs/07 §5·§7).
   *
   * **비율이 지표입니다.** 건수만 보면 전체가 늘어난 것인지 24시간이 늘어난
   * 것인지 구분되지 않습니다. 하향 관리 대상이라 추이가 필요합니다.
   */
  liveInSnapshot(): Promise<{
    live_in: string; total: string; unapproved: string; direct_employment: string;
  } | null> {
    return this.db.one(
      `WITH active AS (
         SELECT a.id, r.shift_pattern_code, r.shift_approved_by, cg.user_id
           FROM care_assignments a
           JOIN care_requests r ON r.id = a.care_request_id
           JOIN caregivers cg   ON cg.id = a.caregiver_id
          WHERE a.status IN ('ASSIGNED','IN_SERVICE')
       )
       SELECT count(*) FILTER (WHERE shift_pattern_code = 'H24_LIVE_IN')::text AS live_in,
              count(*)::text AS total,
              count(*) FILTER (
                WHERE shift_pattern_code = 'H24_LIVE_IN' AND shift_approved_by IS NULL
              )::text AS unapproved,
              count(*) FILTER (
                WHERE shift_pattern_code = 'H24_LIVE_IN'
                  AND EXISTS (
                    SELECT 1 FROM engagements e
                     WHERE e.worker_user_id = active.user_id
                       AND e.status = 'ACTIVE'
                       AND e.model = 'DIRECT_EMPLOYMENT'
                  )
              )::text AS direct_employment
         FROM active`,
    );
  }

  /**
   * 24시간 상주를 연속으로 맡고 있는 인력.
   *
   * 건수보다 **한 사람이 얼마나 오래** 붙어 있었는지가 위험 신호입니다.
   * 잠을 못 자는 상태가 길어지면 사고는 그 사람에게서 납니다 (docs/07 §4).
   */
  liveInWorkers(limit = 100): Promise<{
    caregiver_id: string; display_code: string; user_id: string;
    assignments: string; since: Date | null; days: string;
  }[]> {
    return this.db.query(
      `SELECT cg.id AS caregiver_id, cg.display_code, cg.user_id,
              count(*)::text AS assignments,
              min(a.started_at) AS since,
              COALESCE(
                EXTRACT(DAY FROM (now() - min(a.started_at)))::int, 0
              )::text AS days
         FROM care_assignments a
         JOIN care_requests r ON r.id = a.care_request_id
         JOIN caregivers cg   ON cg.id = a.caregiver_id
        WHERE a.status IN ('ASSIGNED','IN_SERVICE')
          AND r.shift_pattern_code = 'H24_LIVE_IN'
        GROUP BY cg.id, cg.display_code, cg.user_id
        ORDER BY min(a.started_at)
        LIMIT $1`,
      [limit],
    );
  }

  // UPDATE도 DELETE도 없습니다. 정정은 correction_of로 새 행을 추가합니다 (§5.4).
  // 근무시간 분쟁에서 유일한 근거가 되는 데이터라, 고칠 수 있으면 근거가 아닙니다.

  /**
   * 근무 기록 적재.
   *
   * `check_method` 기본값은 **QR**입니다. GPS는 위치정보 수집·이용 동의와
   * 법규 검토가 선행돼야 하므로 기본 경로로 두지 않습니다 (§6-3).
   * 병실 QR은 동의 부담이 낮고 정확도도 높습니다.
   */
  async appendServiceLog(input: {
    assignmentId: string; logType: string; itemCode: string | null;
    occurredAt: string; checkMethod: string | null; geoPoint: unknown | null;
    memo: string | null; correctionOf: string | null; createdBy: string;
  }): Promise<ServiceLogRow> {
    const row = await this.db.one<ServiceLogRow>(
      `INSERT INTO service_logs
         (assignment_id, log_type, item_code, occurred_at, check_method, geo_point,
          memo, correction_of, created_by)
       VALUES ($1,$2,$3,$4,$5::check_method,$6::jsonb,$7,$8,$9)
       RETURNING id, assignment_id, log_type, item_code, occurred_at,
                 check_method::text AS check_method, geo_point, memo,
                 correction_of, created_by, created_at`,
      [input.assignmentId, input.logType, input.itemCode, input.occurredAt,
       input.checkMethod, input.geoPoint === null ? null : JSON.stringify(input.geoPoint),
       input.memo, input.correctionOf, input.createdBy],
    );
    return row!;
  }

  /**
   * 배정의 근무 기록.
   *
   * 정정된 원본도 함께 돌려줍니다 — 지우지 않는 것이 요점이므로 화면에서
   * "정정됨"으로 표시하고 정정본과 나란히 보여줍니다.
   */
  listServiceLogs(assignmentId: string): Promise<ServiceLogRow[]> {
    return this.db.query<ServiceLogRow>(
      `SELECT id, assignment_id, log_type, item_code, occurred_at,
              check_method::text AS check_method, geo_point, memo,
              correction_of, created_by, created_at,
              EXISTS (SELECT 1 FROM service_logs c WHERE c.correction_of = service_logs.id) AS corrected
         FROM service_logs
        WHERE assignment_id = $1
        ORDER BY occurred_at, created_at`,
      [assignmentId],
    );
  }

  /** 배정이 속한 요청의 신청자. 로그 응답의 소유자 판정에 씁니다. */
  requesterOfAssignment(assignmentId: string): Promise<{ requester_id: string } | null> {
    return this.db.one(
      `SELECT r.requester_id
         FROM care_assignments a JOIN care_requests r ON r.id = a.care_request_id
        WHERE a.id = $1`,
      [assignmentId],
    );
  }

  findServiceLog(id: string): Promise<ServiceLogRow | null> {
    return this.db.one<ServiceLogRow>(
      `SELECT id, assignment_id, log_type, item_code, occurred_at,
              check_method::text AS check_method, geo_point, memo,
              correction_of, created_by, created_at
         FROM service_logs WHERE id = $1`,
      [id],
    );
  }

  /**
   * 간병사가 이 배정의 담당자인가.
   *
   * 남의 근무에 기록을 남기는 경로를 막습니다 — 근무시간 분쟁의 근거 데이터라
   * 누가 썼는지가 흐려지면 안 됩니다.
   */
  async isAssignedCaregiver(assignmentId: string, userId: string): Promise<boolean> {
    const row = await this.db.one<{ ok: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM care_assignments a
           JOIN caregivers cg ON cg.id = a.caregiver_id
          WHERE a.id = $1 AND cg.user_id = $2
       ) AS ok`,
      [assignmentId, userId],
    );
    return row?.ok ?? false;
  }

  /**
   * 간병사에게 보여줄 근무 상세 (SCR-403).
   *
   * **환자 실명·진단명을 조회하지 않습니다.** 쿼리에 없어야 실수로 새지 않습니다.
   * 병실·필요 지원·주의사항만 가져옵니다 (docs/11 §3.2 · README §4 C4).
   */
  caregiverAssignmentView(assignmentId: string): Promise<{
    assignment_id: string; status: string; hospital_name: string | null;
    ward: string | null; shift_pattern_code: string | null;
    shift_start_time: string | null; shift_end_time: string | null;
    start_at: Date; end_at: Date | null;
    support_items: string[] | null; mobility_level: string | null;
    cautions: string | null; restricted_flags: string[] | null;
  } | null> {
    return this.db.one(
      `SELECT a.id AS assignment_id, a.status::text AS status,
              h.name AS hospital_name, r.ward, r.shift_pattern_code,
              a.shift_start_time::text AS shift_start_time,
              a.shift_end_time::text AS shift_end_time,
              r.start_at, r.end_at, r.support_items, r.mobility_level,
              r.cautions, r.restricted_flags
         FROM care_assignments a
         JOIN care_requests r ON r.id = a.care_request_id
         LEFT JOIN hospitals h ON h.id = r.hospital_id
        WHERE a.id = $1`,
      [assignmentId],
    );
  }

  /** 간병사의 배정 목록 (SCR-401 · 402). */
  assignmentsForCaregiver(userId: string): Promise<CareAssignmentRow[]> {
    return this.db.query<CareAssignmentRow>(
      `SELECT a.id, a.care_request_id, a.caregiver_id, a.status::text AS status,
              a.offered_at, a.responded_at, a.confirmed_by,
              a.shift_start_time::text AS shift_start_time,
              a.shift_end_time::text AS shift_end_time,
              a.started_at, a.ended_at, cg.display_code AS caregiver_display_code,
              -- 홈 화면(SCR-401)이 병원·병실·시작 시각을 함께 보여줍니다.
              -- 환자 신원이 아니라 '어디서 언제'입니다 — 간병사가 알아야
              -- 하는 최소한이고, 이게 없으면 상세를 한 번 더 눌러야 합니다.
              h.name AS hospital_name, r.ward, r.start_at
         FROM care_assignments a
         JOIN caregivers cg ON cg.id = a.caregiver_id
         JOIN care_requests r ON r.id = a.care_request_id
         LEFT JOIN hospitals h ON h.id = r.hospital_id
        WHERE cg.user_id = $1
          AND a.status NOT IN ('DECLINED','CANCELLED')
        ORDER BY a.offered_at DESC`,
      [userId],
    );
  }

  listServiceItems(): Promise<{ code: string; label_ko: string }[]> {
    return this.db.query(
      `SELECT code, label_ko FROM care_service_items WHERE is_active ORDER BY code`,
    );
  }

  /**
   * 신청 가능한 병원.
   *
   * **공급이 없는 병원은 내려보내지 않습니다** (SCR-302 notes). 신청은
   * 들어오고 배정은 안 되면 전부 취소로 끝나고, 취소를 겪은 보호자는
   * 돌아오지 않습니다.
   *
   * `hospitals.active_caregivers` 컬럼을 읽지 않습니다. 그 값을 갱신하는
   * 코드가 어디에도 없어 항상 0이고, 0을 그대로 믿으면 모든 병원이
   * 걸러지거나(엄격하게 보면) 아무것도 안 걸러집니다(느슨하게 보면).
   * 어느 쪽이든 화면이 거짓말을 합니다. 그래서 **매칭과 같은 기준으로
   * 그 자리에서 셉니다** — 클리어런스 6종 PASS + 지금 일정이 열려 있음.
   *
   * 지역은 후보자의 희망 근무지역(`candidates.preferred_regions`)으로
   * 봅니다. 간병사 테이블에는 지역이 없고, 없는 것을 지어내는 것보다
   * 있는 데이터를 쓰는 편이 낫습니다. 연결된 후보자가 없거나 희망지역을
   * 적지 않은 간병사는 어느 병원에나 셉니다 — 배제하면 신규 인력이
   * 영원히 공급으로 잡히지 않습니다.
   */
  listHospitals(): Promise<{ id: string; name: string; region: string | null; active_caregivers: string }[]> {
    return this.db.query(
      `WITH ready AS (
         SELECT cg.id, c.preferred_regions
           FROM caregivers cg
           LEFT JOIN candidates c ON c.id = cg.candidate_id
          WHERE cg.is_active
            AND EXISTS (
              SELECT 1 FROM caregiver_availability a
               WHERE a.caregiver_id = cg.id AND a.kind = 'AVAILABLE'
                 AND a.starts_at <= now() AND a.ends_at >= now()
            )
            -- 클리어런스 6종이 전부 PASS여야 합니다 (§5.11). 매칭이 쓰는
            -- 기준과 같아야 화면의 숫자와 실제 후보 수가 어긋나지 않습니다.
            AND (
              SELECT count(*) FROM worker_clearances w
               WHERE w.worker_user_id = cg.user_id
                 AND w.result = 'PASS'
                 AND (w.expires_on IS NULL OR w.expires_on >= current_date)
            ) >= 6
       )
       SELECT h.id, h.name, h.region,
              (SELECT count(*) FROM ready r
                WHERE r.preferred_regions IS NULL
                   OR cardinality(r.preferred_regions) = 0
                   OR h.region IS NULL
                   OR h.region = ANY(r.preferred_regions))::text AS active_caregivers
         FROM hospitals h
        WHERE h.is_partner
        ORDER BY h.name`,
    );
  }
}
