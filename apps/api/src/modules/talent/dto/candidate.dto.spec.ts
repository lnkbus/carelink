import { applyScope } from '../../../core/scope/scope.serializer';
import type { Viewer } from '../../../core/scope/scope.types';
import { CandidateDto } from './candidate.dto';

const viewer = (scopes: Viewer['scopes'], userId = 'other-user'): Viewer => ({ userId, roles: [], scopes, locale: 'ko' });
const OWNER = 'owner-user';

function candidate(): CandidateDto {
  return Object.assign(new CandidateDto(), {
    ownerUserId: OWNER,
    id: 'c1',
    displayCode: 'C-00102',
    name: '응우옌 티 흐엉',
    birthDate: '1985-03-11',
    phone: '01048218821',
    nationality: 'VN',
    visaStatusCode: 'F-4',
    visaExpiresOn: '2027-01-31',
    visaExpiresInDays: 42,
    employable: 'ALLOWED',
    employabilityReasonKey: 'visa.eligibility.ALLOWED',
    currentLocation: '경기 안산',
    status: 'READY',
    tracks: [],
    assigneeId: 'admin-1',
    channelId: 'ch-1',
    tags: ['고려인'],
  });
}

describe('CandidateDto scope — docs/11 §3.1 매트릭스', () => {
  it('면접 수락 전 기관은 display_code만 본다', () => {
    const out = applyScope(candidate(), viewer(['org_masked']));
    expect(out.displayCode).toBe('C-00102');
    expect('name' in out).toBe(false);
    expect('phone' in out).toBe(false);
    expect('birthDate' in out).toBe(false);
  });

  it('면접 수락 후에도 기관은 국적과 체류자격 코드를 보지 못한다', () => {
    const out = applyScope(candidate(), viewer(['org']));
    expect(out.name).toBe('응우옌 티 흐엉');   // 실명은 열림
    expect(out.phone).toBe('01048218821');     // 연락처도 열림
    expect('nationality' in out).toBe(false);
    expect('visaStatusCode' in out).toBe(false);
    expect('visaExpiresOn' in out).toBe(false);
  });

  it('기관에는 체류자격 대신 취업 가능 여부만 나간다', () => {
    // CLAUDE.md §6-12 — 체류자격 코드를 기관에 그대로 노출하지 않는다.
    const out = applyScope(candidate(), viewer(['org']));
    expect(out.employable).toBe('ALLOWED');
    expect(out.employabilityReasonKey).toBe('visa.eligibility.ALLOWED');
  });

  it('본인은 자기 국적과 체류자격을 본다 (SCR-104 data)', () => {
    const out = applyScope(candidate(), viewer([], OWNER));
    expect(out.nationality).toBe('VN');
    expect(out.visaStatusCode).toBe('F-4');
    expect(out.visaExpiresInDays).toBe(42);
  });

  it('운영 관리 필드는 어느 기관 scope에도 나가지 않는다', () => {
    for (const s of ['org', 'org_masked'] as const) {
      const out = applyScope(candidate(), viewer([s]));
      expect('assigneeId' in out).toBe(false);
      expect('channelId' in out).toBe(false);
      expect('tags' in out).toBe(false);
    }
  });

  it('간병사·파트너는 후보자 프로필을 전혀 보지 못한다', () => {
    expect(applyScope(candidate(), viewer(['caregiver']))).toEqual({});
    expect(applyScope(candidate(), viewer(['partner']))).toEqual({});
  });
});

/**
 * org 승격 회귀 테스트.
 *
 * 이전에는 ORG_MEMBER가 항상 org_masked만 받고 org로 올라갈 길이 없어서,
 * 면접을 수락해도 SCR-204의 UNLOCKED 상태에 도달하지 못했다. 반대로 승격이
 * 뷰어 단위로 붙으면 한 명을 수락한 기관이 전 후보자의 실명을 보게 된다.
 *
 * 승격은 **레코드 단위**여야 한다 — @ScopeUnlock('org')가 그 역할을 한다.
 */
describe('CandidateDto org 승격 — 레코드 단위여야 한다', () => {
  it('orgUnlocked가 참인 후보자만 실명·연락처가 열린다', () => {
    const unlocked = Object.assign(candidate(), { orgUnlocked: true });
    const out = applyScope(unlocked, viewer(['org_masked']));
    expect(out.name).toBe('응우옌 티 흐엉');
    expect(out.phone).toBe('01048218821');
  });

  it('열린 뒤에도 국적·체류자격 코드는 나가지 않는다', () => {
    const unlocked = Object.assign(candidate(), { orgUnlocked: true });
    const out = applyScope(unlocked, viewer(['org_masked']));
    expect('nationality' in out).toBe(false);
    expect('visaStatusCode' in out).toBe(false);
    expect('visaExpiresOn' in out).toBe(false);
    // 기관에는 치환값만
    expect(out.employable).toBe('ALLOWED');
  });

  it('같은 뷰어라도 orgUnlocked가 거짓인 후보자는 여전히 잠겨 있다', () => {
    const v = viewer(['org_masked']);
    const opened = applyScope(Object.assign(candidate(), { orgUnlocked: true }), v);
    const locked = applyScope(Object.assign(candidate(), { orgUnlocked: false, id: 'c2' }), v);

    expect(opened.name).toBeDefined();
    expect('name' in locked).toBe(false);
  });

  it('orgUnlocked를 넣지 않으면 잠긴 상태다 — 기본값이 열림이면 안 된다', () => {
    const out = applyScope(candidate(), viewer(['org_masked']));
    expect('name' in out).toBe(false);
  });

  it('운영자는 승격과 무관하게 본다', () => {
    const out = applyScope(candidate(), viewer(['admin']));
    expect(out.name).toBeDefined();
    expect(out.nationality).toBe('VN');
  });
});
