'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

/**
 * 로그아웃.
 *
 * 보호자 화면에는 메뉴가 없습니다 (Page 주석 참고). 그래서 홈 앱바 오른쪽에만
 * 둡니다 — 하위 화면마다 두면 급한 상황에서 뒤로가기 대신 눌립니다.
 *
 * 터치 타깃 48px을 지킵니다. 고령 사용자가 한 손으로 쓰는 화면입니다.
 */
export function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  return (
    <button
      onClick={async () => {
        setBusy(true);
        await fetch('/api/session', { method: 'DELETE' }).catch(() => undefined);
        router.push('/login');
        router.refresh();
      }}
      disabled={busy}
      style={{
        marginLeft: 'auto', minHeight: 'var(--cf-tap)', padding: '0 var(--cl-s4)',
        background: 'none', border: 'none', color: 'var(--cl-text-sub)',
        fontSize: 'var(--cf-caption)', cursor: 'pointer',
      }}
    >
      {busy ? '…' : '로그아웃'}
    </button>
  );
}
