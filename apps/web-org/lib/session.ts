import { redirect } from 'next/navigation';
import type { Organization } from '@carelink/shared-types';
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
      if (e.status === 401) redirect('/login');
      if (e.status === 403 || e.body.code === 'ORG_NOT_FOUND') redirect('/no-access');
    }
    throw e;
  }
}
