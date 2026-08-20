import { DomainError } from '../../../core/errors/domain-error';
import { roleAssignmentMachine } from './role-assignment.state';
import { userStatusMachine } from './user-status.state';

describe('userStatusMachine', () => {
  it('정지와 탈퇴 요청을 허용한다', () => {
    expect(userStatusMachine.can('ACTIVE', 'SUSPENDED')).toBe(true);
    expect(userStatusMachine.can('ACTIVE', 'WITHDRAWAL_REQUESTED')).toBe(true);
  });

  it('정지 상태에서 바로 탈퇴 요청으로 넘어갈 수 없다', () => {
    // 정지는 운영자가 건 것이므로, 해제 없이 탈퇴로 빠져나가면 사건 조사가 끊긴다.
    expect(userStatusMachine.can('SUSPENDED', 'WITHDRAWAL_REQUESTED')).toBe(false);
    expect(() => userStatusMachine.assert('SUSPENDED', 'WITHDRAWAL_REQUESTED')).toThrow(DomainError);
  });

  it('탈퇴 요청은 파기 전까지 철회할 수 있다', () => {
    expect(userStatusMachine.can('WITHDRAWAL_REQUESTED', 'ACTIVE')).toBe(true);
  });

  it('허용되지 않은 전이는 사유를 담아 던진다', () => {
    try {
      userStatusMachine.assert('SUSPENDED', 'WITHDRAWAL_REQUESTED');
      fail('should have thrown');
    } catch (e) {
      const err = e as DomainError;
      expect(err.code).toBe('COMMON_INVALID_TRANSITION');
      expect(err.details).toMatchObject({ machine: 'user.status', from: 'SUSPENDED', to: 'WITHDRAWAL_REQUESTED' });
    }
  });
});

describe('roleAssignmentMachine', () => {
  it('기관 소속은 승인 대기를 거친다', () => {
    expect(roleAssignmentMachine.can('NO_ROLE', 'PENDING_ORG_APPROVAL')).toBe(true);
    expect(roleAssignmentMachine.can('PENDING_ORG_APPROVAL', 'ROLE_SELECTED')).toBe(true);
  });

  it('승인이 거절되면 역할 없음으로 되돌아간다', () => {
    expect(roleAssignmentMachine.can('PENDING_ORG_APPROVAL', 'NO_ROLE')).toBe(true);
  });
});
