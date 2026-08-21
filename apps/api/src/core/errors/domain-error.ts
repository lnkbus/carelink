import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * 도메인 에러 코드. docs/02 §9.1 — 에러는 { code, message, details? } 형태로 반환하고
 * code는 TALENT_DOC_EXPIRED 같은 도메인 코드를 쓴다.
 *
 * 백엔드는 코드만 반환하고 문구는 클라이언트가 번역한다 (docs/02 §10).
 * 여기 message는 개발자용 설명이며 사용자에게 그대로 노출하지 않는다.
 */
export const DOMAIN_ERRORS = {
  // ── iam ────────────────────────────────────────────────────────────────
  IAM_OTP_INVALID:            { status: HttpStatus.BAD_REQUEST,  message: 'OTP code does not match or has expired' },
  IAM_OTP_TOO_MANY_ATTEMPTS:  { status: HttpStatus.TOO_MANY_REQUESTS, message: 'OTP verification attempted too many times' },
  IAM_OTP_RATE_LIMITED:       { status: HttpStatus.TOO_MANY_REQUESTS, message: 'OTP requested too frequently for this phone number' },
  IAM_TOKEN_INVALID:          { status: HttpStatus.UNAUTHORIZED, message: 'Access or refresh token is invalid' },
  IAM_TOKEN_EXPIRED:          { status: HttpStatus.UNAUTHORIZED, message: 'Token has expired' },
  IAM_ROLE_FORBIDDEN:         { status: HttpStatus.FORBIDDEN,    message: 'Role does not permit this operation' },
  IAM_ROLE_ALREADY_HELD:      { status: HttpStatus.CONFLICT,     message: 'User already holds this role' },
  IAM_CONSENT_REQUIRED:       { status: HttpStatus.FORBIDDEN,    message: 'A required consent has not been granted' },
  IAM_USER_SUSPENDED:         { status: HttpStatus.FORBIDDEN,    message: 'User account is suspended' },

  // ── talent ─────────────────────────────────────────────────────────────
  TALENT_CANDIDATE_NOT_FOUND: { status: HttpStatus.NOT_FOUND,    message: 'Candidate does not exist' },
  TALENT_DOC_EXPIRED:         { status: HttpStatus.CONFLICT,     message: 'Document has expired' },
  TALENT_DOC_NOT_VERIFIED:    { status: HttpStatus.CONFLICT,     message: 'Document is not verified yet' },
  TALENT_VISA_EXPIRED:        { status: HttpStatus.CONFLICT,     message: 'Residency status has expired' },
  TALENT_TRACK_NOT_ACTIVE:    { status: HttpStatus.BAD_REQUEST,  message: 'Track is not active' },
  TALENT_DOC_VERDICT_REQUIRED:{ status: HttpStatus.BAD_REQUEST,  message: 'A verdict is required before the original is purged' },
  TALENT_DOC_ORIGINAL_PURGED: { status: HttpStatus.GONE,         message: 'Original file was purged after review; only the verdict is retained' },
  TALENT_VISA_STEP_NOT_APPLICABLE: { status: HttpStatus.CONFLICT, message: 'This visa-process step does not apply to the candidate' },
  TALENT_PRIMARY_TRACK_EXISTS:{ status: HttpStatus.CONFLICT,     message: 'Candidate already has a primary track' },

  // ── org ────────────────────────────────────────────────────────────────
  ORG_NOT_FOUND:              { status: HttpStatus.NOT_FOUND,    message: 'Organization does not exist' },
  ORG_NOT_VERIFIED:           { status: HttpStatus.FORBIDDEN,    message: 'Organization is not verified; candidate PII is gated behind verification' },
  ORG_E7_SPONSOR_INELIGIBLE:  { status: HttpStatus.FORBIDDEN,    message: 'Organization is not an eligible E-7-2 sponsor' },

  // ── matching ───────────────────────────────────────────────────────────
  MATCHING_JOB_NOT_OPEN:      { status: HttpStatus.CONFLICT,     message: 'Job is not open for applications' },
  MATCHING_ALREADY_APPLIED:   { status: HttpStatus.CONFLICT,     message: 'Candidate has already applied to this job' },
  MATCHING_NOT_ELIGIBLE:      { status: HttpStatus.FORBIDDEN,    message: 'Candidate is excluded by a hard filter' },

  // ── quality ────────────────────────────────────────────────────────────
  QUALITY_CLEARANCE_INCOMPLETE:{ status: HttpStatus.FORBIDDEN,   message: 'Not all six worker clearances are PASS' },
  QUALITY_CLEARANCE_EXPIRED:  { status: HttpStatus.FORBIDDEN,    message: 'A worker clearance has expired' },
  QUALITY_RESTRICTED_ACT:     { status: HttpStatus.CONFLICT,     message: 'Text contains a restricted medical act; routed to OPS_REVIEW' },
  QUALITY_SHIFT_NEEDS_APPROVAL:{ status: HttpStatus.FORBIDDEN,   message: 'Shift pattern requires operator approval' },

  // ── recruiting ─────────────────────────────────────────────────────────
  RECRUITING_CHANNEL_UNKNOWN: { status: HttpStatus.NOT_FOUND,    message: 'Recruiting channel code does not exist' },
  RECRUITING_CAMPAIGN_MISMATCH:{ status: HttpStatus.CONFLICT,    message: 'Campaign does not belong to the given channel' },
  RECRUITING_REFERRER_UNKNOWN:{ status: HttpStatus.NOT_FOUND,    message: 'Referral code does not match any candidate' },
  RECRUITING_SELF_REFERRAL:   { status: HttpStatus.CONFLICT,     message: 'A candidate cannot refer themselves' },
  RECRUITING_ATTRIBUTION_LOCKED:{ status: HttpStatus.CONFLICT,   message: 'Acquisition source is already recorded and cannot be overwritten' },

  // ── engagement ─────────────────────────────────────────────────────────
  ENGAGEMENT_COMPLIANCE_INCOMPLETE: { status: HttpStatus.FORBIDDEN, message: 'Compliance checks are not all PASS' },
  ENGAGEMENT_MODEL_IMMUTABLE: { status: HttpStatus.CONFLICT,     message: 'Employment model cannot be updated; end this engagement and create a new one' },
  ENGAGEMENT_DISPATCH_LIMIT: { status: HttpStatus.FORBIDDEN, message: 'Dispatch to this organization would exceed the 2-year statutory limit' },
  ENGAGEMENT_DISPATCH_PERMIT_MISSING: { status: HttpStatus.FORBIDDEN, message: 'A dispatch permit number is required for dispatch engagements' },
  ENGAGEMENT_WORK_RECORD_INCOMPLETE: { status: HttpStatus.CONFLICT, message: 'The assignment has no start/end pair yet' },
  ENGAGEMENT_WORK_RECORD_NO_ENGAGEMENT: { status: HttpStatus.CONFLICT, message: 'No active engagement to attribute this work to' },
  ENGAGEMENT_PAYOUT_UNAVAILABLE:{ status: HttpStatus.NOT_IMPLEMENTED, message: 'Payout calculation is blocked pending labour-law review (docs/12 U1/U2)' },

  // ── care ───────────────────────────────────────────────────────────────
  CARE_UNKNOWN_SERVICE_ITEM: { status: HttpStatus.BAD_REQUEST, message: 'Service item is not in the catalog' },
  CARE_SLA_BREACHED:        { status: HttpStatus.CONFLICT,     message: 'Care request exceeded the assignment SLA' },
  CARE_QR_TOKEN_REQUIRED:   { status: HttpStatus.BAD_REQUEST,  message: 'QR check-in requires the room token' },
  CARE_QR_TOKEN_MISMATCH:   { status: HttpStatus.FORBIDDEN,    message: 'This QR code belongs to a different room' },
  CARE_LOG_IMMUTABLE:       { status: HttpStatus.FORBIDDEN,    message: 'Service logs are append-only; corrections must be new rows' },
  CARE_LOG_TIME_FORBIDDEN:  { status: HttpStatus.FORBIDDEN,    message: 'Only an operator may restate the time of a logged event, and only as a correction' },
  CARE_LOG_TIME_INVALID:    { status: HttpStatus.BAD_REQUEST,  message: 'A logged event cannot have occurred in the future' },
  QUALITY_SHIFT_NOT_ALLOWED_FOR_WORKER: { status: HttpStatus.FORBIDDEN, message: 'This shift pattern cannot be assigned to this worker' },

  // ── 공통 ───────────────────────────────────────────────────────────────
  COMMON_INVALID_TRANSITION:  { status: HttpStatus.CONFLICT,     message: 'State transition is not allowed' },
  COMMON_APPEND_ONLY:         { status: HttpStatus.FORBIDDEN,    message: 'Table is append-only; corrections must be new rows' },
  COMMON_NOT_FOUND:           { status: HttpStatus.NOT_FOUND,    message: 'Resource does not exist' },
} as const;

export type DomainErrorCode = keyof typeof DOMAIN_ERRORS;

export class DomainError extends HttpException {
  constructor(
    public readonly code: DomainErrorCode,
    public readonly details?: Record<string, unknown>,
  ) {
    const spec = DOMAIN_ERRORS[code];
    super({ code, message: spec.message, ...(details ? { details } : {}) }, spec.status);
  }
}
