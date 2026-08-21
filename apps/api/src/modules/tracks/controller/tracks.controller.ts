import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Put, Query } from '@nestjs/common';
import type { Viewer } from '../../../core/scope/scope.types';
import { Roles } from '../../iam/guard/roles.guard';
import { CurrentViewer } from '../../iam/guard/viewer.decorator';
import {
  ActiveDto, CreateIndustryDto, CreateTrackDto, EligibilityImpactDto, IndustryDto,
  RecordEligibilityDto, ReplaceRequirementsDto, ReplaceWeightsDto, TrackDto,
  TrackRequirementDto, TrackWeightsDto, VisaEligibilityDto,
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

  // ── SCR-507 산업 · 트랙 · 요건 관리 ──────────────────────────────────
  //
  // **버티컬 확장의 실행 창구입니다** (SCR-507 notes). 농업·미용·요리를
  // 추가할 때 개발자가 아니라 운영자가 여기서 산업과 트랙을 열고 요구사항을
  // 정의합니다. 코드 배포가 필요한 경우는 그 산업에 전용 모듈이 필요할
  // 때뿐입니다 (§5.8).

  /** 비활성 포함 전체. 운영자는 아직 열지 않은 산업도 봐야 합니다. */
  @Get('admin/industries')
  @Roles('ADMIN', 'SUPER_ADMIN')
  async adminIndustries(): Promise<IndustryDto[]> {
    const rows = await this.tracks.listIndustries(false);
    return rows.map((r) =>
      Object.assign(new IndustryDto(), { id: r.id, code: r.code, labelKo: r.label_ko, isActive: r.is_active }),
    );
  }

  @Post('admin/industries')
  @Roles('ADMIN', 'SUPER_ADMIN')
  async createIndustry(
    @CurrentViewer() viewer: Viewer,
    @Body() dto: CreateIndustryDto,
  ): Promise<IndustryDto> {
    const row = await this.tracks.createIndustry({
      code: dto.code, labelKo: dto.labelKo, sortOrder: dto.sortOrder ?? 0,
      actorUserId: viewer.userId!,
    });
    return Object.assign(new IndustryDto(), {
      id: row.id, code: row.code, labelKo: row.label_ko, isActive: row.is_active,
    });
  }

  @Patch('admin/industries/:id/active')
  @Roles('ADMIN', 'SUPER_ADMIN')
  async setIndustryActive(
    @CurrentViewer() viewer: Viewer,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ActiveDto,
  ): Promise<IndustryDto> {
    const row = await this.tracks.setIndustryActive(id, dto.isActive, viewer.userId!);
    return Object.assign(new IndustryDto(), {
      id: row.id, code: row.code, labelKo: row.label_ko, isActive: row.is_active,
    });
  }

  @Get('admin/tracks')
  @Roles('ADMIN', 'SUPER_ADMIN')
  async adminTracks(@Query('industry') industryId?: string): Promise<TrackDto[]> {
    const rows = await this.tracks.listTracks(industryId ?? null, false);
    return Promise.all(rows.map((r) => this.toTrackDto(r, true)));
  }

  @Post('admin/tracks')
  @Roles('ADMIN', 'SUPER_ADMIN')
  async createTrack(
    @CurrentViewer() viewer: Viewer,
    @Body() dto: CreateTrackDto,
  ): Promise<TrackDto> {
    const row = await this.tracks.createTrack({
      industryId: dto.industryId, code: dto.code, labelKo: dto.labelKo,
      labelVi: dto.labelVi ?? null, labelEn: dto.labelEn ?? null,
      qualificationType: dto.qualificationType, visaTypes: dto.visaTypes ?? [],
      sortOrder: dto.sortOrder ?? 0, actorUserId: viewer.userId!,
    });
    return this.toTrackDto(row, true);
  }

  /**
   * 트랙 공개·비공개.
   *
   * 요건이 하나도 없는 트랙은 열리지 않습니다. 요건 없는 트랙은 아무나
   * 배치 가능하다는 뜻이 되고, 그건 이 플랫폼이 파는 것의 반대입니다.
   */
  @Patch('admin/tracks/:trackId/active')
  @Roles('ADMIN', 'SUPER_ADMIN')
  async setTrackActive(
    @CurrentViewer() viewer: Viewer,
    @Param('trackId', ParseUUIDPipe) trackId: string,
    @Body() dto: ActiveDto,
  ): Promise<TrackDto> {
    return this.toTrackDto(
      await this.tracks.setTrackActive(trackId, dto.isActive, viewer.userId!), true,
    );
  }

  /**
   * 요건 교체.
   *
   * **자격 요건을 시스템이 판정하지 않습니다** (SCR-507 notes · §6-1).
   * 여기 등록되는 것은 '무엇을 확인해야 하는가'이고, 확인 결과는 사람이
   * 입력합니다.
   */
  @Put('admin/tracks/:trackId/requirements')
  @Roles('ADMIN', 'SUPER_ADMIN')
  async replaceRequirements(
    @CurrentViewer() viewer: Viewer,
    @Param('trackId', ParseUUIDPipe) trackId: string,
    @Body() dto: ReplaceRequirementsDto,
  ): Promise<TrackRequirementDto[]> {
    const rows = await this.tracks.replaceRequirements(
      trackId,
      dto.requirements.map((r) => ({
        kind: r.kind, refCode: r.refCode ?? null,
        isMandatory: r.mandatory ?? true, note: r.note ?? null,
      })),
      viewer.userId!,
    );
    return rows.map((r) => Object.assign(new TrackRequirementDto(), {
      kind: r.kind, refCode: r.ref_code, mandatory: r.is_mandatory, note: r.note,
    }));
  }

  @Get('admin/tracks/:trackId/weights')
  @Roles('ADMIN', 'SUPER_ADMIN')
  async weights(@Param('trackId', ParseUUIDPipe) trackId: string): Promise<TrackWeightsDto> {
    return Object.assign(new TrackWeightsDto(), {
      trackId, weights: await this.tracks.getWeights(trackId),
    });
  }

  /** 매칭 가중치. 점수를 코드에 박지 않는 이유가 이 화면입니다 (§5.5). */
  @Put('admin/tracks/:trackId/weights')
  @Roles('ADMIN', 'SUPER_ADMIN')
  async replaceWeights(
    @CurrentViewer() viewer: Viewer,
    @Param('trackId', ParseUUIDPipe) trackId: string,
    @Body() dto: ReplaceWeightsDto,
  ): Promise<TrackWeightsDto> {
    const weights = await this.tracks.replaceWeights(
      trackId, dto.weights.map((w) => ({ ruleCode: w.ruleCode, maxPoints: w.maxPoints })), viewer.userId!,
    );
    return Object.assign(new TrackWeightsDto(), { trackId, weights });
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
