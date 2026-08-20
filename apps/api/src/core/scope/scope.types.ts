/**
 * 데이터 노출 범위. docs/02 §5.2 / docs/11 §3.1.
 *
 * 같은 후보자 레코드라도 보는 주체에 따라 필드가 달라진다.
 * 컨트롤러 if 문으로 처리하면 반드시 새는 곳이 생기므로 직렬화 단계에서 자른다.
 */
export type ScopeName =
  | 'self'       // 본인
  | 'admin'      // 플랫폼 운영자
  | 'org'        // 기관 — 검증 완료 + 면접 수락 이후
  | 'org_masked' // 기관 — 그 전. display_code만
  | 'caregiver'  // 간병사 — 환자 실명·진단명 비노출
  | 'partner';   // 교육·인력 파트너 — 담당 후보자의 교육 이력만

/** 요청자의 신원과 그 요청에서 허용된 scope 집합. */
export interface Viewer {
  userId: string | null;
  roles: string[];
  scopes: ScopeName[];
  /** ORG_MEMBER인 경우 소속 기관. org scope 판정에 쓴다. */
  organizationId?: string | null;
  locale: string;
}

export const ANONYMOUS: Viewer = { userId: null, roles: [], scopes: [], locale: 'ko' };
