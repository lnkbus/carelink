import { Injectable } from '@nestjs/common';
import { DomainError } from '../../../core/errors/domain-error';
import { AuditService } from '../../ops/service/audit.service';
import { ClearanceService } from '../../quality/service/clearance.service';
import { EngagementRepository, type ComplianceCheckRow, type EngagementRow } from '../repository/engagement.repository';
import { engagementMachine, type EngagementStatus } from '../state/engagement.state';
import { EngagementStrategyFactory } from '../strategy/engagement-strategy.factory';
import type { EngagementModel } from '../strategy/engagement.strategy';

@Injectable()
export class EngagementService {
  constructor(
    private readonly repo: EngagementRepository,
    private readonly strategies: EngagementStrategyFactory,
    private readonly clearances: ClearanceService,
    private readonly audit: AuditService,
  ) {}

  list(filter: Parameters<EngagementRepository['list']>[0]) { return this.repo.list(filter); }
  listChecks(engagementId: string) { return this.repo.listChecks(engagementId); }

  async getById(id: string): Promise<EngagementRow> {
    const row = await this.repo.findById(id);
    if (!row) throw new DomainError('COMMON_NOT_FOUND', { targetType: 'engagement', targetId: id });
    return row;
  }

  /**
   * 배치 생성. 모델별 컴플라이언스 체크를 이 시점에 깔아 둔다 —
   * 나중에 만들면 무엇을 확인해야 하는지 아무도 모른 채 ACTIVE가 된다.
   */
  async create(input: {
    workerUserId: string; candidateId: string | null; organizationId: string; trackId: string;
    jobId: string | null; model: EngagementModel; startedOn: string | null;
    previousEngagementId: string | null; actorUserId: string;
  }): Promise<EngagementRow> {
    // 클리어런스 6개가 전부 PASS여야 배치할 수 있다 (§5.11).
    // 예외 처리 경로를 만들지 않는다 — 만들면 그 경로가 기본값이 된다.
    await this.clearances.assertReadyForDeployment(input.workerUserId);

    const engagement = await this.repo.create(input);
    const strategy = this.strategies.get(input.model);
    await this.repo.seedChecks(engagement.id, strategy.complianceChecks().map((c) => c.code));

    await this.audit.record({
      actorUserId: input.actorUserId, action: 'STATUS_CHANGE', targetType: 'engagement',
      targetId: engagement.id,
      after: { model: input.model, status: 'DRAFT', organizationId: input.organizationId },
    });
    return this.getById(engagement.id);
  }

  async recordCheck(
    engagementId: string, code: string, result: string, note: string | null, actorUserId: string,
  ): Promise<ComplianceCheckRow[]> {
    await this.getById(engagementId);
    await this.repo.setCheck(engagementId, code, result, actorUserId, note);
    await this.audit.record({
      actorUserId, action: 'STATUS_CHANGE', targetType: 'engagement_compliance_check',
      targetId: engagementId, after: { checkCode: code, result, note },
    });
    return this.repo.listChecks(engagementId);
  }

  /**
   * 상태 전이.
   *
   * CONTRACT_PENDING → ACTIVE는 컴플라이언스 체크가 **전부 PASS**여야 한다
   * (CLAUDE.md §6-9 · docs/02 §6.6). 도급/파견 판단과 근로시간 규정 확인이
   * 이 게이트에 걸린다 — 통과하지 않은 채 배치가 시작되면 되돌릴 수 없다.
   */
  async changeStatus(
    id: string, to: EngagementStatus, endReason: string | null, actorUserId: string,
  ): Promise<EngagementRow> {
    const before = await this.getById(id);
    engagementMachine.assert(before.status, to);

    if (to === 'ACTIVE') {
      const checks = await this.repo.listChecks(id);
      const strategy = this.strategies.get(before.model);
      const blocking = new Set(strategy.complianceChecks().filter((c) => c.blocking).map((c) => c.code));
      const pending = checks.filter((c) => blocking.has(c.check_code) && c.result !== 'PASS' && c.result !== 'N_A');
      const missing = [...blocking].filter((code) => !checks.some((c) => c.check_code === code));

      if (pending.length > 0 || missing.length > 0) {
        throw new DomainError('ENGAGEMENT_COMPLIANCE_INCOMPLETE', {
          engagementId: id, model: before.model,
          pending: pending.map((c) => ({ code: c.check_code, result: c.result })),
          missing,
        });
      }
    }

    await this.repo.setStatus(id, to, endReason);
    await this.audit.record({
      actorUserId, action: 'STATUS_CHANGE', targetType: 'engagement', targetId: id,
      before: { status: before.status }, after: { status: to, endReason },
    });
    return this.getById(id);
  }

  /**
   * 고용 모델 전환. UPDATE가 아니다 (docs/04 §3.2 · §5.7).
   *
   * 기존 건을 ENDED 처리하고 새 engagement를 만들어 previous_engagement_id로 잇는다.
   * 과거 정산은 그 시점의 모델로 보존되어야 하기 때문이다.
   */
  async switchModel(input: {
    engagementId: string; newModel: EngagementModel; startedOn: string | null; actorUserId: string;
  }): Promise<EngagementRow> {
    const current = await this.getById(input.engagementId);
    if (current.model === input.newModel) {
      throw new DomainError('ENGAGEMENT_MODEL_IMMUTABLE', {
        engagementId: input.engagementId, reason: 'already on this model',
      });
    }
    if (current.status === 'ENDED' || current.status === 'TERMINATED') {
      throw new DomainError('COMMON_INVALID_TRANSITION', {
        machine: 'engagement.status', from: current.status,
        reason: 'cannot switch model on a finished engagement; create a new one instead',
      });
    }

    await this.changeStatus(input.engagementId, 'ENDED', 'MODEL_SWITCH', input.actorUserId);
    return this.create({
      workerUserId: current.worker_user_id, candidateId: current.candidate_id,
      organizationId: current.organization_id, trackId: current.track_id, jobId: current.job_id,
      model: input.newModel, startedOn: input.startedOn,
      previousEngagementId: current.id, actorUserId: input.actorUserId,
    });
  }

  /** 모델별 계약 서류·컴플라이언스 정의. 화면이 무엇을 요구할지 여기서 읽는다. */
  modelSpec(model: EngagementModel) {
    const s = this.strategies.get(model);
    return {
      model: s.model,
      requiredDocuments: s.requiredContractDocuments(),
      complianceChecks: s.complianceChecks(),
      taxTreatment: s.taxTreatment(),
      revenueRecognition: s.revenueRecognition(),
    };
  }
}
