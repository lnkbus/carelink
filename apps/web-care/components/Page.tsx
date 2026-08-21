import Link from 'next/link';

/**
 * 보호자 화면 껍데기.
 *
 * 사이드바가 없습니다. 보호자는 한 번에 한 가지만 합니다 — 신청하거나,
 * 확인하거나. 메뉴를 두면 급한 상황에서 길을 잃습니다.
 */
export function Page({
  title, back, children, footer, action,
}: {
  title: string;
  back?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** 앱바 오른쪽 슬롯. 홈의 로그아웃처럼 화면당 하나만 둡니다. */
  action?: React.ReactNode;
}) {
  return (
    <div className="cf-page">
      <header className="cf-appbar">
        {back && <Link className="cf-back" href={back} aria-label="뒤로">‹</Link>}
        <h1>{title}</h1>
        {action}
      </header>
      <div className="cf-body">{children}</div>
      {footer && (
        <div style={{ padding: 'var(--cl-s6)', borderTop: '1px solid var(--cl-line)', position: 'sticky', bottom: 0, background: 'var(--cl-bg)' }}>
          {footer}
        </div>
      )}
    </div>
  );
}

/**
 * 차단·실패 안내.
 *
 * **코드를 화면에 띄우지 않습니다.** 운영 콘솔과 다른 점입니다 — 운영자에게는
 * `CARE_SCOPE_REVIEW_REQUIRED`가 정보지만 보호자에게는 아무 의미도 없고,
 * 오히려 시스템이 고장 난 것처럼 보입니다. 사전에 문장이 있고,
 * 그 문장은 **다음에 무엇을 하면 되는지**까지 말합니다.
 */
export function Notice({ children, tone = 'flag' }: { children: React.ReactNode; tone?: 'flag' | 'alert' }) {
  return <div className={tone === 'alert' ? 'cf-note cf-note-alert' : 'cf-note'}>{children}</div>;
}

export function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="cf-row">
      <span className="cf-label">{label}</span>
      <span className="cf-value">{children}</span>
    </div>
  );
}
