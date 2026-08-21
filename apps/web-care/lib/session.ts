import { redirect } from 'next/navigation';
import { ApiError, apiGet } from './api';

export interface Me {
  id: string;
  roles: { role: string; isPrimary: boolean }[];
}

/**
 * 현재 사용자.
 *
 * 보호자 화면은 전부 본인 데이터만 봅니다. `self`는 역할이 아니라 **관계**라서
 * (요청의 `requester_id` === 나), 화면에서 걸러 내는 것이 아니라 API가
 * 직렬화 단계에서 자릅니다. 여기서는 로그인 여부만 확인합니다.
 */
export async function currentUser(): Promise<Me> {
  try {
    return await apiGet<Me>('/auth/me');
  } catch (e) {
    if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
      // 이유를 들려 보냅니다. 아무 말 없이 로그인 화면으로 되돌리면
      // 방금 로그인한 사람이 무엇이 잘못됐는지 알 수 없습니다.
      redirect(`/login?reason=${e.status === 403 ? 'forbidden' : 'expired'}`);
    }
    throw e;
  }
}
