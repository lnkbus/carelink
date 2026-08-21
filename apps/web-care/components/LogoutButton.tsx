'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

/**
 * 로그아웃.
 *
 * **'내 정보' 화면 맨 아래에만 둡니다.** 앱바나 홈에 두면 급한 상황에서
 * 뒤로가기 대신 눌리고, 그러면 다시 들어오려고 인증번호를 기다리게 됩니다.
 * 세 FIELD 앱이 같은 규칙을 씁니다.
 */
export function LogoutButton() {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!confirming) {
    return (
      <button type="button" className="cf-btn cf-btn-ghost" onClick={() => setConfirming(true)}>
        로그아웃
      </button>
    );
  }

  return (
    <div className="cf-note">
      <p style={{ margin: '0 0 var(--cl-s4)', fontSize: 'var(--cf-body)' }}>
        로그아웃할까요? 다시 로그인하려면 인증번호가 필요합니다.
      </p>
      <div style={{ display: 'flex', gap: 'var(--cl-s3)' }}>
        <button type="button" className="cf-btn cf-btn-ghost" onClick={() => setConfirming(false)}>
          취소
        </button>
        <button
          type="button"
          className="cf-btn"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            // 실패해도 로그인 화면으로 보냅니다. 쿠키 삭제는 라우트 핸들러가
            // 어떤 경우에도 수행하므로, 여기서 멈추면 화면만 잠깁니다.
            await fetch('/api/session', { method: 'DELETE' }).catch(() => undefined);
            router.push('/login');
            router.refresh();
          }}
        >
          {busy ? '…' : '로그아웃'}
        </button>
      </div>
    </div>
  );
}
