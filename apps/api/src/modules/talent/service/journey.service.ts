import { Injectable } from '@nestjs/common';
import { DomainError } from '../../../core/errors/domain-error';
import { AuditService } from '../../ops/service/audit.service';
import { TracksService } from '../../tracks/service/tracks.service';
import { CandidateRepository, type CandidateRow } from '../repository/candidate.repository';
import { DocumentRepository } from '../repository/document.repository';
import { JourneyRepository, type JourneyStepRow, type VisaProcessStepRow } from '../repository/journey.repository';
import { TrainingRepository } from '../repository/training.repository';
import {
  displayProgress, JOURNEY_DISPLAY_GROUPS, journeyMachine, type JourneyStep,
} from '../state/journey.state';
import { resolveVisaProcess, type VisaProcessApplicability } from '../state/visa-process.policy';
import { isVisaProcessComplete, visaProcessMachine, type VisaProcessStep } from '../state/visa-process.state';
import { resolveNextAction, type NextAction } from './next-action';

export interface JourneyView {
  currentStep: JourneyStep;
  history: JourneyStepRow[];
  /** SCR-101의 "3 / 5" — 9단계를 5그룹으로 접은 값 */
  progress: { current: number; total: number };
  groups: { key: string; labelKey: string; steps: readonly string[]; state: 'DONE' | 'CURRENT' | 'TODO' }[];
  nextAction: NextAction | null;
  /** 해당자에게만 붙는 두 번째 축 (S3) */
  visaProcess: (VisaProcessApplicability & {
    currentStep: VisaProcessStep | null;
    complete: boolean;
    history: VisaProcessStepRow[];
  }) | null;
}

@Injectable()
export class JourneyService {
  constructor(
    private readonly journey: JourneyRepository,
    private readonly candidates: CandidateRepository,
    private readonly documents: DocumentRepository,
    private readonly training: TrainingRepository,
    private readonly tracks: TracksService,
    private readonly audit: AuditService,
  ) {}

  /** SCR-102 — 여정 전체. SCR-101은 여기서 progress와 nextAction만 쓴다. */
  async view(candidate: CandidateRow): Promise<JourneyView> {
    const [history, docs, enrollments, candidateTracks] = await Promise.all([
      this.journey.listJourney(candidate.id),
      this.documents.listByCandidate(candidate.id),
      this.training.listEnrollments(candidate.id),
      this.candidates.listTracks(candidate.id),
    ]);

    const currentStep = history.at(-1)?.step ?? journeyMachine.initial;
    const primaryTrackId = candidateTracks.find((t) => t.is_primary)?.track_id ?? candidateTracks[0]?.track_id ?? null;
    const requirements = primaryTrackId ? await this.tracks.getRequirements(primaryTrackId) : [];

    // 이 후보자에게 체류자격 절차 축이 붙는지. 국적이 아니라 트랙×비자 조회로 판정한다.
    let visaProcess: JourneyView['visaProcess'] = null;
    if (primaryTrackId) {
      const check = await this.tracks.checkVisaEligibility(primaryTrackId, candidate.visa_status_code);
      const applicability = resolveVisaProcess({
        eligibility: check.eligibility,
        targetVisaCode: check.targetVisaCode,
        // 국내 체류 중인지는 현재 체류자격 보유 여부로 본다.
        // 해외 모집 건은 아직 체류자격이 없다.
        residesInKorea: candidate.visa_status_code !== null,
      });
      if (applicability.applicable) {
        const vHistory = await this.journey.listVisaProcess(candidate.id);
        const step = vHistory.at(-1)?.step ?? null;
        visaProcess = {
          ...applicability,
          currentStep: step,
          complete: step ? isVisaProcessComplete(step, applicability.requiresEntry) : false,
          history: vHistory,
        };
      }
    }

    const nextAction = resolveNextAction({
      candidate: {
        name: candidate.name,
        birthDate: candidate.birth_date,
        currentLocation: candidate.current_location,
        visaStatusCode: candidate.visa_status_code,
        visaExpiresInDays: daysUntil(candidate.visa_expires_on),
      },
      hasTrack: candidateTracks.length > 0,
      requirements,
      documents: docs,
      enrollments,
      visaProcess: visaProcess ?? { applicable: false, requiresEntry: false, targetVisaCode: null, reasonKey: '' },
      visaProcessStep: visaProcess?.currentStep ?? null,
    });

    const progress = displayProgress(currentStep);
    const groups = JOURNEY_DISPLAY_GROUPS.map((g, i) => ({
      key: g.key,
      labelKey: g.labelKey,
      steps: g.steps,
      state: (i + 1 < progress.current ? 'DONE' : i + 1 === progress.current ? 'CURRENT' : 'TODO') as
        'DONE' | 'CURRENT' | 'TODO',
    }));

    return { currentStep, history, progress, groups, nextAction, visaProcess };
  }

  /** 여정 전이. 상태머신이 허용하지 않으면 예외를 던진다. */
  async advance(candidateId: string, to: JourneyStep, actorId: string | null, note: string | null): Promise<JourneyStepRow> {
    const current = await this.journey.currentJourneyStep(candidateId);
    const from = current?.step ?? journeyMachine.initial;
    // 최초 진입(APPLIED)은 이력이 비어 있을 때만 허용한다.
    if (current) journeyMachine.assert(from, to);
    else if (to !== journeyMachine.initial) journeyMachine.assert(from, to);

    const row = await this.journey.appendJourney(candidateId, to, actorId, note);
    await this.audit.record({
      actorUserId: actorId, action: 'STATUS_CHANGE', targetType: 'candidate_journey',
      targetId: candidateId, before: { step: from }, after: { step: to },
    });
    return row;
  }

  /**
   * 체류자격 절차 전이.
   *
   * 상태머신만으로는 부족하다. APPROVED → ENTERED는 문법상 가능하지만,
   * 국내 자격 변경(D-10 → E-7-2)에는 입국이라는 사건 자체가 없다.
   * 상태머신은 후보자별 정책을 모르므로 여기서 걸러야 거짓 이력이 남지 않는다.
   */
  async advanceVisaProcess(input: {
    candidateId: string; to: VisaProcessStep; targetVisaCode: string | null;
    actorId: string | null; reason: string | null; note: string | null;
  }): Promise<VisaProcessStepRow> {
    if (input.to === 'ENTERED') {
      const candidate = await this.candidates.findById(input.candidateId);
      if (!candidate) throw new DomainError('TALENT_CANDIDATE_NOT_FOUND', { candidateId: input.candidateId });
      const tracks = await this.candidates.listTracks(input.candidateId);
      const primaryTrackId = tracks.find((t) => t.is_primary)?.track_id ?? tracks[0]?.track_id ?? null;
      if (primaryTrackId) {
        const check = await this.tracks.checkVisaEligibility(primaryTrackId, candidate.visa_status_code);
        const applicability = resolveVisaProcess({
          eligibility: check.eligibility,
          targetVisaCode: check.targetVisaCode,
          residesInKorea: candidate.visa_status_code !== null,
        });
        if (!applicability.requiresEntry) {
          throw new DomainError('TALENT_VISA_STEP_NOT_APPLICABLE', {
            step: 'ENTERED',
            reason: 'this is an in-country status change; there is no entry event',
            reasonKey: applicability.reasonKey,
          });
        }
      }
    }

    const current = await this.journey.currentVisaProcessStep(input.candidateId);
    const from = current?.step ?? visaProcessMachine.initial;
    if (current) visaProcessMachine.assert(from, input.to);
    else if (input.to !== visaProcessMachine.initial) visaProcessMachine.assert(from, input.to);

    if (input.to === 'REJECTED' && !input.reason) {
      throw new DomainError('COMMON_INVALID_TRANSITION', {
        machine: 'talent.visaProcess', to: 'REJECTED',
        reason: 'a rejection reason is mandatory — a bare drop count cannot be improved on',
      });
    }

    const row = await this.journey.appendVisaProcess({
      candidateId: input.candidateId,
      step: input.to,
      targetVisaCode: input.targetVisaCode,
      actorId: input.actorId,
      reason: input.reason,
      note: input.note,
    });
    await this.audit.record({
      actorUserId: input.actorId, action: 'STATUS_CHANGE', targetType: 'candidate_visa_process',
      targetId: input.candidateId, before: { step: current?.step ?? null }, after: { step: input.to, reason: input.reason },
    });
    return row;
  }
}

function daysUntil(d: Date | null): number | null {
  if (!d) return null;
  const now = new Date();
  const a = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const b = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return Math.round((b - a) / 86_400_000);
}
