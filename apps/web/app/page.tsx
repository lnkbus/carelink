import { redirect } from 'next/navigation';
import { currentUser, landingFor } from '@/lib/session';

/**
 * 루트 — **역할이 목적지를 정합니다.**
 *
 * 운영 콘솔과 기관 웹은 한 서비스입니다. 주소를 나눠 두면 담당자가
 * "우리 주소가 뭐였더라"를 매번 묻고, 잘못 들어간 사람은 로그인 화면에서
 * 막힙니다 — 계정은 멀쩡한데 문이 틀린 것이라 원인을 알 수 없습니다.
 *
 * 여기서 한 번만 갈라 주면 사용자가 기억할 주소는 하나입니다.
 */
export const dynamic = 'force-dynamic';

export default async function RootPage() {
  const me = await currentUser();
  if (!me) redirect('/login');
  redirect(landingFor(me));
}
