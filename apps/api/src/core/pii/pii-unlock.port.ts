/**
 * 후보자 개인정보 공개 게이트.
 *
 * 기관이 후보자의 실명·연락처를 보려면 두 조건이 모두 참이어야 한다:
 *   1) 기관이 검증 완료(`verification_status = VERIFIED`)  — §6-6
 *   2) 후보자가 그 기관의 면접 요청을 수락            — §5.2 · docs/02 §5.2
 *
 * 이 게이트가 뚫리면 플랫폼을 우회한 직거래가 발생하고 수익모델이 무너진다.
 *
 * ── 왜 인터페이스인가 ──────────────────────────────────────────────────
 * 판정 근거(`interviews`·`applications`)는 matching이 소유하고, 판정이 필요한
 * 곳(후보자 프로필 직렬화)은 talent에 있다. talent가 matching의 테이블을 직접
 * 읽으면 §5.1 위반이고, talent가 matching을 import 하면 순환이 된다
 * (matching은 이미 talent.getCandidatesForMatching을 쓴다).
 *
 * 그래서 talent는 자기가 소유한 이 인터페이스에만 의존하고, 구현은 matching이
 * 제공한다. 의존 방향이 뒤집혀 순환이 사라진다.
 */
export const PII_UNLOCK = Symbol('PII_UNLOCK');

export interface PiiUnlockPort {
  /** 이 기관에게 이 후보자의 실명·연락처가 열려 있는가. */
  isCandidateUnlockedForOrg(candidateId: string, organizationId: string): Promise<boolean>;

  /** 목록용. 후보자 수만큼 쿼리를 돌리지 않기 위해 한 번에 묻는다. */
  unlockedCandidateIds(organizationId: string, candidateIds: string[]): Promise<Set<string>>;
}

/**
 * 배선이 끊겼을 때의 기본값.
 *
 * **전부 잠근다.** 구현이 주입되지 않았는데 열어 두면 배선 실수 한 번에
 * 전 기관이 전 후보자의 실명을 보게 된다. 닫히는 쪽으로 실패해야 한다.
 */
export class DenyAllPiiUnlock implements PiiUnlockPort {
  async isCandidateUnlockedForOrg(): Promise<boolean> { return false; }
  async unlockedCandidateIds(): Promise<Set<string>> { return new Set(); }
}
