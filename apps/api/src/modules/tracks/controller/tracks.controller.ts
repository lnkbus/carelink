import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { Roles } from '../../iam/guard/roles.guard';
import { IndustryDto, TrackDto, TrackRequirementDto, VisaEligibilityDto } from '../dto/tracks.dto';
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
