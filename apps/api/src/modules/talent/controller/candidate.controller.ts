import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { DomainError } from '../../../core/errors/domain-error';
import type { Viewer } from '../../../core/scope/scope.types';
import { Roles } from '../../iam/guard/roles.guard';
import { CurrentViewer } from '../../iam/guard/viewer.decorator';
import {
  CandidateDto, CandidateListQueryDto, CandidateStatusDto, CandidateTrackDto, PagedDto,
  SelectTrackDto, UpdateCandidateDto, VerifyVisaDto,
} from '../dto/candidate.dto';
import { CandidateService } from '../service/candidate.service';
import type { CandidateTrackRow } from '../repository/candidate.repository';

/** SCR-103 커리어 트랙 · SCR-104 프로필 */
@Controller('candidates')
export class CandidateController {
  constructor(private readonly candidates: CandidateService) {}

  /**
   * GET /api/v1/candidates/me — 본인 프로필.
   * 후보자 레코드는 첫 조회 시 만들어진다. 별도 '프로필 생성' 화면이 없기 때문이다.
   */
  @Get('me')
  async me(@CurrentViewer() viewer: Viewer): Promise<CandidateDto> {
    if (!viewer.userId) throw new DomainError('IAM_TOKEN_INVALID');
    const row = await this.candidates.getOrCreateForUser(viewer.userId);
    return this.candidates.toDto(row, viewer);
  }

  @Patch('me')
  async updateMe(@CurrentViewer() viewer: Viewer, @Body() dto: UpdateCandidateDto): Promise<CandidateDto> {
    if (!viewer.userId) throw new DomainError('IAM_TOKEN_INVALID');
    const row = await this.candidates.getOrCreateForUser(viewer.userId);
    const patch = toSnakePatch(dto);
    const updated = await this.candidates.updateProfile(row.id, patch, viewer.userId);
    return this.candidates.toDto(updated, viewer);
  }

  /**
   * GET /api/v1/candidates — 목록 (SCR-203 기관 검색).
   *
   * 기관과 운영자가 같은 엔드포인트를 쓴다. 보이는 필드는 컨트롤러가 아니라
   * DTO의 @Scope가 정한다 — if 문으로 나누면 언젠가 한쪽이 빠진다 (§5.2).
   */
  @Get()
  @Roles('ADMIN', 'SUPER_ADMIN', 'ORG_MEMBER', 'ORG_ADMIN')
  async list(
    @CurrentViewer() viewer: Viewer,
    @Query() q: CandidateListQueryDto,
  ): Promise<PagedDto<CandidateDto>> {
    const result = await this.candidates.listForConsole(q, viewer);
    return Object.assign(new PagedDto<CandidateDto>(), result);
  }

  /** GET /api/v1/candidates/{id} — 기관·운영자 조회. scope에 따라 필드가 달라진다. */
  @Get(':id')
  async getOne(@CurrentViewer() viewer: Viewer, @Param('id', ParseUUIDPipe) id: string): Promise<CandidateDto> {
    const row = await this.candidates.getById(id);
    return this.candidates.toDto(row, viewer);
  }

  /** POST /api/v1/candidates/me/tracks — SCR-103 */
  @Post('me/tracks')
  async selectTrack(@CurrentViewer() viewer: Viewer, @Body() dto: SelectTrackDto): Promise<CandidateTrackDto[]> {
    if (!viewer.userId) throw new DomainError('IAM_TOKEN_INVALID');
    const row = await this.candidates.getOrCreateForUser(viewer.userId);
    const tracks = await this.candidates.selectTrack(row.id, dto.trackId, dto.isPrimary ?? false);
    return tracks.map(toDto);
  }

  @Delete('me/tracks/:trackId')
  async removeTrack(
    @CurrentViewer() viewer: Viewer,
    @Param('trackId', ParseUUIDPipe) trackId: string,
  ): Promise<CandidateTrackDto[]> {
    if (!viewer.userId) throw new DomainError('IAM_TOKEN_INVALID');
    const row = await this.candidates.getOrCreateForUser(viewer.userId);
    return (await this.candidates.removeTrack(row.id, trackId)).map(toDto);
  }

  /**
   * PATCH /api/v1/candidates/{id}/status — SCR-502 단건 상태 변경.
   * 전이 규칙은 candidateStatusMachine이 강제하고, 변경은 audit_logs에 남는다.
   */
  @Patch(':id/status')
  @Roles('ADMIN', 'SUPER_ADMIN')
  async changeStatus(
    @CurrentViewer() viewer: Viewer,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CandidateStatusDto,
  ): Promise<CandidateDto> {
    await this.candidates.changeStatus(id, dto.status, viewer.userId!);
    return this.candidates.toDto(await this.candidates.getById(id), viewer);
  }

  /**
   * PATCH /api/v1/candidates/{id}/visa — 운영자가 확인한 체류자격을 기록한다.
   * 후보자 본인은 이 값을 고칠 수 없다. 플랫폼도 판정하지 않는다 — 기록만 한다.
   */
  @Patch(':id/visa')
  @Roles('ADMIN', 'SUPER_ADMIN')
  async recordVisa(
    @CurrentViewer() viewer: Viewer,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VerifyVisaDto,
  ): Promise<CandidateDto> {
    const updated = await this.candidates.recordVisaVerification(
      id, dto.visaStatusCode, dto.visaExpiresOn ?? null, viewer.userId!,
    );
    return this.candidates.toDto(updated, viewer);
  }
}

function toDto(t: CandidateTrackRow): CandidateTrackDto {
  return Object.assign(new CandidateTrackDto(), {
    trackId: t.track_id, trackCode: t.track_code, labelKo: t.label_ko,
    isPrimary: t.is_primary, qualificationState: 'SELECTED',
  });
}

/** DTO 카멜케이스 → 컬럼 스네이크케이스. 값이 온 필드만 담는다. */
function toSnakePatch(dto: UpdateCandidateDto): Record<string, unknown> {
  const map: Record<keyof UpdateCandidateDto, string> = {
    name: 'name', birthDate: 'birth_date', gender: 'gender',
    currentLocation: 'current_location', preferredRegions: 'preferred_regions',
    employmentTypes: 'employment_types', dormRequired: 'dorm_required', availableFrom: 'available_from',
  };
  const out: Record<string, unknown> = {};
  for (const [k, col] of Object.entries(map) as [keyof UpdateCandidateDto, string][]) {
    if (dto[k] !== undefined) out[col] = dto[k];
  }
  return out;
}
