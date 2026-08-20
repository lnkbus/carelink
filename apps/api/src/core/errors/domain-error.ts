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

  // ── engagement ─────────────────────────────────────────────────────────
  ENGAGEMENT_COMPLIANCE_INCOMPLETE: { status: HttpStatus.FORBIDDEN, message: 'Compliance checks are not all PASS' },
  ENGAGEMENT_MODEL_IMMUTABLE: { status: HttpStatus.CONFLICT,     message: 'Employment model cannot be updated; end this engagement and create a new one' },
  ENGAGEMENT_PAYOUT_UNAVAILABLE:{ status: HttpStatus.NOT_IMPLEMENTED, message: 'Payout calculation is blocked pending labour-law review (docs/12 U1/U2)' },

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
