import { Injectable } from '@nestjs/common';
import { DomainError } from '../../../core/errors/domain-error';
import { AuditService } from '../../ops/service/audit.service';
import { OrganizationRepository, type OrganizationRow } from '../repository/organization.repository';
import {
  canSponsorE7, e7SponsorMachine, organizationVerificationMachine,
  type E7SponsorStatus, type VerificationStatus,
} from '../state/organization.state';

@Injectable()
export class OrganizationService {
  constructor(
    private readonly repo: OrganizationRepository,
    private readonly audit: AuditService,
  ) {}

  async getById(id: string): Promise<OrganizationRow> {
    const row = await this.repo.findById(id);
    if (!row) throw new DomainError('ORG_NOT_FOUND', { organizationId: id });
    return row;
  }

  list(filter: { status?: VerificationStatus; region?: string }, page = 1, size = 20) {
    return this.repo.list(filter, page, size);
  }

  create(input: Parameters<OrganizationRepository['create']>[0]): Promise<OrganizationRow> {
    return this.repo.create(input);
  }

  async update(id: string, patch: Record<string, unknown>, actorUserId: string | null): Promise<OrganizationRow> {
    await this.getById(id);
    await this.repo.update(id, patch);
    await this.audit.record({
      actorUserId, action: 'STATUS_CHANGE', targetType: 'organization', targetId: id,
      after: { patched: Object.keys(patch) },
    });
    return this.getById(id);
  }

  /**
   * 검증 상태 변경. 이 값이 후보자 개인정보 접근의 게이트다 (CLAUDE.md §6-6).
   * 전이는 상태머신으로 강제하고 전량 감사 로그에 남긴다.
   */
  async changeVerification(id: string, to: VerificationStatus, actorUserId: string): Promise<OrganizationRow> {
    const before = await this.getById(id);
    organizationVerificationMachine.assert(before.verification_status, to);
    await this.repo.setVerification(id, to);
    await this.audit.record({
      actorUserId, action: 'STATUS_CHANGE', targetType: 'organization', targetId: id,
      before: { verificationStatus: before.verification_status }, after: { verificationStatus: to },
    });
    return this.getById(id);
  }

  async changeE7Sponsor(
    id: string, to: E7SponsorStatus, note: string | null, actorUserId: string,
  ): Promise<OrganizationRow> {
    const before = await this.getById(id);
    e7SponsorMachine.assert(before.e7_sponsor_status, to);
    await this.repo.setE7Sponsor(id, to, note);
    await this.audit.record({
      actorUserId, action: 'STATUS_CHANGE', targetType: 'organization', targetId: id,
      before: { e7SponsorStatus: before.e7_sponsor_status }, after: { e7SponsorStatus: to, note },
    });
    return this.getById(id);
  }

  // ── 다른 모듈에 노출하는 게이트 (docs/02 §4) ───────────────────────────────

  async isVerified(id: string): Promise<boolean> {
    const row = await this.repo.findById(id);
    return row?.verification_status === 'VERIFIED';
  }

  /**
   * 후보자 개인정보를 볼 수 있는 기관인가.
   *
   * 검증 완료가 첫 관문이다. 이것만으로는 실명이 열리지 않는다 —
   * 후보자가 면접 요청을 수락해야 한다 (docs/02 §5.2). 그 두 번째 조건은
   * matching 모듈이 판정하고, 여기서는 첫 관문만 답한다.
   */
  async assertCanViewCandidates(organizationId: string): Promise<void> {
    const row = await this.getById(organizationId);
    if (row.verification_status !== 'VERIFIED') {
      throw new DomainError('ORG_NOT_VERIFIED', {
        organizationId, verificationStatus: row.verification_status,
      });
    }
  }

  /** E-7-2 대상 인력을 배치할 수 있는 기관인가 (CLAUDE.md §6-17). */
  async assertCanSponsorE7(organizationId: string): Promise<void> {
    const row = await this.getById(organizationId);
    if (!canSponsorE7(row.e7_sponsor_status)) {
      throw new DomainError('ORG_E7_SPONSOR_INELIGIBLE', {
        organizationId, e7SponsorStatus: row.e7_sponsor_status,
      });
    }
  }

  funnelByTrack(organizationId: string) {
    return this.repo.funnelByTrack(organizationId);
  }
}
