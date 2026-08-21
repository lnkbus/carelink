import type { Me } from '@carelink/shared-types';
import { apiGet } from './api';

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
