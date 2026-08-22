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
