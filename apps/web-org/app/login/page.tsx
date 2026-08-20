import { LoginForm } from './LoginForm';

/**
 * SCR-002 로그인 — 비밀번호 없음, 휴대폰 OTP만 (README §4-2 S1 확정).
 *
 * DESK지만 진입 화면은 FIELD 규격을 따릅니다. 입력 64px, 버튼 64px —
 * 운영자도 처음 들어올 때는 같은 화면을 씁니다.
 */
export default function LoginPage() {
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
        <LoginForm />
      </div>
    </div>
  );
}
