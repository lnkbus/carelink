import { applyScope } from '../../../core/scope/scope.serializer';
import type { Viewer } from '../../../core/scope/scope.types';
import { PendingRoleDto } from './auth.dto';

/**
 * 승인 큐가 **빈 화면으로 나오지 않는지** 지킵니다.
 *
 * 처음에 `@Scope('admin', 'org')`로 적었고, 기관 관리자 큐가 필드 하나 없는
 * 빈 객체로 나왔습니다. 'org'는 역할이 아니라 관계(검증 완료 + 후보자의
 * 면접 수락)이고 후보자 개인정보에만 붙습니다 — 기관 담당자가 평소 들고
 * 있는 것은 'org_masked'입니다.
 *
 * 눈으로는 이런 게 안 보입니다. 화면이 조용히 비어 있을 뿐입니다.
 */

const viewer = (scopes: Viewer['scopes']): Viewer => ({
  userId: 'u1', roles: [], scopes, locale: 'ko',
});

function pending(): PendingRoleDto {
  return Object.assign(new PendingRoleDto(), {
    id: 'req-1',
    role: 'ORG_MEMBER',
    requestedAt: new Date('2026-08-22T00:00:00Z'),
    phone: '01077770005',
    organizationId: 'org-1',
    organizationName: '검증용재활병원',
    businessRegNo: '777-88-99002',
    verificationStatus: 'PENDING',
    becomesAdmin: false,
  });
}

describe('PendingRoleDto — 승인 큐 필드 노출', () => {
  it('기관 관리자(org_masked)는 승인에 필요한 값을 본다', () => {
    const out = applyScope(pending(), viewer(['public', 'org_masked'])) as Record<string, unknown>;
    // 신청자 번호가 없으면 승인하는 쪽은 누구인지 확인할 방법이 없습니다.
    expect(out.phone).toBe('01077770005');
    expect(out.id).toBe('req-1');
    expect(out.role).toBe('ORG_MEMBER');
    expect(out.becomesAdmin).toBe(false);
  });

  it('기관 관리자에게 사업자등록번호는 나가지 않는다 — 운영자가 대조하는 값이다', () => {
    const out = applyScope(pending(), viewer(['public', 'org_masked'])) as Record<string, unknown>;
    expect(out.businessRegNo).toBeUndefined();
  });

  it('운영자는 사업자등록번호까지 본다', () => {
    const out = applyScope(pending(), viewer(['public', 'admin'])) as Record<string, unknown>;
    expect(out.businessRegNo).toBe('777-88-99002');
    expect(out.phone).toBe('01077770005');
  });

  it('그 외에는 아무것도 나가지 않는다 — 남의 신청서는 그 자체가 개인정보다', () => {
    const out = applyScope(pending(), viewer(['public'])) as Record<string, unknown>;
    expect(out.phone).toBeUndefined();
    expect(out.organizationName).toBeUndefined();
    expect(out.id).toBeUndefined();
  });

  it('간병사·후보자 scope로도 새지 않는다', () => {
    for (const s of ['caregiver', 'partner', 'self'] as const) {
      const out = applyScope(pending(), viewer(['public', s])) as Record<string, unknown>;
      expect(out.phone).toBeUndefined();
    }
  });
});
