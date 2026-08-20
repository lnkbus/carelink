import { UserService } from './user.service';

describe('UserService.toScopes', () => {
  const service = new UserService(null as never);

  it('역할이 없어도 self는 붙는다', () => {
    // SCR-003 이전의 신규 가입자. self가 없으면 방금 받은 토큰도 응답에서 잘린다.
    expect(service.toScopes([])).toEqual(['self']);
  });

  it('운영자는 admin scope를 받는다', () => {
    expect(service.toScopes(['ADMIN'])).toContain('admin');
    expect(service.toScopes(['SUPER_ADMIN'])).toContain('admin');
  });

  it('기관 담당자는 기본이 org_masked다', () => {
    // 검증 완료 + 후보자의 면접 수락 이후에만 org로 올라간다.
    // 역할만으로 org를 주면 실명·연락처 게이트가 무너진다 (docs/02 §5.2).
    const scopes = service.toScopes(['ORG_MEMBER']);
    expect(scopes).toContain('org_masked');
    expect(scopes).not.toContain('org');
  });

  it('기관 관리자도 org로 자동 승격되지 않는다', () => {
    expect(service.toScopes(['ORG_ADMIN'])).not.toContain('org');
  });

  it('간병사는 caregiver scope만 받는다', () => {
    const scopes = service.toScopes(['CAREGIVER']);
    expect(scopes).toEqual(expect.arrayContaining(['self', 'caregiver']));
    expect(scopes).not.toContain('admin');
    expect(scopes).not.toContain('org');
  });

  it('파트너는 partner scope만 받는다', () => {
    const scopes = service.toScopes(['PARTNER']);
    expect(scopes).toContain('partner');
    expect(scopes).not.toContain('admin');
  });

  it('역할을 겸하면 scope가 합쳐진다', () => {
    // 요양보호사가 간병사를 겸하는 경우가 흔하다 (docs/02 §5.1).
    const scopes = service.toScopes(['CANDIDATE', 'CAREGIVER']);
    expect(scopes).toEqual(expect.arrayContaining(['self', 'caregiver']));
  });
});
