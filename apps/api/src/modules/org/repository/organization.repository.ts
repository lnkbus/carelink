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
  async funnelByTrack(organizationId: string): Promise<{ track_code: string; stage: string; count: string }[]> {
    return this.db.query(
      `SELECT t.code AS track_code, j.status::text AS stage, count(*)::text AS count
         FROM jobs j JOIN tracks t ON t.id = j.track_id
        WHERE j.organization_id = $1
        GROUP BY t.code, j.status
        ORDER BY t.code, j.status`,
      [organizationId],
    );
  }
}
