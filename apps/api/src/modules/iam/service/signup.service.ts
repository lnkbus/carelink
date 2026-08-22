import { Injectable } from '@nestjs/common';
import { DomainError } from '../../../core/errors/domain-error';
import { type OrganizationRow } from '../../org/repository/organization.repository';
import { OrganizationService } from '../../org/service/organization.service';
import { AuditService } from '../../ops/service/audit.service';
import { UserRepository, type UserRoleRow } from '../repository/user.repository';

/**
 * 가입 신청 — 기관 · 파트너.
 *
 * ── 왜 별도 서비스인가 ───────────────────────────────────────────────
 * `POST /auth/roles`는 **이미 있는 기관에 소속을 신청**합니다. 그런데 새
 * 기관의 첫 담당자에게는 그 기관이 아직 없습니다. `POST /organizations`는
 * 운영자 전용이라(§6-6의 검증 게이트가 여기 걸립니다) 스스로 만들 수도
 * 없습니다. **그래서 아무도 가입할 수 없었습니다** — 시드가 psql로
 * 우회하고 있었고, 그건 사람이 쓸 수 있는 경로가 아닙니다.
 *
 * 기관 생성과 소속 신청을 **한 번에** 처리합니다. 둘로 나누면 기관만 만들고
 * 소속 신청에 실패한 유령 기관이 남고, 그 기관은 아무도 손댈 수 없습니다.
 *
 * ── 만들어지는 상태 ──────────────────────────────────────────────────
 *   organizations.verification_status = PENDING   운영자가 사업자등록증 확인
 *   user_roles.approved_at            = NULL      운영자가 소속 승인
 *
 * 둘 다 걸려 있어야 정상입니다. 자동으로 열면 아무나 기관을 만들어 후보자
 * 실명을 보게 됩니다.
 */
@Injectable()
export class SignupService {
  constructor(
    private readonly users: UserRepository,
    // 기관을 아는 것은 org 모듈입니다 — repository가 아니라 service를 부릅니다 (§5.1).
    private readonly orgs: OrganizationService,
    private readonly audit: AuditService,
  ) {}

  /**
   * 기관 신규 등록 + 첫 담당자 신청.
   *
   * 사업자등록번호가 이미 있으면 막고 **그 기관에 합류하라고 알려 줍니다.**
   * 같은 병원이 두 번 등록되면 후보자가 어느 쪽에 지원했는지 갈리고,
   * 검증도 두 번 받아야 합니다.
   */
  async registerOrganization(input: {
    userId: string;
    name: string;
    industryId: string;
    orgType: string;
    businessRegNo: string;
    region?: string | null;
    address?: string | null;
    contactName?: string | null;
    contactPhone?: string | null;
  }): Promise<{ organization: OrganizationRow; roleRequest: UserRoleRow }> {
    const existing = await this.orgs.findByBusinessRegNo(input.businessRegNo);
    if (existing) {
      throw new DomainError('IAM_ORG_ALREADY_REGISTERED', {
        organizationId: existing.id,
        organizationName: existing.name,
        // 화면이 '합류 신청' 버튼을 띄울 수 있게 id를 함께 냅니다.
        // 막기만 하면 신청한 사람은 전화를 겁니다.
        hint: 'join_instead',
      });
    }

    const organization = await this.orgs.create({
      name: input.name,
      industryId: input.industryId,
      orgType: input.orgType,
      businessRegNo: input.businessRegNo,
      address: input.address ?? null,
      region: input.region ?? null,
      contactName: input.contactName ?? null,
      contactPhone: input.contactPhone ?? null,
    });

    const roleRequest = await this.requestMembership(input.userId, organization.id);

    await this.audit.record({
      actorUserId: input.userId,
      action: 'org.signup.request',
      targetType: 'organization',
      targetId: organization.id,
      after: { name: organization.name, businessRegNo: input.businessRegNo, verification: 'PENDING' },
    });

    return { organization, roleRequest };
  }

  /**
   * 기존 기관에 합류 신청.
   *
   * 승인은 그 기관의 관리자가 합니다 (MembershipService). 운영자가 매번
   * 끼면 기관이 사람을 못 늘립니다.
   */
  async joinOrganization(userId: string, businessRegNo: string): Promise<{
    organization: OrganizationRow;
    roleRequest: UserRoleRow;
  }> {
    const organization = await this.orgs.findByBusinessRegNo(businessRegNo);
    if (!organization) throw new DomainError('ORG_NOT_FOUND', { businessRegNo });

    const roleRequest = await this.requestMembership(userId, organization.id);
    await this.audit.record({
      actorUserId: userId,
      action: 'org.join.request',
      targetType: 'organization',
      targetId: organization.id,
      after: { organizationName: organization.name },
    });
    return { organization, roleRequest };
  }

  /**
   * 파트너(교육기관·송출기관) 제휴 신청.
   *
   * `partners` 행은 만들지 않습니다 — 제휴는 계약이고, 계약은 운영자가
   * 확인한 뒤에 존재합니다. 신청 단계에서는 **역할 신청만** 남기고
   * 승인하면서 운영자가 파트너 행을 만듭니다 (SCR-510).
   */
  async requestPartner(userId: string): Promise<UserRoleRow> {
    const created = await this.users.addRole(userId, 'PARTNER', null, false, false);
    if (!created) throw new DomainError('IAM_ROLE_ALREADY_HELD', { role: 'PARTNER' });
    await this.audit.record({
      actorUserId: userId,
      action: 'partner.signup.request',
      targetType: 'user',
      targetId: userId,
      after: { role: 'PARTNER', approved: false },
    });
    return created;
  }

  /** 승인 대기 상태로 소속 행을 만듭니다. 중복 신청은 DB의 UNIQUE가 막습니다. */
  private async requestMembership(userId: string, organizationId: string): Promise<UserRoleRow> {
    const created = await this.users.addRole(userId, 'ORG_MEMBER', organizationId, false, false);
    if (!created) throw new DomainError('IAM_ROLE_ALREADY_HELD', { role: 'ORG_MEMBER', organizationId });
    return created;
  }
}
