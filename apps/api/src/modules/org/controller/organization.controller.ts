import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { DomainError } from '../../../core/errors/domain-error';
import type { Viewer } from '../../../core/scope/scope.types';
import { Roles } from '../../iam/guard/roles.guard';
import { CurrentViewer } from '../../iam/guard/viewer.decorator';
import {
  CreateOrganizationDto, E7SponsorDto, OrganizationDto, OrganizationQueryDto, OrgFunnelRowDto,
  PagedOrganizationsDto, UpdateOrganizationDto, VerifyOrganizationDto,
} from '../dto/organization.dto';
import type { OrganizationRow } from '../repository/organization.repository';
import { OrganizationService } from '../service/organization.service';

/** SCR-201 기관 대시보드 · SCR-503 기관 관리 */
@Controller('organizations')
export class OrganizationController {
  constructor(private readonly orgs: OrganizationService) {}

  /** SCR-503 — 운영자의 기관 목록 */
  @Get()
  @Roles('ADMIN', 'SUPER_ADMIN')
  async list(@CurrentViewer() viewer: Viewer, @Query() q: OrganizationQueryDto): Promise<PagedOrganizationsDto> {
    const page = q.page ?? 1;
    const size = Math.min(q.size ?? 20, 100);
    const { items, total } = await this.orgs.list({ status: q.status, region: q.region }, page, size);
    return Object.assign(new PagedOrganizationsDto(), { items: items.map((o) => toDto(o, viewer)), total, page, size });
  }

  /** 기관 등록. 등록 직후는 PENDING이라 후보자 개인정보를 볼 수 없다. */
  @Post()
  async create(@CurrentViewer() viewer: Viewer, @Body() dto: CreateOrganizationDto): Promise<OrganizationDto> {
    const row = await this.orgs.create({
      name: dto.name, industryId: dto.industryId, orgType: dto.orgType,
      businessRegNo: dto.businessRegNo ?? null, address: dto.address ?? null,
      region: dto.region ?? null, contactName: dto.contactName ?? null, contactPhone: dto.contactPhone ?? null,
    });
    return toDto(row, viewer);
  }

  @Get('me')
  async myOrganization(@CurrentViewer() viewer: Viewer): Promise<OrganizationDto> {
    if (!viewer.organizationId) throw new DomainError('ORG_NOT_FOUND', { reason: 'viewer has no approved organization role' });
    return toDto(await this.orgs.getById(viewer.organizationId), viewer);
  }

  /** SCR-201 — 트랙별로 분리 집계한다. 합산만 보면 어느 트랙이 통했는지 알 수 없다 (§5.8). */
  @Get('me/funnel')
  async myFunnel(@CurrentViewer() viewer: Viewer): Promise<OrgFunnelRowDto[]> {
    if (!viewer.organizationId) throw new DomainError('ORG_NOT_FOUND', { reason: 'viewer has no approved organization role' });
    const rows = await this.orgs.funnelByTrack(viewer.organizationId);
    return rows.map((r) =>
      Object.assign(new OrgFunnelRowDto(), { trackCode: r.track_code, stage: r.stage, count: Number(r.count) }),
    );
  }

  @Get(':id')
  async getOne(@CurrentViewer() viewer: Viewer, @Param('id', ParseUUIDPipe) id: string): Promise<OrganizationDto> {
    return toDto(await this.orgs.getById(id), viewer);
  }

  @Patch(':id')
  @Roles('ADMIN', 'SUPER_ADMIN', 'ORG_ADMIN')
  async update(
    @CurrentViewer() viewer: Viewer,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrganizationDto,
  ): Promise<OrganizationDto> {
    // ORG_ADMIN은 자기 기관만 수정한다.
    if (!viewer.scopes.includes('admin') && viewer.organizationId !== id) {
      throw new DomainError('IAM_ROLE_FORBIDDEN', { reason: 'can only update own organization' });
    }
    const patch: Record<string, unknown> = {};
    const map: Record<string, string> = {
      name: 'name', address: 'address', region: 'region', contactName: 'contact_name',
      contactPhone: 'contact_phone', domesticEmployees: 'domestic_employees',
      dormitoryProvided: 'dormitory_provided', koreanSupportStaff: 'korean_support_staff',
    };
    for (const [k, col] of Object.entries(map)) {
      const v = (dto as Record<string, unknown>)[k];
      if (v !== undefined) patch[col] = v;
    }
    return toDto(await this.orgs.update(id, patch, viewer.userId), viewer);
  }

  /**
   * PATCH /api/v1/organizations/{id}/verify — 검증 게이트.
   * 이 값이 VERIFIED가 되기 전에는 기관이 후보자 개인정보를 볼 수 없다 (§6-6).
   */
  @Patch(':id/verify')
  @Roles('ADMIN', 'SUPER_ADMIN')
  async verify(
    @CurrentViewer() viewer: Viewer,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VerifyOrganizationDto,
  ): Promise<OrganizationDto> {
    return toDto(await this.orgs.changeVerification(id, dto.status, viewer.userId!), viewer);
  }

  /** E-7-2 취업처 적격성 기록. 판정은 사람이 하고 결과만 남긴다. */
  @Patch(':id/e7-sponsor')
  @Roles('ADMIN', 'SUPER_ADMIN')
  async e7Sponsor(
    @CurrentViewer() viewer: Viewer,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: E7SponsorDto,
  ): Promise<OrganizationDto> {
    return toDto(await this.orgs.changeE7Sponsor(id, dto.status, dto.note ?? null, viewer.userId!), viewer);
  }
}

function toDto(r: OrganizationRow, viewer?: Viewer): OrganizationDto {
  return Object.assign(new OrganizationDto(), {
    // 승인된 소속 담당자만 자기 기관의 상세를 본다.
    isOwnOrganization: viewer?.organizationId === r.id,
    id: r.id, name: r.name, orgType: r.org_type, region: r.region,
    verificationStatus: r.verification_status,
    dormitoryProvided: r.dormitory_provided, koreanSupportStaff: r.korean_support_staff,
    businessRegNo: r.business_reg_no, address: r.address,
    contactName: r.contact_name, contactPhone: r.contact_phone,
    verifiedAt: r.verified_at, domesticEmployees: r.domestic_employees,
    e7SponsorStatus: r.e7_sponsor_status, e7ReviewedAt: r.e7_reviewed_at,
    e7ReviewNote: r.e7_review_note, contractType: r.contract_type,
  });
}
