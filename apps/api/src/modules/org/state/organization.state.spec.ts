import { DomainError } from '../../../core/errors/domain-error';
import { canSponsorE7, e7SponsorMachine, organizationVerificationMachine } from './organization.state';

describe('organizationVerificationMachine — 후보자 PII의 게이트', () => {
  it('심사를 거쳐야 검증 완료가 된다', () => {
    expect(organizationVerificationMachine.initial).toBe('PENDING');
    expect(organizationVerificationMachine.can('PENDING', 'VERIFIED')).toBe(true);
  });

  it('반려된 기관은 재심사로 돌아간다', () => {
    expect(organizationVerificationMachine.can('REJECTED', 'PENDING')).toBe(true);
    // 반려에서 바로 검증 완료로 뛰어넘을 수 없다.
    expect(organizationVerificationMachine.can('REJECTED', 'VERIFIED')).toBe(false);
    expect(() => organizationVerificationMachine.assert('REJECTED', 'VERIFIED')).toThrow(DomainError);
  });

  it('사건 누적 기관은 신규 배정을 정지시킨다 (SCR-503)', () => {
    expect(organizationVerificationMachine.can('VERIFIED', 'SUSPENDED')).toBe(true);
    expect(organizationVerificationMachine.can('SUSPENDED', 'VERIFIED')).toBe(true);
  });
});

describe('e7SponsorMachine — E-7-2 취업처 적격성', () => {
  it('ELIGIBLE만 외국인 배치가 가능하다', () => {
    expect(canSponsorE7('ELIGIBLE')).toBe(true);
    // CONDITIONAL은 아직 확인이 남아 있다. 통과로 취급하면 자격 범위를 벗어난 배치가 된다.
    expect(canSponsorE7('CONDITIONAL')).toBe(false);
    expect(canSponsorE7('NOT_REVIEWED')).toBe(false);
    expect(canSponsorE7('INELIGIBLE')).toBe(false);
  });

  it('요건이 변하므로 재검토 경로가 열려 있다', () => {
    expect(e7SponsorMachine.can('ELIGIBLE', 'INELIGIBLE')).toBe(true);
    expect(e7SponsorMachine.can('INELIGIBLE', 'CONDITIONAL')).toBe(true);
  });
});
