import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { DomainError } from '../../../core/errors/domain-error';
import type { Viewer } from '../../../core/scope/scope.types';
import { Roles } from '../../iam/guard/roles.guard';
import { CurrentViewer } from '../../iam/guard/viewer.decorator';
import {
  AdvanceJourneyDto, AdvanceVisaProcessDto, EnrollDto, EnrollmentDto, JourneyDto, JourneyGroupDto,
  JourneyStepDto, NextActionDto, TrainingProgramDto, UpdateProgressDto, VisaProcessDto, VisaProcessStepDto,
} from '../dto/journey.dto';
import type { CandidateRow } from '../repository/candidate.repository';
import type { EnrollmentRow } from '../repository/training.repository';
import { CandidateService } from '../service/candidate.service';
import { JourneyService, type JourneyView } from '../service/journey.service';
import { TrainingService } from '../service/training.service';

/** SCR-102 커리어 여정 · SCR-106 교육 과정 */
@Controller()
export class JourneyController {
  constructor(
    private readonly journey: JourneyService,
    private readonly training: TrainingService,
    private readonly candidates: CandidateService,
  ) {}

  /** GET /api/v1/candidates/me/journey — SCR-102. SCR-101은 progress·nextAction만 쓴다. */
  @Get('candidates/me/journey')
  async myJourney(@CurrentViewer() viewer: Viewer): Promise<JourneyDto> {
    if (!viewer.userId) throw new DomainError('IAM_TOKEN_INVALID');
    const candidate = await this.candidates.getOrCreateForUser(viewer.userId);
    return toJourneyDto(await this.journey.view(candidate), candidate);
  }

  @Get('candidates/:id/journey')
  async candidateJourney(@Param('id', ParseUUIDPipe) id: string): Promise<JourneyDto> {
    const candidate = await this.candidates.getById(id);
    return toJourneyDto(await this.journey.view(candidate), candidate);
  }

  /** 여정 전이. 운영자가 파이프라인을 민다 (SCR-502 일괄 작업의 단건 형태). */
  @Post('candidates/:id/journey')
  @Roles('ADMIN', 'SUPER_ADMIN')
  async advance(
    @CurrentViewer() viewer: Viewer,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdvanceJourneyDto,
  ): Promise<JourneyDto> {
    await this.journey.advance(id, dto.step, viewer.userId, dto.note ?? null);
    const candidate = await this.candidates.getById(id);
    return toJourneyDto(await this.journey.view(candidate), candidate);
  }

  /**
   * 체류자격 절차 전이 (S3의 두 번째 축).
   * 운영자만 기록한다 — 플랫폼은 판정하지 않고 사람이 확인한 결과를 적는다 (§6-11).
   */
  @Post('candidates/:id/visa-process')
  @Roles('ADMIN', 'SUPER_ADMIN')
  async advanceVisa(
    @CurrentViewer() viewer: Viewer,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdvanceVisaProcessDto,
  ): Promise<JourneyDto> {
    await this.journey.advanceVisaProcess({
      candidateId: id, to: dto.step, targetVisaCode: dto.targetVisaCode ?? null,
      actorId: viewer.userId, reason: dto.reason ?? null, note: dto.note ?? null,
    });
    const candidate = await this.candidates.getById(id);
    return toJourneyDto(await this.journey.view(candidate), candidate);
  }

  // ── 교육 (SCR-106) ────────────────────────────────────────────────────────

  @Get('training-programs')
  async programs(@Query('trackId') trackId?: string): Promise<TrainingProgramDto[]> {
    const rows = await this.training.listPrograms(trackId ?? null);
    return rows.map((p) =>
      Object.assign(new TrainingProgramDto(), {
        code: p.code, name: p.name, programType: p.program_type,
        totalHours: p.total_hours, isMandatory: p.is_mandatory,
      }),
    );
  }

  @Get('candidates/me/enrollments')
  async myEnrollments(@CurrentViewer() viewer: Viewer): Promise<EnrollmentDto[]> {
    if (!viewer.userId) throw new DomainError('IAM_TOKEN_INVALID');
    const candidate = await this.candidates.getOrCreateForUser(viewer.userId);
    const rows = await this.training.listEnrollments(candidate.id);
    return rows.map((r) => toEnrollmentDto(r, candidate.user_id));
  }

  @Post('candidates/me/enrollments')
  async enroll(@CurrentViewer() viewer: Viewer, @Body() dto: EnrollDto): Promise<EnrollmentDto[]> {
    if (!viewer.userId) throw new DomainError('IAM_TOKEN_INVALID');
    const candidate = await this.candidates.getOrCreateForUser(viewer.userId);
    const rows = await this.training.enroll(candidate.id, dto.programCode);
    return rows.map((r) => toEnrollmentDto(r, candidate.user_id));
  }

  /**
   * 진도율 갱신. 교육 파트너가 올린다 — LMS를 직접 만들지 않는다 (SCR-106 notes).
   * PARTNER는 자기가 담당하는 후보자의 교육 이력만 다룬다 (docs/11 §3.1).
   */
  @Patch('enrollments/:id/progress')
  @Roles('ADMIN', 'SUPER_ADMIN', 'PARTNER')
  async updateProgress(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProgressDto,
  ): Promise<EnrollmentDto> {
    const row = await this.training.updateProgress(id, dto.progressRate, dto.certificateKey ?? null);
    const candidate = await this.candidates.getById(row.candidate_id);
    return toEnrollmentDto(row, candidate.user_id);
  }
}

function toJourneyDto(view: JourneyView, candidate: CandidateRow): JourneyDto {
  return Object.assign(new JourneyDto(), {
    ownerUserId: candidate.user_id,
    currentStep: view.currentStep,
    progress: view.progress,
    groups: view.groups.map((g) =>
      Object.assign(new JourneyGroupDto(), { key: g.key, labelKey: g.labelKey, state: g.state, steps: g.steps }),
    ),
    history: view.history.map((h) =>
      Object.assign(new JourneyStepDto(), { step: h.step, enteredAt: h.entered_at, note: h.note }),
    ),
    nextAction: view.nextAction ? Object.assign(new NextActionDto(), view.nextAction) : null,
    visaProcess: view.visaProcess
      ? Object.assign(new VisaProcessDto(), {
          applicable: view.visaProcess.applicable,
          requiresEntry: view.visaProcess.requiresEntry,
          targetVisaCode: view.visaProcess.targetVisaCode,
          currentStep: view.visaProcess.currentStep,
          complete: view.visaProcess.complete,
          reasonKey: view.visaProcess.reasonKey,
          history: view.visaProcess.history.map((h) =>
            Object.assign(new VisaProcessStepDto(), {
              step: h.step, enteredAt: h.entered_at, reason: h.reason, note: h.note,
            }),
          ),
        })
      : null,
  });
}

function toEnrollmentDto(r: EnrollmentRow, ownerUserId: string): EnrollmentDto {
  return Object.assign(new EnrollmentDto(), {
    ownerUserId,
    id: r.id,
    programCode: r.program_code,
    programName: r.program_name,
    programType: r.program_type,
    status: r.status,
    progressRate: Number(r.progress_rate),
    totalHours: r.total_hours,
    completedAt: r.completed_at,
    certificateKey: r.certificate_key,
  });
}
