import { redirect } from 'next/navigation';
import type { Me, Organization } from '@carelink/shared-types';
import { ApiError, apiGet } from './api';

/**
 * 현재 기관.
 *
 * 모든 화면이 이걸 먼저 부릅니다. 검증 상태가 화면마다 다르게 보이면 안 되고,
 * 소속 승인이 없는 사용자는 아무 화면도 열면 안 되기 때문입니다.
 */
export async function currentOrg(): Promise<Organization> {
  try {
    return await apiGet<Organization>('/organizations/me');
  } catch (e) {
    if (e instanceof ApiError) {
      if (e.status === 401) redirect('/login?reason=expired');
      if (e.status === 403 || e.body.code === 'ORG_NOT_FOUND') redirect('/no-access');
    }
    throw e;
  }
}

/**
 * 지금 로그인한 사용자. 실패해도 화면을 막지 않습니다 — 사이드바에 번호를
 * 띄우는 용도뿐이고, 여기서 예외가 나면 멀쩡한 화면이 통째로 죽습니다.
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
 * 아무 말 없이 되돌려 보내면 로그인에 성공한 사람이 무엇이 잘못됐는지
 * 알 방법이 없다.
 */
export function redirectToLogin(e: unknown): never {
  const reason = e instanceof ApiError && e.status === 403 ? 'forbidden' : 'expired';
  redirect(`/login?reason=${reason}`);
}

/**
 * 사이드바 배지 — 손대야 할 건수.
 *
 * 시안(SCR-201)의 사이드바는 '채용 요청 3', '면접 관리 5'처럼 숫자를 답니다.
 * 담당자가 로그인해서 가장 먼저 보는 것이 사이드바이고, 숫자가 없으면
 * 화면을 하나씩 열어 확인해야 합니다.
 *
 * 실패하면 0으로 둡니다 — 배지 하나 때문에 화면 전체가 죽으면 안 됩니다.
 */
export async function navBadges(): Promise<{ jobs: number; interviews: number }> {
  const [jobs, interviews] = await Promise.all([
    apiGet<{ items: { status: string }[] }>('/jobs', { size: 100 })
      .then((p) => p.items.filter((j) => j.status === 'OPEN').length)
      .catch(() => 0),
    // 수락 대기 = 후보자의 응답을 기다리는 건. 기관이 대신 확정할 수 없습니다.
    apiGet<{ status: string }[]>('/interviews')
      .then((r) => r.filter((i) => i.status === 'REQUESTED').length)
      .catch(() => 0),
  ]);
  return { jobs, interviews };
}
