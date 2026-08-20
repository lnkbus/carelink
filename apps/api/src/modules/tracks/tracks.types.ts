/** docs/06 §9.2 · 스키마 track_visa_eligibility.eligibility */
export type VisaEligibility =
  | 'ALLOWED'
  | 'REQUIRES_QUALIFICATION'
  | 'REQUIRES_CONVERSION'
  | 'PENDING_CONFIRMATION'
  | 'NOT_ALLOWED';

/**
 * 매칭 하드 필터에서 후보를 제외해야 하는 값 (docs/02 §7.2 · docs/06 §9.1).
 * PENDING_CONFIRMATION은 목록에서 빼는 것이 아니라 자동 배정만 막고
 * 운영자 검토 큐로 보낸다 (CLAUDE.md §5.9).
 */
export const VISA_EXCLUDES_FROM_MATCHING: readonly VisaEligibility[] = ['NOT_ALLOWED'];
export const VISA_BLOCKS_AUTO_ASSIGNMENT: readonly VisaEligibility[] = ['PENDING_CONFIRMATION', 'NOT_ALLOWED'];
