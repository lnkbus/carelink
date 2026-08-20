import { Scope, ScopeOwner, ScopeUnlock } from './scope.decorator';
import { applyScope } from './scope.serializer';
import type { Viewer } from './scope.types';

class CandidateDto {
  @ScopeOwner() ownerUserId: string;
  @Scope('self', 'admin', 'org') legalName: string;
  @Scope('self', 'admin', 'org') phone: string;
  @Scope('self', 'admin', 'org', 'org_masked') displayCode: string;
  @Scope('self', 'admin', 'org', 'org_masked') experienceMonths: number;
  /** 국적은 운영자 전용. 기관에도 노출하지 않는다 (docs/07 §2.2 · docs/11 §3.1). */
  @Scope('admin') nationality: string;
  /** 체류자격 원본 코드도 운영자 전용. 기관에는 '취업 가능 여부'만 준다. */
  @Scope('admin') visaStatusCode: string;
  internalNote: string; // @Scope 없음 — 아무에게도 나가면 안 된다
}

const viewer = (scopes: Viewer['scopes'], userId = 'u1'): Viewer => ({ userId, roles: [], scopes, locale: 'ko' });

function makeCandidate(): CandidateDto {
  return Object.assign(new CandidateDto(), {
    ownerUserId: 'owner-1',
    legalName: '응우옌 티 흐엉',
    phone: '01048218821',
    displayCode: 'Candidate #102',
    experienceMonths: 38,
    nationality: 'VN',
    visaStatusCode: 'F-4',
    internalNote: '운영 메모',
  });
}

describe('applyScope', () => {
  it('운영자는 국적·체류자격까지 본다', () => {
    const out = applyScope(makeCandidate(), viewer(['admin']));
    expect(out.nationality).toBe('VN');
    expect(out.visaStatusCode).toBe('F-4');
    expect(out.legalName).toBe('응우옌 티 흐엉');
  });

  it('기관은 면접 수락 후에도 국적과 체류자격 코드를 보지 못한다', () => {
    const out = applyScope(makeCandidate(), viewer(['org']));
    expect(out.legalName).toBe('응우옌 티 흐엉'); // 실명은 열림
    expect('nationality' in out).toBe(false);
    expect('visaStatusCode' in out).toBe(false);
  });

  it('면접 수락 전 기관에는 display_code만 나간다', () => {
    const out = applyScope(makeCandidate(), viewer(['org_masked']));
    expect(out.displayCode).toBe('Candidate #102');
    expect('legalName' in out).toBe(false);
    expect('phone' in out).toBe(false);
  });

  it('권한 밖 필드는 null이 아니라 키 자체가 없다', () => {
    // null로 남기면 "값이 있다/없다"가 새고, 클라이언트가 존재를 추론할 수 있다.
    const out = applyScope(makeCandidate(), viewer(['org_masked']));
    expect(Object.keys(out)).toEqual(['displayCode', 'experienceMonths']);
  });

  it('@Scope 선언이 없는 필드는 어떤 scope로도 나가지 않는다', () => {
    for (const s of ['self', 'admin', 'org', 'org_masked', 'caregiver', 'partner'] as const) {
      expect('internalNote' in applyScope(makeCandidate(), viewer([s]))).toBe(false);
    }
  });

  it('scope가 비면 아무것도 나가지 않는다', () => {
    expect(applyScope(makeCandidate(), viewer([]))).toEqual({});
  });

  it('self는 소유자가 본인일 때만 붙는다', () => {
    // 남의 레코드를 self로 열 수 없다. 기관 담당자도 사람이므로 이 구분이 없으면
    // 자기 계정 권한으로 남의 실명·연락처를 그대로 본다.
    const mine = applyScope(makeCandidate(), viewer([], 'owner-1'));
    expect(mine.legalName).toBe('응우옌 티 흐엉');
    const others = applyScope(makeCandidate(), viewer([], 'someone-else'));
    expect(others).toEqual({});
  });

  it('기관 담당자가 남의 프로필을 볼 때 self가 새지 않는다', () => {
    const out = applyScope(makeCandidate(), viewer(['org_masked'], 'org-user'));
    expect(Object.keys(out)).toEqual(['displayCode', 'experienceMonths']);
  });

  it('중첩 DTO는 부모가 확정한 scope를 물려받는다', () => {
    // 자식마다 소유자를 다시 선언하게 하면 선언이 늘고, 하나만 빠뜨려도 응답이 조용히 빈다.
    class WrapperDto {
      @ScopeOwner() ownerUserId: string;
      @Scope('self', 'admin', 'org', 'org_masked') candidate: CandidateDto;
      @Scope('self', 'admin', 'org', 'org_masked') total: number;
    }
    const wrapper = Object.assign(new WrapperDto(), { ownerUserId: 'owner-1', candidate: makeCandidate(), total: 1 });
    const out = applyScope(wrapper, viewer(['org_masked'])) as { candidate: Record<string, unknown> };
    expect('nationality' in out.candidate).toBe(false);
    expect('legalName' in out.candidate).toBe(false);
    expect(out.candidate.displayCode).toBe('Candidate #102');
  });

  it("self를 쓰면서 @ScopeOwner를 빠뜨리면 즉시 터진다", () => {
    // 소유자 표시가 없으면 본인에게도 빈 객체가 나간다. 조용히 넘기면
    // 원인을 찾는 데 오래 걸리므로 개발 중에는 예외로 드러낸다.
    class BrokenDto {
      @Scope('self') secret: string;
    }
    const broken = Object.assign(new BrokenDto(), { secret: 'x' });
    expect(() => applyScope(broken, viewer([], 'anyone'))).toThrow(/@ScopeOwner/);
  });

  it('부모가 self로 열리면 중첩 DTO도 self로 열린다', () => {
    class ChildDto {
      @Scope('self') secret: string;
    }
    class ParentDto {
      @ScopeOwner() ownerUserId: string;
      @Scope('self') child: ChildDto;
    }
    const parent = Object.assign(new ParentDto(), {
      ownerUserId: 'owner-1',
      child: Object.assign(new ChildDto(), { secret: 'x' }),
    });
    // 자식에는 @ScopeOwner가 없지만 부모가 확정한 self를 물려받는다.
    expect(applyScope(parent, viewer([], 'owner-1'))).toEqual({ child: { secret: 'x' } });
    // 남이 보면 부모부터 닫히므로 자식도 나가지 않는다.
    expect(applyScope(parent, viewer([], 'other'))).toEqual({});
  });

  it('배열 필드의 각 요소도 잘린다', () => {
    class ListDto {
      @Scope('org_masked', 'admin') items: CandidateDto[];
    }
    const list = Object.assign(new ListDto(), { items: [makeCandidate(), makeCandidate()] });
    const out = applyScope(list, viewer(['org_masked'])) as { items: Record<string, unknown>[] };
    expect(out.items).toHaveLength(2);
    for (const item of out.items) expect('nationality' in item).toBe(false);
  });
});

describe('ScopeUnlock — 조건부 승격', () => {
  it('기관은 해제되기 전까지 실명을 보지 못한다', () => {
    const locked = Object.assign(new UnlockableDto(), { orgUnlocked: false, displayCode: 'C-00102', legalName: '흐엉' });
    const out = applyScope(locked, viewer(['org_masked'], 'org-user'));
    expect(out.displayCode).toBe('C-00102');
    expect('legalName' in out).toBe(false);
  });

  it('검증 완료 + 면접 수락이면 실명이 열린다', () => {
    const unlocked = Object.assign(new UnlockableDto(), { orgUnlocked: true, displayCode: 'C-00102', legalName: '흐엉' });
    const out = applyScope(unlocked, viewer(['org_masked'], 'org-user'));
    expect(out.legalName).toBe('흐엉');
  });

  it('해제 플래그만으로는 다른 scope가 열리지 않는다', () => {
    // org가 열려도 admin 전용 필드(국적 등)는 그대로 닫혀 있어야 한다.
    const unlocked = Object.assign(new UnlockableDto(), { orgUnlocked: true, displayCode: 'C', legalName: '흐엉', nationality: 'VN' });
    const out = applyScope(unlocked, viewer(['org_masked'], 'org-user'));
    expect('nationality' in out).toBe(false);
  });

  it('해제 플래그 자체는 응답에 나가지 않는다', () => {
    const unlocked = Object.assign(new UnlockableDto(), { orgUnlocked: true, displayCode: 'C', legalName: '흐엉' });
    expect('orgUnlocked' in applyScope(unlocked, viewer(['org_masked'], 'org-user'))).toBe(false);
  });
});

class UnlockableDto {
  @ScopeUnlock('org') orgUnlocked: boolean;
  @Scope('org_masked', 'org', 'admin') displayCode: string;
  @Scope('org', 'admin') legalName: string;
  @Scope('admin') nationality: string;
}
