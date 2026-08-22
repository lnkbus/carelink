import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { DomainError } from '../../../core/errors/domain-error';
import type { Viewer } from '../../../core/scope/scope.types';
import { CurrentViewer } from '../guard/viewer.decorator';
import { Roles } from '../guard/roles.guard';
import {
  DecideRoleRequestDto, JoinOrganizationDto, PendingRoleDto, RegisterOrganizationDto,
} from '../dto/auth.dto';
import { MembershipService } from '../service/membership.service';
import { SignupService } from '../service/signup.service';
import { UserRepository, type PendingRoleRow } from '../repository/user.repository';
import { displayPhone } from '../service/phone';

/**
 * 가입 신청과 소속 승인.
 *
 * ── 여기가 없어서 막다른 길이었습니다 ────────────────────────────────
 * 로그인은 누구나 됩니다 (번호 + 인증번호). 그런데 기관 담당자가 로그인하면
 * 역할이 없어 `/no-access`로 갔고, **거기서 할 수 있는 일이 없었습니다.**
 * `POST /organizations`는 운영자 전용이라 스스로 기관을 만들 수도 없었고,
 * 소속을 신청해도 승인할 화면이 없었습니다. 시드가 psql로 우회하던 것이
 * 바로 이 구간입니다.
 *
 * ── 승인은 사람이 합니다 ─────────────────────────────────────────────
 * 자동 승인 경로를 만들지 않았습니다. 승인이 자동이면 아무나 사업자번호를
 * 지어내 기관을 만들고, 검증 전이라 실명은 못 보더라도 채용 요청을 올려
 * 후보자에게 노출됩니다.
 */
@Controller()
export class SignupController {
  constructor(
    private readonly signup: SignupService,
    private readonly membership: MembershipService,
    private readonly users: UserRepository,
  ) {}

  /**
   * POST /api/v1/signup/organization — 기관 신규 등록 + 첫 담당자 신청.
   *
   * 역할이 없는 사람이 부릅니다. 로그인은 필요합니다 — 누가 신청했는지
   * 모르면 승인할 대상이 없습니다.
   */
  @Post('signup/organization')
  async registerOrganization(
    @CurrentViewer() viewer: Viewer,
    @Body() dto: RegisterOrganizationDto,
  ): Promise<{ organizationId: string; organizationName: string; roleRequestId: string }> {
    if (!viewer.userId) throw new DomainError('IAM_TOKEN_INVALID');
    const { organization, roleRequest } = await this.signup.registerOrganization({
      userId: viewer.userId,
      name: dto.name,
      industryId: dto.industryId,
      orgType: dto.orgType,
      businessRegNo: dto.businessRegNo,
      region: dto.region ?? null,
      address: dto.address ?? null,
      contactName: dto.contactName ?? null,
      contactPhone: dto.contactPhone ?? null,
    });
    return {
      organizationId: organization.id,
      organizationName: organization.name,
      roleRequestId: roleRequest.id,
    };
  }

  /** POST /api/v1/signup/organization/join — 이미 등록된 기관에 합류 신청. */
  @Post('signup/organization/join')
  async joinOrganization(
    @CurrentViewer() viewer: Viewer,
    @Body() dto: JoinOrganizationDto,
  ): Promise<{ organizationId: string; organizationName: string; roleRequestId: string }> {
    if (!viewer.userId) throw new DomainError('IAM_TOKEN_INVALID');
    const { organization, roleRequest } = await this.signup.joinOrganization(
      viewer.userId,
      dto.businessRegNo,
    );
    return {
      organizationId: organization.id,
      organizationName: organization.name,
      roleRequestId: roleRequest.id,
    };
  }

  /** POST /api/v1/signup/partner — 교육기관·송출기관 제휴 신청. */
  @Post('signup/partner')
  async requestPartner(@CurrentViewer() viewer: Viewer): Promise<{ roleRequestId: string }> {
    if (!viewer.userId) throw new DomainError('IAM_TOKEN_INVALID');
    const row = await this.signup.requestPartner(viewer.userId);
    return { roleRequestId: row.id };
  }

  /**
   * GET /api/v1/admin/role-requests — 운영자 승인 큐.
   *
   * 기관 첫 담당자와 파트너 제휴가 여기 쌓입니다. 두 번째 이후 담당자는
   * 그 기관의 관리자가 처리하므로 여기 오지 않습니다.
   */
  @Get('admin/role-requests')
  @Roles('ADMIN', 'SUPER_ADMIN')
  async adminQueue(): Promise<PendingRoleDto[]> {
    const rows = await this.membership.listPending(null);
    return Promise.all(rows.map((r) => this.toDto(r)));
  }

  /**
   * GET /api/v1/organizations/me/members/pending — 기관 관리자 승인 큐.
   *
   * 자기 기관 것만 나옵니다. 남의 기관 신청서는 그 자체가 개인정보입니다.
   */
  @Get('organizations/me/members/pending')
  @Roles('ORG_ADMIN', 'ADMIN', 'SUPER_ADMIN')
  async orgQueue(@CurrentViewer() viewer: Viewer): Promise<PendingRoleDto[]> {
    if (!viewer.organizationId) {
      throw new DomainError('ORG_NOT_FOUND', { reason: 'viewer has no approved organization role' });
    }
    const rows = await this.membership.listPending(viewer.organizationId);
    return Promise.all(rows.map((r) => this.toDto(r)));
  }

  /**
   * PATCH /api/v1/role-requests/:id — 승인 또는 반려.
   *
   * 운영자는 전부, 기관 관리자는 자기 기관 것만. 그 판정은 서비스가
   * 합니다 — 컨트롤러에서 if로 가르면 다음 화면이 생길 때 잊습니다.
   */
  @Patch('role-requests/:id')
  @Roles('ADMIN', 'SUPER_ADMIN', 'ORG_ADMIN')
  async decide(
    @CurrentViewer() viewer: Viewer,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: DecideRoleRequestDto,
  ): Promise<{ ok: true }> {
    if (!viewer.userId) throw new DomainError('IAM_TOKEN_INVALID');
    // 운영자면 기관 제한이 없습니다. 기관 관리자면 자기 기관으로 묶습니다.
    const isOperator = viewer.scopes.includes('admin');
    const scopeOrgId = isOperator ? null : viewer.organizationId ?? null;
    if (!isOperator && !scopeOrgId) {
      throw new DomainError('ORG_NOT_FOUND', { reason: 'viewer has no approved organization role' });
    }

    if (dto.decision === 'APPROVE') {
      await this.membership.approve(id, viewer.userId, scopeOrgId);
    } else {
      if (!dto.reason) {
        throw new DomainError('IAM_REJECT_REASON_REQUIRED');
      }
      await this.membership.reject(id, dto.reason, viewer.userId, scopeOrgId);
    }
    return { ok: true };
  }

  private async toDto(r: PendingRoleRow): Promise<PendingRoleDto> {
    // 승인하면 관리자가 되는가 — 화면이 '이 사람이 첫 담당자입니다'를
    // 말해 줘야 승인하는 쪽이 무게를 압니다.
    const becomesAdmin = r.organization_id
      ? !(await this.users.hasApprovedAdmin(r.organization_id))
      : false;
    return Object.assign(new PendingRoleDto(), {
      id: r.id,
      role: r.role,
      requestedAt: r.created_at,
      phone: displayPhone(r.phone),
      organizationId: r.organization_id,
      organizationName: r.organization_name,
      businessRegNo: r.business_reg_no,
      verificationStatus: r.verification_status,
      becomesAdmin,
    });
  }
}
