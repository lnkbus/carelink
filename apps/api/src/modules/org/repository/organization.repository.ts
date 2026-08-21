import { Injectable } from '@nestjs/common';
import { DbService } from '../../../core/db/db.service';
import type { E7SponsorStatus, VerificationStatus } from '../state/organization.state';

export interface OrganizationRow {
  id: string; name: string; industry_id: string; org_type: string;
  business_reg_no: string | null; address: string | null; region: string | null;
  contact_name: string | null; contact_phone: string | null;
  verification_status: VerificationStatus; verified_at: Date | null;
  contract_type: string | null;
  e7_sponsor_status: E7SponsorStatus; e7_reviewed_at: Date | null; e7_review_note: string | null;
  domestic_employees: number | null; dormitory_provided: boolean; korean_support_staff: boolean;
  created_at: Date;
}

const COLS = `id, name, industry_id, org_type, business_reg_no, address, region,
              contact_name, contact_phone, verification_status, verified_at, contract_type,
              e7_sponsor_status, e7_reviewed_at, e7_review_note,
              domestic_employees, dormitory_provided, korean_support_staff, created_at`;

@Injectable()
export class OrganizationRepository {
  constructor(private readonly db: DbService) {}

  findById(id: string): Promise<OrganizationRow | null> {
    return this.db.one<OrganizationRow>(`SELECT ${COLS} FROM organizations WHERE id = $1`, [id]);
  }

  async list(filter: { status?: VerificationStatus; region?: string }, page: number, size: number):
    Promise<{ items: OrganizationRow[]; total: number }> {
    const items = await this.db.query<OrganizationRow>(
      `SELECT ${COLS} FROM organizations
        WHERE ($1::verification_status IS NULL OR verification_status = $1)
          AND ($2::text IS NULL OR region = $2)
        ORDER BY created_at DESC LIMIT $3 OFFSET $4`,
      [filter.status ?? null, filter.region ?? null, size, (page - 1) * size],
    );
    const count = await this.db.one<{ total: string }>(
      `SELECT count(*) AS total FROM organizations
        WHERE ($1::verification_status IS NULL OR verification_status = $1)
          AND ($2::text IS NULL OR region = $2)`,
      [filter.status ?? null, filter.region ?? null],
    );
    return { items, total: Number(count?.total ?? 0) };
  }

  async create(input: {
    name: string; industryId: string; orgType: string; businessRegNo: string | null;
    address: string | null; region: string | null; contactName: string | null; contactPhone: string | null;
  }): Promise<OrganizationRow> {
    const row = await this.db.one<OrganizationRow>(
      `INSERT INTO organizations (name, industry_id, org_type, business_reg_no, address, region, contact_name, contact_phone)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING ${COLS}`,
      [input.name, input.industryId, input.orgType, input.businessRegNo,
       input.address, input.region, input.contactName, input.contactPhone],
    );
    return row!;
  }

  async update(id: string, patch: Record<string, unknown>): Promise<void> {
    const cols = Object.keys(patch);
    if (cols.length === 0) return;
    const sets = cols.map((c, i) => `${c} = $${i + 2}`).join(', ');
    await this.db.query(`UPDATE organizations SET ${sets} WHERE id = $1`, [id, ...cols.map((c) => patch[c])]);
  }

  async setVerification(id: string, status: VerificationStatus): Promise<void> {
    await this.db.query(
      `UPDATE organizations
          SET verification_status = $2::verification_status,
              verified_at = CASE WHEN $2::text = 'VERIFIED' THEN now() ELSE verified_at END
        WHERE id = $1`,
      [id, status],
    );
  }

  async setE7Sponsor(id: string, status: E7SponsorStatus, note: string | null): Promise<void> {
    await this.db.query(
      `UPDATE organizations SET e7_sponsor_status = $2, e7_reviewed_at = now(), e7_review_note = $3 WHERE id = $1`,
      [id, status, note],
    );
  }

  /** SCR-201 대시보드의 KPI. 트랙별로 분리 집계한다 (§5.8). */
  /**
   * 채용 퍼널 — **지원자가 어느 단계에서 빠지는가**.
   *
   * 종전에는 `jobs.status`(OPEN/DRAFT/CLOSED)를 세고 있었습니다. 그건 요청의
   * 상태지 사람의 진행 단계가 아니라, 화면의 퍼널 표에 넣으면 아무 의미가
   * 없는 숫자가 됩니다. `applications.status`로 바꿉니다.
   *
   * 단계는 누적입니다 — 면접까지 간 사람은 서류 심사도 지났습니다. 각
   * 상태를 그대로 세면 뒤 단계로 넘어간 사람이 앞 단계에서 사라져,
   * 전환율이 실제보다 나쁘게 보입니다.
   *
   * 트랙별로 나눕니다. 합산만 만들면 어느 트랙이 통했는지 알 수 없습니다 (§5.8).
   */
  async funnelByTrack(organizationId: string): Promise<{ track_code: string; stage: string; count: string }[]> {
    return this.db.query(
      `WITH app AS (
         SELECT t.code AS track_code, a.status::text AS status
           FROM applications a
           JOIN jobs j   ON j.id = a.job_id
           JOIN tracks t ON t.id = j.track_id
          WHERE j.organization_id = $1
       )
       SELECT track_code, stage, count(*)::text AS count
         FROM app
        CROSS JOIN LATERAL (
          VALUES
            ('APPLIED',   true),
            ('DOC_REVIEW', app.status <> 'APPLIED' AND app.status NOT IN ('WITHDRAWN')),
            ('INTERVIEW',  app.status IN ('INTERVIEW_REQUESTED','INTERVIEW_DONE','OFFERED','ACCEPTED')),
            ('OFFER',      app.status IN ('OFFERED','ACCEPTED')),
            ('PLACED',     app.status = 'ACCEPTED')
        ) AS s(stage, reached)
        WHERE s.reached
        GROUP BY track_code, stage
        ORDER BY track_code, stage`,
      [organizationId],
    );
  }
}
