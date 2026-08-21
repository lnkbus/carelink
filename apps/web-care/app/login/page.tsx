import { LoginForm } from './LoginForm';

/**
 * SCR-002 로그인 — 휴대폰 OTP만 (README §4-2 S1 확정).
 *
 * 보호자는 앱을 설치하지 않고 병원에서 급하게 링크로 들어옵니다 (SCR-301 notes).
 * 그래서 가입 절차를 따로 두지 않았습니다 — 번호 인증이 곧 가입입니다.
 */
export default function LoginPage({ searchParams }: { searchParams: { reason?: string } }) {
  return (
    <div className="cf-page">
      <div className="cf-body" style={{ justifyContent: 'center' }}>
        <div style={{ letterSpacing: '.28em', fontWeight: 700, fontSize: 'var(--cf-subtitle)' }}>CARELINK</div>
        <p style={{ margin: 0, color: 'var(--cl-text-muted)', fontSize: 'var(--cf-body)', lineHeight: 1.6 }}>
          휴대폰 번호로 시작합니다.<br />별도 가입 절차는 없습니다.
        </p>
        {/* 왜 돌아왔는지 말합니다. 아무 말 없이 되돌리면 방금 로그인한
            사람이 무엇이 잘못됐는지 알 수 없습니다. */}
        {searchParams.reason === 'expired' && (
          <div className="cf-note">로그인이 만료됐습니다. 다시 로그인해 주세요.</div>
        )}
        {searchParams.reason === 'forbidden' && (
          <div className="cf-note">
            로그인은 됐지만 이 화면을 볼 권한이 없는 계정입니다.
            간병을 신청하신 번호가 맞는지 확인해 주세요.
          </div>
        )}
        <LoginForm />
      </div>
    </div>
  );
}
