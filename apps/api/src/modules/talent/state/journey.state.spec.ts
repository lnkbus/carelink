import { DomainError } from '../../../core/errors/domain-error';
import { displayGroupOf, displayProgress, journeyMachine, JOURNEY_DISPLAY_GROUPS } from './journey.state';
import { isVisaProcessComplete, visaProcessMachine } from './visa-process.state';
import { resolveVisaProcess } from './visa-process.policy';

describe('journeyMachine — 커리어 여정 9단계', () => {
  it('스키마 journey_step ENUM과 같은 9개 상태를 갖는다', () => {
    expect(journeyMachine.states.sort()).toEqual(
      ['ACTIVE', 'APPLIED', 'DOC_REVIEW', 'INTERVIEW', 'MATCHED', 'PLACED', 'PROFILE_REGISTERED', 'READY', 'TRAINING'],
    );
  });

  it('정상 경로를 끝까지 통과한다', () => {
    const path = ['APPLIED','PROFILE_REGISTERED','DOC_REVIEW','TRAINING','READY','MATCHED','INTERVIEW','PLACED','ACTIVE'] as const;
    for (let i = 0; i < path.length - 1; i++) {
      expect(journeyMachine.can(path[i], path[i + 1])).toBe(true);
    }
  });

  it('단계를 건너뛸 수 없다', () => {
    // 서류 심사를 지나지 않고 매칭에 나가면 미검증 인력이 기관에 노출된다.
    expect(journeyMachine.can('PROFILE_REGISTERED', 'READY')).toBe(false);
    expect(journeyMachine.can('DOC_REVIEW', 'MATCHED')).toBe(false);
    expect(() => journeyMachine.assert('APPLIED', 'PLACED')).toThrow(DomainError);
  });

  it('서류·클리어런스가 만료되면 READY에서 뒤로 돌아간다', () => {
    expect(journeyMachine.can('READY', 'DOC_REVIEW')).toBe(true);
    expect(journeyMachine.can('READY', 'TRAINING')).toBe(true);
  });

  it('매칭이 깨지면 재배치 대기로 복귀한다', () => {
    expect(journeyMachine.can('MATCHED', 'READY')).toBe(true);
    expect(journeyMachine.can('INTERVIEW', 'READY')).toBe(true);
    // 배치가 끝나도 관계가 끊기지 않는다 — 재배치가 이 사업의 매출 구조다.
    expect(journeyMachine.can('ACTIVE', 'READY')).toBe(true);
  });

  it('SCR-101의 5점 스테퍼로 접힌다', () => {
    expect(JOURNEY_DISPLAY_GROUPS).toHaveLength(5);
    expect(displayGroupOf('DOC_REVIEW')).toBe('VERIFY');
    expect(displayProgress('DOC_REVIEW')).toEqual({ current: 2, total: 5 });
    expect(displayProgress('INTERVIEW')).toEqual({ current: 4, total: 5 });
  });

  it('9개 상태가 모두 어느 그룹엔가 속한다', () => {
    const grouped = JOURNEY_DISPLAY_GROUPS.flatMap((g) => g.steps as readonly string[]);
    expect(grouped.sort()).toEqual(journeyMachine.states.sort());
  });
});

describe('visaProcessMachine — 체류자격 절차 (별도 축)', () => {
  it('고용계약이 첫 단계다', () => {
    // 커리어 여정에서는 계약이 8번째(PLACED)지만 여기서는 첫 단계다.
    // E-7-2 심사가 고용주를 전제로 하므로 계약 없이는 신청이 되지 않는다.
    expect(visaProcessMachine.initial).toBe('CONTRACT_SIGNED');
  });

  it('접수 후 보완 요구로 서류 심사로 되돌아갈 수 있다', () => {
    expect(visaProcessMachine.can('APPLICATION_SUBMITTED', 'DOCUMENT_REVIEW')).toBe(true);
  });

  it('불허와 철회는 종료 상태다 — 재신청은 새 절차', () => {
    expect(visaProcessMachine.isTerminal('REJECTED')).toBe(true);
    expect(visaProcessMachine.isTerminal('WITHDRAWN')).toBe(true);
  });

  it('국내 자격 변경은 APPROVED가 종착점, 해외 건은 ENTERED까지', () => {
    expect(isVisaProcessComplete('APPROVED', false)).toBe(true);   // D-10 → E-7-2
    expect(isVisaProcessComplete('APPROVED', true)).toBe(false);   // 해외 신규 발급
    expect(isVisaProcessComplete('ENTERED', true)).toBe(true);
  });
});

describe('resolveVisaProcess — 누구에게 이 축이 붙는가', () => {
  it('국내 취업 가능 자격 보유자는 절차가 없다', () => {
    // 세그먼트 A·B·C (F-4·F-6). MVP 초기 공급의 주력이다.
    const r = resolveVisaProcess({ eligibility: 'ALLOWED', targetVisaCode: null, residesInKorea: true });
    expect(r.applicable).toBe(false);
  });

  it('자격 취득만 필요한 경우는 체류자격 절차가 아니다', () => {
    // F-4가 요양보호사 자격을 따는 것은 교육 경로이지 체류자격 변경이 아니다.
    const r = resolveVisaProcess({ eligibility: 'REQUIRES_QUALIFICATION', targetVisaCode: null, residesInKorea: true });
    expect(r.applicable).toBe(false);
  });

  it('국내 자격 변경은 입국 단계가 없다', () => {
    const r = resolveVisaProcess({ eligibility: 'REQUIRES_CONVERSION', targetVisaCode: 'E-7-2', residesInKorea: true });
    expect(r).toMatchObject({ applicable: true, requiresEntry: false, targetVisaCode: 'E-7-2' });
  });

  it('해외 모집 건은 입국까지 간다', () => {
    const r = resolveVisaProcess({ eligibility: 'REQUIRES_CONVERSION', targetVisaCode: 'E-7-2', residesInKorea: false });
    expect(r).toMatchObject({ applicable: true, requiresEntry: true });
  });

  it('회색 영역은 절차를 시작하지 않는다', () => {
    // F-4 × 병원간병이 여기 해당한다. 사람이 먼저 판정해야 한다 (docs/06 §4).
    const r = resolveVisaProcess({ eligibility: 'PENDING_CONFIRMATION', targetVisaCode: null, residesInKorea: true });
    expect(r.applicable).toBe(false);
    expect(r.reasonKey).toBe('visa.process.pendingConfirmation');
  });

  it('부적격은 절차 자체가 없다', () => {
    const r = resolveVisaProcess({ eligibility: 'NOT_ALLOWED', targetVisaCode: null, residesInKorea: true });
    expect(r.applicable).toBe(false);
  });
});
