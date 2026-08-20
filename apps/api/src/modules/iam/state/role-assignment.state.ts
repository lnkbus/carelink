import { StateMachine } from '../../../core/state/state-machine';

/**
 * SCR-003 역할 선택의 states — NO_ROLE | ROLE_SELECTED | PENDING_ORG_APPROVAL.
 *
 * ORG_MEMBER/ORG_ADMIN은 기관 관리자 승인 전까지 PENDING이다 (SCR-003 notes).
 * user_roles.approved_at이 NULL인 동안이 PENDING_ORG_APPROVAL에 해당한다.
 */
export type RoleAssignmentState = 'NO_ROLE' | 'PENDING_ORG_APPROVAL' | 'ROLE_SELECTED';

export const roleAssignmentMachine = new StateMachine<RoleAssignmentState>(
  'iam.roleAssignment',
  {
    NO_ROLE: ['ROLE_SELECTED', 'PENDING_ORG_APPROVAL'],
    PENDING_ORG_APPROVAL: ['ROLE_SELECTED', 'NO_ROLE'],
    ROLE_SELECTED: ['PENDING_ORG_APPROVAL'],
  },
  'NO_ROLE',
);
