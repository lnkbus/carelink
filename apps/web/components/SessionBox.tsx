'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

/**
 * 지금 누구로 로그인했는지 + 로그아웃.
 *
 * 계정을 바꿔 가며 화면을 확인할 때 이게 없으면 브라우저 저장소를 손으로
 * 뒤져야 합니다. 운영에서도 필요합니다 — 공용 PC에서 로그아웃 수단이 없으면
 * 다음 사람이 남의 세션으로 후보자 실명을 봅니다.
 *
 * 번호를 함께 띄우는 이유: 운영자·기관 담당자 계정이 여러 개인 환경에서
 * '로그아웃' 버튼만 있으면 지금 누구인지 알 수 없습니다.
 */
export function SessionBox({ phone }: { phone?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function logout() {
    setBusy(true);
    try {
      // 실패해도 로그인 화면으로 보냅니다. 쿠키 삭제는 라우트 핸들러가
      // 어떤 경우에도 수행하므로, 여기서 멈추면 화면만 잠깁니다.
      await fetch('/api/session', { method: 'DELETE' }).catch(() => undefined);
      router.push('/login');
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ marginTop: 'var(--cl-s4)' }}>
      {phone && (
        <p
          style={{
            margin: '0 0 var(--cl-s2)', fontSize: 'var(--cl-micro)',
            color: 'var(--cl-text-muted)', fontFamily: 'var(--cl-font-mono)',
          }}
        >
          {phone}
        </p>
      )}
      <button
        onClick={logout}
        disabled={busy}
        style={{
          width: '100%', height: 36, borderRadius: 'var(--cl-r-desk)',
          border: '1px solid var(--cl-line-strong)', background: 'var(--cl-bg)',
          color: 'var(--cl-text-sub)', fontSize: 'var(--cl-caption)', cursor: 'pointer',
        }}
      >
        {busy ? '로그아웃 중…' : '로그아웃'}
      </button>
    </div>
  );
}

/**
 * 사이드바가 없는 화면(권한 없음 안내)에서 쓰는 로그아웃.
 *
 * 이 화면에 갇힌 사람이 가장 먼저 하고 싶은 일은 **다른 계정으로 들어가
 * 보는 것**입니다. 수단이 없으면 브라우저 저장소를 뒤지게 됩니다.
 */
export function LogoutLink() {
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
        height: 44, padding: '0 var(--cl-s6)', borderRadius: 'var(--cl-r-desk)',
        border: '1px solid var(--cl-line-strong)', background: 'var(--cl-bg)',
        color: 'var(--cl-text-sub)', fontSize: 'var(--cl-body)', cursor: 'pointer',
      }}
    >
      {busy ? '로그아웃 중…' : '다른 계정으로 로그인'}
    </button>
  );
}
