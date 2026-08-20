/**
 * 감사 로그. docs/02 §13 / docs/11 §5.
 * 개인정보 조회·상태 변경·정산·다운로드는 전량 적재한다.
 */
export interface AuditEntry {
  actorUserId: string | null;
  action: string;              // 'candidate.view' · 'application.transition' 등
  targetType: string;          // 'candidate' · 'engagement'
  targetId: string | null;
  /** 상태 전이면 before/after를 남긴다. 분쟁 시 유일한 근거가 된다. */
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  ip?: string | null;
  userAgent?: string | null;
}
