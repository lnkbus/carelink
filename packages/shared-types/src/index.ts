/**
 * API 계약 타입.
 *
 * OpenAPI 자동 생성이 아니라 손으로 씁니다. 이유가 있습니다 —
 * 응답 필드는 뷰어의 scope에 따라 **키 자체가 사라집니다**(마스킹이 아니라 삭제,
 * `core/scope/scope.serializer.ts`). 생성된 타입은 모든 필드를 항상 존재하는 것으로
 * 선언하므로, 기관 화면에서 `candidate.name`을 무심코 렌더하는 코드가 타입 검사를
 * 통과해 버립니다. 그 순간 §5.2의 게이트가 타입 층에서 먼저 뚫립니다.
 *
 * 그래서 scope로 가려질 수 있는 필드는 전부 optional입니다. 화면 코드는
 * `name ?? '—'`를 쓰도록 강제됩니다.
 */

// ── 공통 ────────────────────────────────────────────────────────────────────

/** 백엔드는 코드만 반환하고 문구는 클라이언트가 번역한다 (§5.15). */
export interface DomainErrorBody {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
}

export type Locale = 'ko' | 'vi' | 'ru' | 'en';

export type UserRole =
  | 'CANDIDATE' | 'CAREGIVER' | 'PATIENT_GUARDIAN'
  | 'ORG_MEMBER' | 'ORG_ADMIN' | 'PARTNER' | 'ADMIN' | 'SUPER_ADMIN';

// ── iam ─────────────────────────────────────────────────────────────────────

export interface Session {
  accessToken: string;
  refreshToken: string;
  me: { id: string; roles: UserRole[]; primaryRole: UserRole | null; locale: Locale };
}

/** GET /auth/me — 지금 로그인한 사용자. phone은 본인·운영자에게만 나갑니다. */
export interface Me {
  id: string;
  phone?: string | null;
  locale: Locale;
  status: string;
  roles: { role: UserRole; organizationId: string | null; isPrimary: boolean; approved: boolean }[];
  showRoleSwitcher: boolean;
  roleAssignmentState: string;
}

/**
 * 승인 대기 한 건 — 운영자 큐와 기관 관리자 큐가 같은 모양을 씁니다.
 *
 * `businessRegNo`는 운영자에게만 나갑니다. 기관 관리자에게는 자기 기관의
 * 번호라 승인 판단에 보탬이 되지 않습니다.
 */
export interface PendingRoleRequest {
  id: string;
  role: UserRole;
  requestedAt: string;
  phone: string | null;
  organizationId: string | null;
  organizationName: string | null;
  businessRegNo?: string | null;
  verificationStatus: string | null;
  /** 승인하면 이 사람이 그 기관의 관리자가 됩니다 — 첫 담당자입니다. */
  becomesAdmin: boolean;
}

// ── talent ──────────────────────────────────────────────────────────────────

export type CandidateStatus =
  | 'DRAFT' | 'DOC_REVIEW' | 'TRAINING' | 'READY'
  | 'MATCHED' | 'PLACED' | 'INACTIVE' | 'SUSPENDED';

export interface CandidateTrack {
  trackId: string;
  trackCode: string;
  labelKo: string;
  isPrimary: boolean;
  qualificationState: string;
}

export interface Candidate {
  id: string;
  displayCode: string;
  status: CandidateStatus;
  tracks: CandidateTrack[];

  // self · admin · org(면접 수락 후)
  name?: string | null;
  birthDate?: string | null;
  phone?: string | null;

  // self · admin 전용. 기관에는 employable로 치환돼 나간다 (§6-12).
  nationality?: string | null;
  visaStatusCode?: string | null;
  visaExpiresOn?: string | null;
  visaExpiresInDays?: number | null;

  /**
   * 기관용 치환값. **boolean이 아닙니다** — 상태가 셋입니다.
   *
   * `PENDING`(아직 확인 안 됨)을 `NOT_ALLOWED`(취업 불가)와 합치면 화면에
   * '불가'로 나가고, 그걸 본 기관은 그 후보자를 거릅니다. 확인이 안 됐다는
   * 이유로 일자리를 잃는 셈입니다.
   */
  employable?: 'ALLOWED' | 'PENDING' | 'NOT_ALLOWED' | null;
  employabilityReasonKey?: string | null;

  gender?: string | null;
  currentLocation?: string | null;
  preferredRegions?: string[] | null;
  employmentTypes?: string[] | null;
  dormRequired?: boolean;
  availableFrom?: string | null;

  // admin 전용
  assigneeId?: string | null;
  channelId?: string | null;
  campaignId?: string | null;
  referredBy?: string | null;
  tags?: string[] | null;
}

// ── ops (SCR-501) ───────────────────────────────────────────────────────────

export interface TrackMetric {
  trackCode: string;
  trackLabel: string;
  candidates: number;
  ready: number;
  matched: number;
  placed: number;
  openJobs: number;
  applications: number;
  /** 단 하나만 본다면 이 값이다 (docs/01 §11). */
  avgDaysToFill: number | null;
}

export interface QueueItem {
  kind: string;
  targetId: string;
  label: string;
  /** 음수면 SLA 초과 — 화면에 `-2h`로 표기한다. */
  slaHoursLeft: number | null;
}

export interface ChannelInflow {
  channelCode: string;
  labelKo: string;
  candidates: number;
  placed: number;
}

export interface OpsDashboard {
  byTrack: TrackMetric[];
  supplyPipeline: { step: string; count: number }[];
  channelInflow: ChannelInflow[];
  referral: { referred: number; placed: number };
  todayQueue: QueueItem[];
  exclusionBreakdown: { reason: string; count: number }[];
}

export interface BulkResult {
  requested: number;
  succeeded: number;
  /** 실패는 조용히 넘기지 않는다. 건별 사유가 온다. */
  failures: { candidateId: string; code: string; detail?: unknown }[];
}

// ── quality (SCR-509) ───────────────────────────────────────────────────────

export type ClearanceType =
  | 'IDENTITY_VERIFIED' | 'CRIMINAL_RECORD_CLEAR' | 'HEALTH_CHECK'
  | 'VISA_ELIGIBLE' | 'MANDATORY_TRAINING' | 'SCOPE_TRAINING';

export type ClearanceResult = 'PENDING' | 'PASS' | 'FAIL' | 'EXPIRED' | 'N_A';

export interface Clearance {
  id: string;
  workerUserId: string;
  displayCode: string | null;
  clearanceType: ClearanceType;
  result: ClearanceResult;
  expiresOn: string | null;
  checkedAt: string | null;
  note: string | null;
  candidateStatus: string | null;
  /** 음수면 이미 만료. 만료는 날짜가 아니라 카운트다운으로 보여준다. */
  daysToExpiry: number | null;
}

export interface WorkerClearanceSummary {
  workerUserId: string;
  items: {
    clearanceType: ClearanceType;
    result: ClearanceResult;
    /** false면 검사 기록 자체가 없다. PENDING과 구분해서 보여줘야 한다. */
    recorded: boolean;
    expiresOn: string | null;
    id: string | null;
  }[];
  /** 6개 전부 통과해야 true. 운영자가 뒤집을 수 있는 값이 아니다 (§5.11). */
  deployable: boolean;
  missing: ClearanceType[];
  expired: ClearanceType[];
}

export interface ScopeScanResult {
  clean: boolean;
  /** 감지돼도 거절이 아니다. OPS_REVIEW로 보내 사람이 설명한다 (§6-15). */
  action: 'PASS' | 'OPS_REVIEW';
  hits: { keyword: string; category: string; index: number }[];
}

// ── engagement (SCR-508) ────────────────────────────────────────────────────

export type EngagementModel = 'DIRECT_EMPLOYMENT' | 'DELEGATION' | 'BROKERAGE';
export type EngagementStatus =
  | 'DRAFT' | 'CONTRACT_PENDING' | 'ACTIVE' | 'SUSPENDED' | 'ENDED' | 'TERMINATED';

export interface Engagement {
  id: string;
  model: EngagementModel;
  status: EngagementStatus;
  workerUserId: string;
  displayCode?: string | null;
  organizationId: string;
  organizationName?: string | null;
  trackCode?: string | null;
  startedOn: string | null;
  endedOn: string | null;
  endReason: string | null;
  /** 모델 전환은 UPDATE가 아니라 새 행이다. 이 값이 앞 건을 가리킨다 (§5.7). */
  previousEngagementId: string | null;
}

export interface ComplianceCheck {
  checkCode: string;
  result: ClearanceResult;
  /** false면 통과하지 않아도 ACTIVE로 갈 수 있다. */
  blocking?: boolean;
  checkedAt: string | null;
  note: string | null;
}

// ── recruiting (SCR-510 · 511) ──────────────────────────────────────────────

export type CohortStage =
  | 'APPLIED' | 'SELECTED' | 'IN_TRAINING' | 'COMPLETED'
  | 'EXAM_PASSED' | 'PLACED' | 'DROPPED';

export interface ChannelCac {
  channelCode: string;
  labelKo: string;
  cost: number;
  candidates: number;
  placed: number;
  /** 배치 0명이면 null. 0으로 나눈 값보다 '아직 없음'이 정직하다. */
  cac: number | null;
}

export interface ReferralStats {
  candidates: number;
  placed: number;
  referrers: number;
}

export interface Cohort {
  id: string;
  code: string;
  name: string;
  channelCode: string;
  status: string;
  targetSize: number | null;
  startsOn: string | null;
  expectedPlacementOn: string | null;
}

export interface FunnelRow {
  stage: CohortStage;
  /** 그 단계 이상 도달한 누적. 이탈자도 도달한 단계까지는 센다. */
  count: number;
  conversionPct: number;
}

export interface CohortDetail {
  cohort: Cohort;
  funnel: FunnelRow[];
  /** 이 배열이 recruiting 모듈의 존재 이유다 (§5.13). */
  dropAnalysis: { droppedStage: string; dropReason: string | null; count: number }[];
  members: {
    id: string;
    displayCode: string;
    candidateId: string;
    stage: CohortStage;
    joinedAt: string;
    droppedStage: string | null;
    dropReason: string | null;
  }[];
}

export interface Partner {
  id: string;
  partnerType: string;
  name: string;
  region: string | null;
  status: string;
  contactName: string | null;
  contactPhone: string | null;
  mouSignedOn: string | null;
  mouExpiresOn: string | null;
}

// ── org (SCR-503) ───────────────────────────────────────────────────────────

export interface Organization {
  id: string;
  name: string;
  orgType: string;
  region: string | null;
  verificationStatus: string;
  dormitoryProvided: boolean;
  koreanSupportStaff: boolean;
  // admin · 소속 담당자만
  businessRegNo?: string | null;
  address?: string | null;
  contactName?: string | null;
  contactPhone?: string | null;
  e7SponsorStatus?: string | null;
}

// ── matching (SCR-504) ──────────────────────────────────────────────────────

export interface MatchReason {
  ruleCode: string;
  messageKey: string;
  params?: Record<string, unknown>;
  points: number;
  maxPoints: number;
}

/** 점수만 주는 매칭은 기관도 후보자도 신뢰하지 않는다 (§5.6). */
export interface MatchResult {
  candidateId: string;
  displayCode: string;
  score: number;
  reasons: MatchReason[];
  missingRequirements: MatchReason[];
  /** 면접 수락 전에는 키 자체가 없다. 마스킹이 아니라 미포함이다. */
  candidateName?: string | null;
}

export interface MatchExclusion {
  displayCode: string;
  filterCode: string;
  reasonKey: string;
  params: Record<string, unknown>;
  /** BLOCKED_FOR_REVIEW는 목록에는 남지만 자동 배정이 막힌 건이다. */
  severity: 'EXCLUDED' | 'BLOCKED_FOR_REVIEW';
  candidateId?: string;
}

export interface MatchRun {
  jobId: string;
  matched: MatchResult[];
  excluded: MatchExclusion[];
  scanned: number;
  excludedCount: number;
}

export interface Job {
  id: string;
  title: string | null;
  organizationId: string;
  organizationName: string;
  trackCode: string;
  region: string;
  employmentType: string | null;
  startDate: string | null;
  dormProvided: boolean;
  headcount: number;
  status: string;
  minExperienceYrs: number;
  languageLevel: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryVisibility: string;
  /** 충원 인원. 화면은 `2/4`로 씁니다 — 상태만으로는 얼마나 찼는지 모릅니다. */
  filledCount?: number;
}

// ── care (V2) ──────────────────────────────────────────────────────────────
//
// 손으로 씁니다. OpenAPI 생성 타입을 쓰지 않는 이유는 파일 앞머리에 있습니다 —
// scope로 잘린 필드는 **키 자체가 사라지므로**, 생성 타입에서는 보호자 화면에서
// `caregiver.name`이 타입 검사를 통과해 버립니다.

export interface CareHospital {
  id: string;
  name: string;
  region: string | null;
  /** 이 병원에 배정 가능한 간병사 수. 0인 병원은 노출하지 않습니다 (SCR-302 notes). */
  activeCaregivers: number;
}

export interface CareServiceItem {
  code: string;
  labelKo: string;
}

export interface CareRequest {
  id: string;
  hospitalName: string | null;
  ward: string | null;
  serviceType: string;
  shiftPatternCode: string | null;
  startAt: string;
  endAt: string | null;
  supportItems: string[] | null;
  mobilityLevel: string | null;
  status: string;
  slaDueAt: string | null;
  /** 본인·운영자만. 간병사에게는 별도 요약이 갑니다 (docs/11 §3.2). */
  cautions?: string | null;
  restrictedFlags?: string[] | null;
}

/**
 * 간병사 카드 (SCR-304).
 *
 * **국적도 실명도 없습니다** (§6-21 · §5.10). 여기에 필드를 추가할 때는
 * "보호자가 이걸 보고 무엇을 결정하는가"를 먼저 물어보세요. 국적으로
 * 고르기 시작하면 그것이 배정 관행이 되고, 검증을 통과한 인력이 국적 때문에
 * 선택받지 못합니다.
 */
export interface CaregiverCard {
  caregiverId: string;
  displayCode: string;
  experienceYrs: number;
  ratingAvg: number | null;
  completedCount: number;
  available: boolean;
}

export interface CareMatchResult {
  candidates: CaregiverCard[];
  /**
   * 몇 명이 빠졌는가. 보호자도 봅니다 — '간병사가 2명뿐'과 '12명 중 10명이
   * 빠졌다'는 전혀 다른 정보이고, 감추면 플랫폼에 사람이 없다고 판단합니다.
   */
  excludedCount: number;
  /**
   * 사유별 내역. **운영자에게만 갑니다** (`@Scope('admin')`).
   *
   * 그래서 optional입니다 — 보호자 응답에는 키 자체가 없습니다. 이 필드를
   * 필수로 두면 화면이 있다고 가정하고 그리다가 런타임에 터집니다.
   * 사유는 개인정보가 아니지만 "우리 인력의 검증이 만료돼 있다"는 운영
   * 약점이라, 고객에게 내보낼 판단은 따로 필요합니다.
   */
  excludedReasons?: Record<string, number>;
}

export interface CareAssignment {
  id: string;
  careRequestId: string;
  caregiverDisplayCode: string;
  status: string;
  offeredAt: string;
  respondedAt: string | null;
  shiftStartTime: string | null;
  shiftEndTime: string | null;
}

export interface ServiceLog {
  id: string;
  logType: string;
  itemCode: string | null;
  occurredAt: string;
  checkMethod: string | null;
  corrected: boolean;
  correctionOf: string | null;
  /** 서술형 메모. 보호자 scope에서는 잘려 나갑니다 (SCR-306 notes). */
  memo?: string | null;
}


// ── 산업 · 트랙 (SCR-507) ──────────────────────────────────────────────────

export interface Industry {
  id: string;
  code: string;
  labelKo: string;
  isActive: boolean;
}

export interface TrackRequirement {
  kind: string;
  refCode: string | null;
  mandatory: boolean;
  note: string | null;
}

export interface Track {
  id: string;
  code: string;
  labelKo: string;
  labelVi: string | null;
  /** NONE | TRAINING_REQUIRED | NATIONAL_LICENSE */
  qualificationType: string;
  isActive: boolean;
  requirements?: TrackRequirement[];
  /**
   * 체류자격 코드 목록. **운영자에게만 나갑니다** (§6-12).
   * 기관 화면에서는 키 자체가 없으므로 optional입니다.
   */
  visaTypes?: string[] | null;
}

export interface TrackWeights {
  trackId: string;
  /** rule_code → 배점. 코드가 아니라 이 표가 점수의 출처입니다 (§5.5). */
  weights: Record<string, number>;
}

/** SCR-506 사건 · 문의. 유형을 구조화하는 것이 이 화면의 요점입니다. */
export interface SupportTicket {
  id: string;
  ticketType: string;
  severity: string;
  status: string;
  relatedType?: string | null;
  relatedId?: string | null;
  createdAt: string;
  slaDueAt?: string | null;
  /** 음수면 이미 넘겼습니다. 화면은 `-2h`로 씁니다. */
  slaLeftHours?: number | null;
  urgent: boolean;
  resolution?: string | null;
  route?: string;
  assigneeId?: string | null;
  reporterRole?: string | null;
}

export interface TicketSummary {
  ticketType: string;
  urgent: boolean;
  route: string;
  total: number;
  open: number;
  escalated: number;
}
