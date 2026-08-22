import Link from 'next/link';

/**
 * 가입 흐름의 공통 카드.
 *
 * 로그인 화면과 같은 규격입니다 — 같은 사람이 로그인 직후 바로 이 화면을
 * 보기 때문에, 갑자기 표와 사이드바가 나오면 다른 서비스로 넘어온 것처럼
 * 보입니다. 셸(AdminShell/OrgShell)을 쓰지 않는 이유이기도 합니다:
 * 아직 어느 구역에도 속하지 않은 사람입니다.
 */
export function SignupCard({
  title, lead, children, back,
}: {
  title: string;
  lead?: string;
  children: React.ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <div
      style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 'var(--cl-s5)', background: 'var(--cl-bg-sub)',
      }}
    >
      <div
        style={{
          // 고정 폭이면 360px 폰에서 카드가 화면 밖으로 나갑니다.
          width: '100%', maxWidth: 560,
          background: 'var(--cl-bg)', border: '1px solid var(--cl-line)',
          borderRadius: 'var(--cl-r-hero)', padding: 'var(--cl-s7)',
        }}
      >
        {back && (
          <Link
            href={back.href}
            style={{
              display: 'inline-block', marginBottom: 'var(--cl-s5)',
              fontSize: 'var(--cl-caption)', color: 'var(--cl-text-muted)',
            }}
          >
            ← {back.label}
          </Link>
        )}
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em' }}>{title}</h1>
        {lead && (
          <p style={{ margin: 'var(--cl-s3) 0 var(--cl-s6)', color: 'var(--cl-text-sub)', fontSize: 17, lineHeight: 1.6 }}>
            {lead}
          </p>
        )}
        {children}
      </div>
    </div>
  );
}

/**
 * 로그인이 필요한 자리.
 *
 * 신청 화면을 보는 것과 신청서를 내는 것은 다릅니다. 무엇을 신청하는지
 * 보기 전에 번호부터 넣으라고 하면 순서가 거꾸로입니다 — 그래서 화면은
 * 열어 두고, 폼 자리에 이것을 놓습니다.
 *
 * 돌아올 곳을 `next`로 들려 보냅니다. 없으면 로그인 뒤 역할이 없어
 * `/no-access`로 가고, 거기서 다시 여기까지 오는 데 두 번을 더 눌러야
 * 합니다.
 */
export function LoginRequired({ next, what }: { next: string; what: string }) {
  return (
    <div
      style={{
        padding: 'var(--cl-s6)', borderRadius: 14,
        border: '1px solid var(--cl-line-strong)', background: 'var(--cl-bg-sub)',
      }}
    >
      <div style={{ fontSize: 17, fontWeight: 700 }}>먼저 휴대폰 번호를 인증해 주세요</div>
      <p style={{ margin: 'var(--cl-s3) 0 0', fontSize: 15, lineHeight: 1.7, color: 'var(--cl-text-sub)' }}>
        {what}은(는) 누가 신청했는지 알아야 승인할 수 있습니다. 비밀번호는 없습니다 —
        번호를 넣으면 인증 문자가 갑니다.
      </p>
      <div style={{ marginTop: 'var(--cl-s5)' }}>
        <Link
          href={`/login?next=${encodeURIComponent(next)}`}
          style={{
            display: 'inline-flex', alignItems: 'center', height: 'var(--cl-tap-desk)',
            padding: '0 var(--cl-s5)', borderRadius: 'var(--cl-r-desk)',
            background: 'var(--cl-action-strong)', color: '#fff',
            fontSize: 'var(--cl-body)', fontWeight: 600,
          }}
        >
          번호 인증하고 계속하기
        </Link>
      </div>
    </div>
  );
}

/** 설명 상자 — 게이트를 숨기지 않고 설명하는 자리입니다. */
export function Note({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        marginTop: 'var(--cl-s5)', padding: 'var(--cl-s5)', borderRadius: 12,
        background: 'var(--cl-bg-sub)', color: 'var(--cl-text-sub)',
        fontSize: 15, lineHeight: 1.7,
      }}
    >
      {children}
    </div>
  );
}
