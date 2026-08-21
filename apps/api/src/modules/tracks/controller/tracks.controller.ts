import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Query } from '@nestjs/common';
import type { Viewer } from '../../../core/scope/scope.types';
import { Roles } from '../../iam/guard/roles.guard';
import { CurrentViewer } from '../../iam/guard/viewer.decorator';
import {
  EligibilityImpactDto, IndustryDto, RecordEligibilityDto, TrackDto, TrackRequirementDto, VisaEligibilityDto,
} from '../dto/tracks.dto';
import { TracksService } from '../service/tracks.service';
import type { TrackRow } from '../repository/tracks.repository';

/** SCR-103 커리어 트랙 선택 · SCR-507 산업·트랙 관리 */
@Controller()
export class TracksController {
  constructor(private readonly tracks: TracksService) {}

  /** GET /api/v1/industries?active=true */
  @Get('industries')
  async listIndustries(@Query('active') active?: string): Promise<IndustryDto[]> {
    const rows = await this.tracks.listIndustries(active !== 'false');
    return rows.map((r) =>
      Object.assign(new IndustryDto(), { id: r.id, code: r.code, labelKo: r.label_ko, isActive: r.is_active }),
    );
  }

  /** GET /api/v1/tracks?industry={id} — 요구사항까지 함께 준다 (SCR-103) */
  @Get('tracks')
  async listTracks(
    @Query('industry') industryId?: string,
    @Query('active') active?: string,
  ): Promise<TrackDto[]> {
    const rows = await this.tracks.listTracks(industryId ?? null, active !== 'false');
    return Promise.all(rows.map((r) => this.toTrackDto(r, true)));
  }

  @Get('tracks/:trackId')
  async getTrack(@Param('trackId', ParseUUIDPipe) trackId: string): Promise<TrackDto> {
    return this.toTrackDto(await this.tracks.getTrack(trackId), true);
  }

  /** 트랙 × 비자 매트릭스 원본. 운영자 전용 (SCR-507). */
  @Get('tracks/:trackId/visa-eligibility')
  @Roles('ADMIN', 'SUPER_ADMIN')
  async visaEligibility(@Param('trackId', ParseUUIDPipe) trackId: string): Promise<VisaEligibilityDto[]> {
    const rows = await this.tracks.listVisaEligibility(trackId);
    return rows.map((r) =>
      Object.assign(new VisaEligibilityDto(), {
        visaCode: r.visa_code,
        eligibility: r.eligibility,
        targetVisaCode: r.target_visa_code,
        leadTimeMonths: r.lead_time_months,
        note: r.note,
      }),
    );
  }

  /**
   * GET /api/v1/admin/tracks/{trackId}/visa-eligibility/{visaCode}/impact
   *
   * 적격성을 바꾸면 누가 영향받는지. **뒤집기 전에 확인하는 화면입니다.**
   * 잠정 판정으로 열어 둔 자격을 닫을 때, 이미 배치된 인력이 그 순간
   * 불법 취업 상태가 되므로 명단이 먼저 나와야 합니다.
   */
  @Get('admin/tracks/:trackId/visa-eligibility/:visaCode/impact')
  @Roles('ADMIN', 'SUPER_ADMIN')
  async eligibilityImpact(
    @Param('trackId', ParseUUIDPipe) trackId: string,
    @Param('visaCode') visaCode: string,
  ): Promise<EligibilityImpactDto> {
    const rows = await this.tracks.affectedByEligibilityChange(trackId, visaCode);
    return Object.assign(new EligibilityImpactDto(), {
      trackId,
      visaCode,
      total: rows.length,
      placed: rows.filter((r) => r.engagement_id !== null).length,
      candidates: rows.map((r) => ({
        displayCode: r.display_code,
        status: r.candidate_status,
        engagementId: r.engagement_id,
        organizationName: r.organization_name,
      })),
    });
  }

  /**
   * PATCH /api/v1/admin/tracks/{trackId}/visa-eligibility/{visaCode}
   *
   * 사람이 확인한 판정을 기록합니다. 시스템은 판정하지 않습니다 (§6-1 · §6-11).
   * 이력은 append-only로 남으므로 언제 무엇이 왜 바뀌었는지 되짚을 수 있습니다.
   */
  @Patch('admin/tracks/:trackId/visa-eligibility/:visaCode')
  @Roles('ADMIN', 'SUPER_ADMIN')
  async recordEligibility(
    @CurrentViewer() viewer: Viewer,
    @Param('trackId', ParseUUIDPipe) trackId: string,
    @Param('visaCode') visaCode: string,
    @Body() dto: RecordEligibilityDto,
  ): Promise<VisaEligibilityDto[]> {
    await this.tracks.recordEligibilityDecision({
      trackId, visaCode,
      toEligibility: dto.eligibility,
      isProvisional: dto.isProvisional ?? false,
      basis: dto.basis ?? null,
      decidedBy: viewer.userId!,
    });
    return this.visaEligibility(trackId);
  }

  private async toTrackDto(r: TrackRow, withRequirements: boolean): Promise<TrackDto> {
    const dto = Object.assign(new TrackDto(), {
      id: r.id,
      code: r.code,
      labelKo: r.label_ko,
      labelVi: r.label_vi,
      qualificationType: r.qualification_type,
      isActive: r.is_active,
      visaTypes: r.visa_types,
    });
    if (withRequirements) {
      const reqs = await this.tracks.getRequirements(r.id);
      dto.requirements = reqs.map((q) =>
        Object.assign(new TrackRequirementDto(), {
          kind: q.kind, refCode: q.ref_code, mandatory: q.is_mandatory, note: q.note,
        }),
      );
    }
    return dto;
  }
}
