import type { Me } from '@carelink/shared-types';
import { LogoutButton } from '@/components/LogoutButton';
import { Page, Row } from '@/components/Page';
import { apiGet } from '@/lib/api';

export const dynamic = 'force-dynamic';

/**
 * 내 정보 — 보호자.
 *
 * 세 FIELD 앱에서 **로그아웃은 항상 이 화면 맨 아래**에 있습니다
 * (후보자 앱 SCR-110이 그렇게 설계돼 있고, 나머지를 거기 맞췄습니다).
 * 앱마다 다른 자리에 두면 계정을 바꿔야 할 때마다 찾아 헤매게 됩니다.
 *
 * 디자인(SCR-301)의 앱바 오른쪽은 '도움말'입니다. 그 의도는 여기 전화
 * 상담으로 살립니다 — 보호자에게 필요한 도움은 문서가 아니라 사람입니다.
 */
export default async function MePage() {
  let me: Me | null = null;
  try {
    me = await apiGet<Me>('/auth/me');
  } catch {
    me = null;
  }

  return (
    <Page title="내 정보" back="/care">
      <div className="cf-card">
        <Row label="휴대폰 번호">
          <span className="cf-mono">{me?.phone ?? '—'}</span>
        </Row>
      </div>

      <div className="cf-card">
        <h2>도움이 필요하세요?</h2>
        <p style={{ margin: 0, color: 'var(--cl-text-sub)', lineHeight: 1.6 }}>
          신청·변경·취소는 전화로도 도와 드립니다. 평일 09:00~18:00.
        </p>
        <a className="cf-btn cf-btn-ghost" href="tel:1533-0000">전화 상담 1533-0000</a>
      </div>

      <div style={{ marginTop: 'var(--cl-s6)' }}>
        <LogoutButton />
      </div>
    </Page>
  );
}
