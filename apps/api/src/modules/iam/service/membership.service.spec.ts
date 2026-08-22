import { DomainError } from '../../../core/errors/domain-error';
import { AuditService } from '../../ops/service/audit.service';
import { needsApproval } from '../iam.types';
import { UserRepository, type UserRoleRow } from '../repository/user.repository';
import { MembershipService } from './membership.service';

/**
 * 승인 권한 규칙을 못박습니다.
 *
 * 눈으로 확인하는 방식은 화면이 늘어나면 뚫립니다 — 기관 관리자가 남의
 * 기관 신청서를 승인할 수 있게 되는 것은 코드 한 줄 차이이고, 그것이
 * 개인정보 유출입니다.
 */

const ORG_A = '11111111-1111-1111-1111-111111111111';
const ORG_B = '22222222-2222-2222-2222-222222222222';
const ACTOR = '99999999-9999-9999-9999-999999999999';

function row(patch: Partial<UserRoleRow> = {}): UserRoleRow {
  return {
    id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
    user_id: 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
    role: 'ORG_MEMBER',
    organization_id: ORG_A,
    is_primary: false,
    approved_at: null,
    ...patch,
  };
}

/** 저장소를 메모리로 세웁니다. 규칙을 보는 것이지 SQL을 보는 것이 아닙니다. */
function build(opts: { row?: UserRoleRow | null; hasAdmin?: boolean } = {}) {
  const approved: { id: string; role: string }[] = [];
  const users = {
    getRoleRow: jest.fn(async () => (opts.row === undefined ? row() : opts.row)),
    hasApprovedAdmin: jest.fn(async () => opts.hasAdmin ?? false),
    approveRole: jest.fn(async (id: string, role: string) => {
      approved.push({ id, role });
      return row({ id, role: role as UserRoleRow['role'], approved_at: new Date() });
    }),
    rejectRole: jest.fn(async () => true),
    listPendingRoles: jest.fn(async () => []),
  } as unknown as UserRepository;
  const audit = { record: jest.fn(async () => undefined) } as unknown as AuditService;
  return { svc: new MembershipService(users, audit), users, audit, approved };
}

async function codeOf(p: Promise<unknown>): Promise<string> {
  try {
    await p;
    return 'NO_ERROR';
  } catch (e) {
    return e instanceof DomainError ? e.code : `UNEXPECTED:${String(e)}`;
  }
}

describe('MembershipService — 누가 승인할 수 있는가', () => {
  it('기관 관리자는 자기 기관 신청만 승인한다', async () => {
    const { svc } = build({ row: row({ organization_id: ORG_A }) });
    await expect(svc.approve('id', ACTOR, ORG_A)).resolves.toBeTruthy();
  });

  it('기관 관리자가 남의 기관 신청을 승인하면 막힌다', async () => {
    const { svc } = build({ row: row({ organization_id: ORG_A }) });
    // 여기가 뚫리면 남의 기관 담당자 전화번호를 보게 됩니다.
    expect(await codeOf(svc.approve('id', ACTOR, ORG_B))).toBe('IAM_ROLE_FORBIDDEN');
  });

  it('운영자(orgId=null)는 어느 기관 신청이든 승인한다', async () => {
    const { svc } = build({ row: row({ organization_id: ORG_B }) });
    await expect(svc.approve('id', ACTOR, null)).resolves.toBeTruthy();
  });

  it('파트너 제휴는 기관 관리자가 승인할 수 없다 — 제휴는 계약이다', async () => {
    const { svc } = build({ row: row({ role: 'PARTNER', organization_id: null }) });
    expect(await codeOf(svc.approve('id', ACTOR, ORG_A))).toBe('IAM_ROLE_FORBIDDEN');
  });

  it('파트너 제휴는 운영자가 승인한다', async () => {
    const { svc } = build({ row: row({ role: 'PARTNER', organization_id: null }) });
    await expect(svc.approve('id', ACTOR, null)).resolves.toBeTruthy();
  });

  it('승인이 필요 없는 역할(후보자)은 승인 대상이 아니다', async () => {
    const { svc } = build({ row: row({ role: 'CANDIDATE', organization_id: null }) });
    expect(await codeOf(svc.approve('id', ACTOR, null))).toBe('IAM_ROLE_FORBIDDEN');
  });
});

describe('MembershipService — 첫 담당자 승격', () => {
  it('기관에 관리자가 없으면 ORG_ADMIN으로 올린다', async () => {
    const { svc, approved } = build({ hasAdmin: false });
    await svc.approve('id', ACTOR, null);
    // 승격하지 않으면 그 기관은 영원히 두 번째 사람을 스스로 못 받습니다.
    expect(approved[0].role).toBe('ORG_ADMIN');
  });

  it('이미 관리자가 있으면 ORG_MEMBER 그대로 둔다', async () => {
    const { svc, approved } = build({ hasAdmin: true });
    await svc.approve('id', ACTOR, null);
    expect(approved[0].role).toBe('ORG_MEMBER');
  });

  it('기관 없는 신청(파트너)은 승격 판정을 하지 않는다', async () => {
    const { svc, approved, users } = build({ row: row({ role: 'PARTNER', organization_id: null }) });
    await svc.approve('id', ACTOR, null);
    expect(users.hasApprovedAdmin).not.toHaveBeenCalled();
    expect(approved[0].role).toBe('PARTNER');
  });
});

describe('MembershipService — 이미 결정된 건', () => {
  it('없는 신청은 404다', async () => {
    const { svc } = build({ row: null });
    expect(await codeOf(svc.approve('id', ACTOR, null))).toBe('IAM_ROLE_REQUEST_NOT_FOUND');
  });

  it('이미 승인된 건은 다시 승인되지 않는다 — 승인 시각이 뒤로 밀리지 않는다', async () => {
    const { svc } = build({ row: row({ approved_at: new Date('2026-01-01') }) });
    expect(await codeOf(svc.approve('id', ACTOR, null))).toBe('IAM_ROLE_ALREADY_APPROVED');
  });

  it('반려도 같은 판정을 거친다 — 남의 기관 것은 반려도 못 한다', async () => {
    const { svc } = build({ row: row({ organization_id: ORG_A }) });
    expect(await codeOf(svc.reject('id', '서류 불일치', ACTOR, ORG_B))).toBe('IAM_ROLE_FORBIDDEN');
  });

  it('반려 사유는 감사 로그에 남는다 — 행은 지워도 사실은 남는다', async () => {
    const { svc, audit } = build();
    await svc.reject('id', '사업자등록증과 기관명이 다름', ACTOR, null);
    const call = (audit.record as jest.Mock).mock.calls[0][0];
    expect(call.action).toBe('user.role.reject');
    expect(call.after.reason).toBe('사업자등록증과 기관명이 다름');
  });
});

describe('needsApproval — 목록은 한 곳뿐이다', () => {
  it('승인이 걸리는 역할', () => {
    // PARTNER가 빠져 있던 목록이 하나 더 있었고, 승인 대기 파트너가
    // 권한을 그대로 받았습니다. 그래서 이 표를 테스트로 고정합니다.
    expect(needsApproval('ORG_MEMBER')).toBe(true);
    expect(needsApproval('ORG_ADMIN')).toBe(true);
    expect(needsApproval('PARTNER')).toBe(true);
  });

  it('본인이 고르면 그 자리에서 열리는 역할', () => {
    expect(needsApproval('CANDIDATE')).toBe(false);
    expect(needsApproval('CAREGIVER')).toBe(false);
    expect(needsApproval('PATIENT_FAMILY')).toBe(false);
  });
});
