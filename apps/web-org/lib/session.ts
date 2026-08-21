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
