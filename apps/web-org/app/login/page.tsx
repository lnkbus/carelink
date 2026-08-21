import { LoginForm } from './LoginForm';

/**
 * SCR-002 로그인 — 비밀번호 없음, 휴대폰 OTP만 (README §4-2 S1 확정).
 *
 * DESK지만 진입 화면은 FIELD 규격을 따릅니다. 입력 64px, 버튼 64px —
 * 운영자도 처음 들어올 때는 같은 화면을 씁니다.
 */
export default function LoginPage({ searchParams }: { searchParams: { reason?: string } }) {
  return (
    <div
      style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--cl-bg-sub)',
      }}
    >
      <div
        style={{
          width: 402, background: 'var(--cl-bg)', border: '1px solid var(--cl-line)',
          borderRadius: 'var(--cl-r-hero)', padding: 'var(--cl-s7)',
        }}
      >
        <div style={{ letterSpacing: '.28em', fontWeight: 700, fontSize: 17 }}>CARELINK</div>
        <p style={{ margin: 'var(--cl-s2) 0 var(--cl-s6)', color: 'var(--cl-text-muted)', fontSize: 'var(--cl-body)' }}>
          기관 담당자 · 인증번호로 로그인합니다
        </p>
        <ReturnReason reason={searchParams.reason} />
        <LoginForm />
      </div>
    </div>
  );
}

/**
 * 왜 로그인 화면으로 돌아왔는지 말한다.
 *
 * 아무 말 없이 되돌려 보내면 방금 로그인에 성공한 사람이 무엇이 잘못됐는지
 * 알 수 없다. 특히 `forbidden`은 **로그인은 됐지만 권한이 없는** 상태라,
 * 번호를 다시 넣어 봐야 결과가 같다 — 그걸 말해 주지 않으면 같은 시도를
 * 반복하게 된다.
 */
function ReturnReason({ reason }: { reason?: string }) {
  if (reason !== 'forbidden' && reason !== 'expired') return null;
  const text = reason === 'forbidden'
    ? '로그인은 됐지만 이 콘솔을 볼 권한이 없는 계정입니다. 운영자에게 역할 부여를 요청하세요.'
    : '로그인이 만료됐습니다. 다시 로그인해 주세요.';
  return (
    <p
      style={{
        margin: '0 0 var(--cl-s5)', padding: 'var(--cl-s4) var(--cl-s5)',
        border: '1px solid var(--cl-flag-line)', background: 'var(--cl-flag-tint)',
        color: 'var(--cl-flag)', borderRadius: 'var(--cl-r-desk)',
        fontSize: 'var(--cl-caption)', lineHeight: 1.6,
      }}
    >
      {text}
    </p>
  );
}
