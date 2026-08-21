import { LoginForm } from './LoginForm';

/**
 * SCR-002 로그인 — 휴대폰 OTP만 (README §4-2 S1 확정).
 *
 * 보호자는 앱을 설치하지 않고 병원에서 급하게 링크로 들어옵니다 (SCR-301 notes).
 * 그래서 가입 절차를 따로 두지 않았습니다 — 번호 인증이 곧 가입입니다.
 */
export default function LoginPage() {
  return (
    <div className="cf-page">
      <div className="cf-body" style={{ justifyContent: 'center' }}>
        <div style={{ letterSpacing: '.28em', fontWeight: 700, fontSize: 'var(--cf-subtitle)' }}>CARELINK</div>
        <p style={{ margin: 0, color: 'var(--cl-text-muted)', fontSize: 'var(--cf-body)', lineHeight: 1.6 }}>
          휴대폰 번호로 시작합니다.<br />별도 가입 절차는 없습니다.
        </p>
        <LoginForm />
      </div>
    </div>
  );
}
