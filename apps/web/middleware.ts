import { NextResponse, type NextRequest } from 'next/server';

/**
 * 구역 문지기 — `/admin`은 운영자, `/org`는 기관 담당자.
 *
 * 왜 layout이 아니라 middleware인가: Next는 layout과 page를 **동시에** 렌더합니다.
 * layout에 두면 페이지가 먼저 API 403을 만나 `/login?reason=forbidden`으로
 * 튕기는 일이 생기고, 그러면 세션이 멀쩡한 사람이 로그인 화면을 다시 봅니다.
 * middleware는 렌더 이전에 돌기 때문에 경합이 없습니다.
 *
 * **이것은 보안 경계가 아닙니다.** 토큰 서명을 검증하지 않고 payload만 읽습니다
 * (Edge 런타임에서 검증하려면 JWT_SECRET을 이 프로세스에 둬야 하고, 그러면
 * 비밀이 하나 더 늘어납니다). 실제 권한 판정은 API가 검증된 토큰으로 합니다 —
 * 여기서 하는 일은 **어느 문으로 보낼지**를 정하는 것뿐이라, 위조된 토큰으로
 * `/admin`을 열어도 화면에 채울 데이터를 한 줄도 받지 못합니다.
 */
const ADMIN = ['ADMIN', 'SUPER_ADMIN'];
const ORG = ['ORG_MEMBER', 'ORG_ADMIN'];

/** 서명 검증 없이 payload만. 실패하면 '역할 없음'으로 취급합니다. */
function rolesOf(token: string | undefined): string[] {
  if (!token) return [];
  try {
    const part = token.split('.')[1];
    if (!part) return [];
    const json = atob(part.replace(/-/g, '+').replace(/_/g, '/'));
    const payload = JSON.parse(json) as { roles?: string[] };
    return Array.isArray(payload.roles) ? payload.roles : [];
  } catch {
    return [];
  }
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const roles = rolesOf(req.cookies.get('cl_at')?.value);

  const isAdmin = roles.some((r) => ADMIN.includes(r));
  const isOrg = roles.some((r) => ORG.includes(r));

  // 세션이 없으면 로그인. 토큰이 만료된 경우도 여기로 옵니다 —
  // payload는 읽히지만 API가 401을 주므로 페이지가 다시 보냅니다.
  if (roles.length === 0) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';
    return NextResponse.redirect(url);
  }

  const wants = pathname.startsWith('/admin') ? 'admin' : 'org';
  if ((wants === 'admin' && isAdmin) || (wants === 'org' && isOrg)) return NextResponse.next();

  // 문만 틀린 경우입니다. 로그인 화면으로 보내지 않습니다 —
  // 세션은 멀쩡하고, 다시 로그인해도 결과가 같습니다.
  const url = req.nextUrl.clone();
  url.pathname = isAdmin ? '/admin' : isOrg ? '/org' : '/no-access';
  url.search = '';
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/admin/:path*', '/org/:path*'],
};
