/**
 * 백그라운드 잡. CLAUDE.md §7 10종 + docs/07 §7의 shift-24h-review = 11종.
 *
 * 각 잡은 "없으면 생기는 일"이 문서에 적혀 있다. 주기를 바꾸려면 문서를 먼저 고칠 것.
 */
export const QUEUE_NAME = 'carelink';

export const JOBS = {
  /** 매일 — 만료 30일 전 서류 알림. 없으면 배치 중인 인력의 자격이 조용히 무효화된다. */
  DOCUMENT_EXPIRY_WARNING: { name: 'document-expiry-warning', cron: '0 9 * * *', warnDays: 30 },
  /** 매일 — expires_at 도달 시 EXPIRED 전이. 없으면 만료 서류로 매칭이 나간다. */
  DOCUMENT_EXPIRE: { name: 'document-expire', cron: '10 0 * * *' },
  /**
   * 매일 — 체류기간 만료 60일/30일 전 알림. 배치 중 인력 우선.
   * 서류가 만료되면 자격이 무효가 되지만, 체류자격이 만료되면 불법 취업이 된다 (§5.9).
   */
  VISA_EXPIRY_WARNING: { name: 'visa-expiry-warning', cron: '20 9 * * *', warnDays: [60, 30] },
  /** 매시 — 상태 변경 후 7일 무응답 → 운영자 태스크. */
  APPLICATION_NO_RESPONSE: { name: 'application-no-response', cron: '0 * * * *', days: 7 },
  /** 매일 — 클리어런스 만료 30일 전 알림. */
  CLEARANCE_EXPIRY_WARNING: { name: 'clearance-expiry-warning', cron: '30 9 * * *', warnDays: 30 },
  /** 매일 — 클리어런스 만료 시 EXPIRED 전이 + 신규 배정 차단. */
  CLEARANCE_EXPIRE: { name: 'clearance-expire', cron: '40 0 * * *' },
  /** 요청 생성 시 — 자유 입력 스캔. 감지 시 OPS_REVIEW (자동 거절이 아니다). */
  SCOPE_KEYWORD_SCAN: { name: 'scope-keyword-scan', cron: null },
  /** 매일 — data_retention_policies 기준 자동 파기. 수동 파기 정책은 지켜지지 않는다. */
  DATA_RETENTION_PURGE: { name: 'data-retention-purge', cron: '0 3 * * *' },
  /** 매 10분 — 간병 요청 후 4시간 미배정 → ISSUE. */
  CARE_ASSIGNMENT_SLA: { name: 'care-assignment-sla', cron: '*/10 * * * *', slaHours: 4 },
  /** 매 10분 — 안전사고·부당대우·업무범위 초과 4시간 초과. */
  TICKET_SLA: { name: 'ticket-sla', cron: '*/10 * * * *', slaHours: 4 },
  /** 매일 — H24_LIVE_IN 배정 현황 리포트 (docs/07 §7). */
  SHIFT_24H_REVIEW: { name: 'shift-24h-review', cron: '0 8 * * *' },
} as const;

export type JobName = (typeof JOBS)[keyof typeof JOBS]['name'];
