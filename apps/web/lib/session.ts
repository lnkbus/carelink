import { redirect } from 'next/navigation';
import type { Me, Organization, UserRole } from '@carelink/shared-types';
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
 * 로그인 직후 어디로 보낼지 — **역할이 결정합니다.**
 *
 * 콘솔을 두 개로 나눠 두었을 때는 주소가 곧 역할이었습니다. 하나로 합치면
 * 그 단서가 사라지므로, 서버가 역할을 보고 랜딩을 고릅니다. 사용자는
 * 'carelink.kr'만 기억하면 됩니다.
 *
 * 운영자와 기관 소속을 겸하는 계정이 있을 수 있어 순서를 둡니다 —
 * 운영자 권한이 있으면 운영 콘솔이 우선입니다.
 */
export const ADMIN_ROLES: UserRole[] = ['ADMIN', 'SUPER_ADMIN'];
export const ORG_ROLES: UserRole[] = ['ORG_MEMBER', 'ORG_ADMIN'];

export function landingFor(me: Me | null): string {
  // 승인되지 않은 소속은 역할이 아닙니다 — 신청만 해 둔 계정이 기관 화면에
  // 들어가면 남의 채용 요청을 보게 됩니다.
  const roles = (me?.roles ?? []).filter((r) => r.approved).map((r) => r.role);
  if (roles.some((r) => ADMIN_ROLES.includes(r))) return '/admin';
  if (roles.some((r) => ORG_ROLES.includes(r))) return '/org';
  return '/no-access';
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
 * 현재 기관.
 *
 * 기관 화면이 전부 이걸 먼저 부릅니다. 검증 상태가 화면마다 다르게 보이면 안 되고,
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
 * 운영 콘솔 사이드바 배지 — 처리해야 할 건수.
 *
 * 시안의 사이드바는 항목 옆에 숫자를 답니다 (매칭 센터 `18`, 사건 · 문의 `4`).
 * 운영자는 하루에 수십 번 이 사이드바를 훑고, **어디에 일이 쌓였는지**를
 * 거기서 판단합니다. 숫자가 없으면 화면을 하나씩 열어 봐야 합니다.
 *
 * 실패하면 0으로 둡니다 — 배지 하나 때문에 콘솔 전체가 죽으면 안 됩니다.
 */
export async function adminBadges(): Promise<{ matching: number; tickets: number }> {
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

/**
 * 기관 웹 사이드바 배지 — 손대야 할 건수.
 *
 * 시안(SCR-201)의 사이드바는 '채용 요청 3', '면접 관리 5'처럼 숫자를 답니다.
 * 담당자가 로그인해서 가장 먼저 보는 것이 사이드바이고, 숫자가 없으면
 * 화면을 하나씩 열어 확인해야 합니다.
 */
export async function orgBadges(): Promise<{ jobs: number; interviews: number }> {
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
