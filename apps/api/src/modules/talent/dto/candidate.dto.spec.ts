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
    employable: true,
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
    expect(out.employable).toBe(true);
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
