import { redirect } from 'next/navigation';
import type { Me } from '@carelink/shared-types';
import { ApiError, apiGet } from './api';

/**
 * 지금 로그인한 사용자. 실패해도 화면을 막지 않습니다 —
 * 이 값은 사이드바에 번호를 띄우는 용도뿐이고, 여기서 예외가 나면
 * 멀쩡한 화면이 통째로 죽습니다. 권한 판정은 각 API가 합니다.
 */
export async function currentUser(): Promise<Me | null> {
  try {
    return await apiGet<Me>('/auth/me');
  } catch {
    return null;
  }
}

/**
 * 권한이 없을 때 로그인 화면으로 보낸다 — **이유를 들려서.**
 *
 * 종전에는 그냥 `/login`으로 보냈다. 그러면 로그인에 성공한 사람이
 * 아무 말 없이 로그인 화면으로 되돌아오고, 무엇이 잘못됐는지 알 방법이
 * 없다. 실제로 그 상태에서 하루를 썼다 — 원인은 계정에 역할이 없었던
 * 것이었고, 화면은 끝까지 아무 말도 하지 않았다.
 */
export function redirectToLogin(e: unknown): never {
  const reason = e instanceof ApiError && e.status === 403 ? 'forbidden' : 'expired';
  redirect(`/login?reason=${reason}`);
}

/**
 * 사이드바 배지 — 처리해야 할 건수.
 *
 * 시안의 사이드바는 항목 옆에 숫자를 답니다 (매칭 센터 `18`, 사건 · 문의 `4`).
 * 운영자는 하루에 수십 번 이 사이드바를 훑고, **어디에 일이 쌓였는지**를
 * 거기서 판단합니다. 숫자가 없으면 화면을 하나씩 열어 봐야 합니다.
 *
 * 실패하면 0으로 둡니다 — 배지 하나 때문에 콘솔 전체가 죽으면 안 됩니다.
 */
export async function navBadges(): Promise<{ matching: number; tickets: number }> {
  const [matching, tickets] = await Promise.all([
    // 매칭 센터에서 손대야 하는 건 = 상태 변경 후 무응답으로 멈춰 있는 지원.
    // 이게 밀리면 지원자가 '연락이 없다'며 이탈합니다 (CLAUDE.md §7).
    apiGet<{ todayQueue?: { kind: string }[] }>('/admin/metrics')
      .then((m) => (m.todayQueue ?? []).filter((q) => q.kind === 'APPLICATION_STALE').length)
      .catch(() => 0),
    apiGet<{ status: string }[]>('/admin/support-tickets', { status: 'OPEN' })
      .then((t) => t.length)
      .catch(() => 0),
  ]);
  return { matching, tickets };
}
