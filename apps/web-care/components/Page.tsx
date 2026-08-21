import Link from 'next/link';

/**
 * 보호자 화면 껍데기.
 *
 * 사이드바가 없습니다. 보호자는 한 번에 한 가지만 합니다 — 신청하거나,
 * 확인하거나. 메뉴를 두면 급한 상황에서 길을 잃습니다.
 */
export function Page({
  title, back, children, footer, action, step,
}: {
  title: string;
  back?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** 앱바 오른쪽 슬롯. 화면당 하나만 둡니다. */
  action?: React.ReactNode;
  /**
   * 신청 4단계 중 몇 번째인가 (1~4). 주면 앱바에 `1 / 4`가 뜨고 그 아래
   * 진행 바가 붙습니다 (SCR-302~305 · design/README).
   *
   * 단계를 안 보여 주면 보호자는 몇 번을 더 눌러야 끝나는지 모른 채
   * 진행하고, 모르면 중간에 그만둡니다.
   */
  step?: 1 | 2 | 3 | 4;
}) {
  return (
    <div className="cf-page">
      <header className="cf-appbar">
        {back && <Link className="cf-back" href={back} aria-label="뒤로">‹</Link>}
        <h1>{title}</h1>
        {step && <span className="cf-stepno">{step} / 4</span>}
        {action}
      </header>
      {step && (
        <div className="cf-progress" aria-label={`4단계 중 ${step}단계`}>
          {[1, 2, 3, 4].map((n) => <span key={n} data-on={n <= step ? '1' : '0'} />)}
        </div>
      )}
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
 * 화면 맨 위의 질문 문장.
 *
 * 앱바 제목은 '간병 신청'으로 고정하고, 이 화면에서 무엇을 물어보는지는
 * 본문 첫 줄의 큰 문장이 말합니다 (design/README §Patient Web).
 * 앱바에 '병원 선택'이라고 쓰면 명사라서 무엇을 하라는 건지 덜 분명합니다.
 */
export function Ask({ children, sub }: { children: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--cl-s3)' }}>
      <h2 className="cf-ask">{children}</h2>
      {sub && <p className="cf-ask-sub">{sub}</p>}
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
