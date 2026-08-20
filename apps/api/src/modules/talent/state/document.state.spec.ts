import { DomainError } from '../../../core/errors/domain-error';
import { documentMachine, DOCUMENT_VERDICTS, PURGE_ORIGINAL_AFTER_REVIEW } from './document.state';

describe('documentMachine — docs/02 §6.2', () => {
  it('제출 → 심사 → 승인', () => {
    expect(documentMachine.can('PENDING', 'UNDER_REVIEW')).toBe(true);
    expect(documentMachine.can('UNDER_REVIEW', 'VERIFIED')).toBe(true);
  });

  it('반려된 서류는 재제출로 다시 심사에 들어간다', () => {
    expect(documentMachine.can('UNDER_REVIEW', 'REJECTED')).toBe(true);
    expect(documentMachine.can('REJECTED', 'UNDER_REVIEW')).toBe(true);
  });

  it('심사를 건너뛰고 승인할 수 없다', () => {
    expect(documentMachine.can('PENDING', 'VERIFIED')).toBe(false);
    expect(() => documentMachine.assert('PENDING', 'VERIFIED')).toThrow(DomainError);
  });

  it('만료는 승인된 서류에서만 일어난다', () => {
    expect(documentMachine.can('VERIFIED', 'EXPIRED')).toBe(true);
    expect(documentMachine.can('PENDING', 'EXPIRED')).toBe(false);
    expect(documentMachine.can('REJECTED', 'EXPIRED')).toBe(false);
  });

  it('만료된 서류는 되살리지 않는다', () => {
    // 같은 행을 재사용하면 어느 발급본으로 검증했는지가 사라진다.
    expect(documentMachine.isTerminal('EXPIRED')).toBe(true);
  });

  it('원본 파기 대상은 범죄경력과 건강진단서 두 종뿐이다', () => {
    // docs/11 §1.2 — 확인 후 원본 파기, 결과값만 보존.
    expect([...PURGE_ORIGINAL_AFTER_REVIEW].sort()).toEqual(['CRIMINAL_RECORD', 'HEALTH']);
    expect(DOCUMENT_VERDICTS.CRIMINAL_RECORD).toEqual(['CLEAR', 'FLAGGED']);
    expect(DOCUMENT_VERDICTS.HEALTH).toEqual(['FIT', 'UNFIT']);
  });
});
