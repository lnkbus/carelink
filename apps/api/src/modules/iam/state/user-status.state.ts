import { StateMachine } from '../../../core/state/state-machine';

/** users.status. SCR-110 states — ACTIVE | SUSPENDED | WITHDRAWAL_REQUESTED */
export type UserStatus = 'ACTIVE' | 'SUSPENDED' | 'WITHDRAWAL_REQUESTED';

export const userStatusMachine = new StateMachine<UserStatus>(
  'user.status',
  {
    ACTIVE: ['SUSPENDED', 'WITHDRAWAL_REQUESTED'],
    SUSPENDED: ['ACTIVE'],
    // 탈퇴 요청은 30일 후 파기된다 (docs/11 §4). 그 사이 철회하면 ACTIVE로 돌아간다.
    WITHDRAWAL_REQUESTED: ['ACTIVE'],
  },
  'ACTIVE',
);
