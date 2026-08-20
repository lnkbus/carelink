import { Injectable } from '@nestjs/common';
import { DbService } from '../../../core/db/db.service';
import type { JourneyStep } from '../state/journey.state';
import type { VisaProcessStep } from '../state/visa-process.state';

export interface JourneyStepRow {
  id: string; candidate_id: string; step: JourneyStep;
  entered_at: Date; actor_id: string | null; note: string | null;
}

export interface VisaProcessStepRow {
  id: string; candidate_id: string; step: VisaProcessStep;
  target_visa_code: string | null; entered_at: Date;
  actor_id: string | null; reason: string | null; note: string | null;
}

/**
 * 여정 이력. 두 축 모두 append-only다 — 정정은 UPDATE가 아니라 새 행이다.
 * 이 이력이 근속 데이터의 원천이고, 세그먼트별 리드타임의 유일한 실측 근거다.
 */
@Injectable()
export class JourneyRepository {
  constructor(private readonly db: DbService) {}

  listJourney(candidateId: string): Promise<JourneyStepRow[]> {
    return this.db.query<JourneyStepRow>(
      `SELECT id, candidate_id, step, entered_at, actor_id, note
         FROM candidate_journey_steps WHERE candidate_id = $1 ORDER BY entered_at`,
      [candidateId],
    );
  }

  async currentJourneyStep(candidateId: string): Promise<JourneyStepRow | null> {
    return this.db.one<JourneyStepRow>(
      `SELECT id, candidate_id, step, entered_at, actor_id, note
         FROM candidate_journey_steps WHERE candidate_id = $1
        ORDER BY entered_at DESC, id DESC LIMIT 1`,
      [candidateId],
    );
  }

  async appendJourney(
    candidateId: string, step: JourneyStep, actorId: string | null, note: string | null,
  ): Promise<JourneyStepRow> {
    const row = await this.db.one<JourneyStepRow>(
      `INSERT INTO candidate_journey_steps (candidate_id, step, actor_id, note)
       VALUES ($1, $2, $3, $4)
       RETURNING id, candidate_id, step, entered_at, actor_id, note`,
      [candidateId, step, actorId, note],
    );
    return row!;
  }

  listVisaProcess(candidateId: string): Promise<VisaProcessStepRow[]> {
    return this.db.query<VisaProcessStepRow>(
      `SELECT id, candidate_id, step, target_visa_code, entered_at, actor_id, reason, note
         FROM candidate_visa_process_steps WHERE candidate_id = $1 ORDER BY entered_at`,
      [candidateId],
    );
  }

  currentVisaProcessStep(candidateId: string): Promise<VisaProcessStepRow | null> {
    return this.db.one<VisaProcessStepRow>(
      `SELECT id, candidate_id, step, target_visa_code, entered_at, actor_id, reason, note
         FROM candidate_visa_process_steps WHERE candidate_id = $1
        ORDER BY entered_at DESC, id DESC LIMIT 1`,
      [candidateId],
    );
  }

  async appendVisaProcess(input: {
    candidateId: string; step: VisaProcessStep; targetVisaCode: string | null;
    actorId: string | null; reason: string | null; note: string | null;
  }): Promise<VisaProcessStepRow> {
    const row = await this.db.one<VisaProcessStepRow>(
      `INSERT INTO candidate_visa_process_steps
         (candidate_id, step, target_visa_code, actor_id, reason, note)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, candidate_id, step, target_visa_code, entered_at, actor_id, reason, note`,
      [input.candidateId, input.step, input.targetVisaCode, input.actorId, input.reason, input.note],
    );
    return row!;
  }
}
