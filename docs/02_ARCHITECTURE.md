# CARELINK Platform — 시스템 아키텍처

> 이 문서는 개발사와 Claude Code가 **동일한 구조를 만들도록** 강제하기 위한 기준 문서입니다.
> 화면 사양은 `wireframe/index.html`의 `SCREENS` 배열, 테이블 정의는 `docs/03_schema.sql`이 단일 출처입니다.

---

## 1. 아키텍처 원칙

| # | 원칙 | 이유 |
|---|---|---|
| 1 | **Modular Monolith로 시작한다** | MVP 단계에서 마이크로서비스는 개발 속도와 비용을 모두 악화시킵니다. 모듈 경계만 명확히 두고 배포는 하나로 합니다. |
| 2 | **모듈 간 호출은 서비스 인터페이스로만** | 나중에 서비스로 분리할 수 있게 다른 모듈의 Repository를 직접 부르지 않습니다. |
| 3 | **상태는 상태머신으로 정의한다** | 지원·배정·서류·정산 모두 상태 전이가 사업의 핵심입니다. 문자열 비교로 흩어놓으면 반드시 무너집니다. |
| 4 | **개인정보는 scope로 통제한다** | 같은 후보자 데이터라도 기관·간병사·운영자가 보는 필드가 다릅니다. 화면이 아니라 API 레벨에서 막습니다. |
| 5 | **기록은 append-only** | 근무 기록과 사건 대응 이력은 수정·삭제 불가. 정정은 새 레코드로 남깁니다. 정산 분쟁의 유일한 근거입니다. |
| 6 | **V1에 AI를 넣지 않는다** | 룰 기반 매칭 + 운영자 판단. 대신 판단 로그를 전부 남겨 Phase 4의 학습 데이터로 씁니다. |

---

## 2. 기술 스택

| 레이어 | 선택 | 비고 |
|---|---|---|
| Backend | **NestJS (TypeScript)** | FastAPI도 가능하나, 프론트와 언어를 통일해 인력 운용을 단순화 |
| Database | **PostgreSQL 15+** | JSONB로 유연 필드 흡수, 트랜잭션 신뢰성 |
| Cache / Queue | **Redis** + BullMQ | 세션, 매칭 잡, 알림 큐, SLA 타이머 |
| Web | **Next.js 14 (App Router)** | Organization Web · Admin Console · Patient 반응형 웹 |
| Mobile | **Flutter** | Candidate App · Caregiver App (단일 코드베이스, 저사양 안드로이드 대응 유리) |
| API | **REST** | GraphQL은 V3 이후 검토 |
| Storage | **S3 호환 Object Storage** | 서류 원본. 직접 URL 금지, presigned URL만 |
| Auth | **JWT (Access 15m / Refresh 14d) + RBAC** | Refresh는 httpOnly 쿠키 또는 secure storage |
| 알림 | FCM + 알림톡/SMS | 후보자·간병사는 앱 푸시 도달률이 낮으므로 알림톡 병행 |
| 관측 | Sentry + 구조화 로그 | 상태 전이는 전부 로그 이벤트로 |

---

## 3. 시스템 구성도

```
┌──────────────────────── CLIENT LAYER ────────────────────────┐
│  Candidate App    Caregiver App    Organization Web          │
│  (Flutter)        (Flutter)        Admin Console             │
│                                    Patient Web (Next.js)     │
└───────────────────────────┬──────────────────────────────────┘
                            │ REST + JWT
┌───────────────────────────▼──────────────────────────────────┐
│                    BACKEND (Modular Monolith)                │
│                                                              │
│  ┌────────┬─────────┬──────────┬──────────┬───────────────┐  │
│  │ iam    │ talent  │ matching │ care     │ ops           │  │
│  │        │         │          │          │               │  │
│  │ auth   │candidate│ rule     │ request  │ admin         │  │
│  │ user   │document │ engine   │assignment│ support       │  │
│  │ role   │training │ job      │service   │ notification  │  │
│  │ consent│journey  │application│  log     │ audit         │  │
│  │        │         │interview │ pricing* │ metrics       │  │
│  └────────┴─────────┴──────────┴──────────┴───────────────┘  │
│         org 모듈 · partner 모듈(V3) · settlement 모듈(V3)     │
└───────────────────────────┬──────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        ▼                   ▼                   ▼
   PostgreSQL           Redis/BullMQ      Object Storage
   (원장)               (큐·캐시·SLA)      (서류·수료증)
```

`*` pricing은 care 모듈 안의 독립 서비스로 두고, V3에서 settlement 모듈로 분리합니다.

---

## 4. 모듈 경계와 책임

| 모듈 | 책임 | 소유 테이블 | 다른 모듈에 노출하는 것 |
|---|---|---|---|
| `iam` | 인증, 사용자, 역할, 동의 | users, user_roles, consent_records, refresh_tokens | `getUser()`, `hasRole()`, `getScope()` |
| `talent` | 후보자 프로필, 서류 검증, 교육, 커리어 여정 | candidates, candidate_tracks, experiences, educations, languages, documents, training_*, journey_steps | `getCandidateProfile(scope)`, `isReadyForMatch()` |
| `org` | 기관, 기관 사용자, 검증, 계약 | organizations, organization_users, contracts | `getOrganization()`, `isVerified()` |
| `matching` | 채용 요청, 룰 매칭, 지원, 면접 | jobs, job_requirements, applications, matches, match_logs, interviews | `runMatching(jobId)`, `getMatchReasons()` |
| `care` | 간병 요청, 배정, 근무 기록, 가격 산정 | care_requests, care_assignments, service_logs, caregiver_availability, pricing_rules | `assign()`, `quote()` |
| `recruiting` | **파트너, 채널, 캠페인, 코호트 파이프라인** | partners, recruiting_channels, recruiting_campaigns, cohorts, cohort_members | `getChannelCAC()`, `getFunnel(cohortId)` |
| `quality` | **배치 전 클리어런스, 업무범위 게이트, 교대 패턴** | worker_clearances, shift_patterns, restricted_act_keywords | `isReadyForDeployment(userId)`, `scanRestrictedActs(text)` |
| `ops` | 운영자 콘솔, 사건·문의, 알림, 감사 로그, 지표 | support_tickets, notifications, audit_logs | `notify()`, `audit()` |
| `engagement` | **고용 모델, 계약, 컴플라이언스 게이트, 근무 원장, 청구·지급** | engagements, employment_contracts, engagement_compliance_checks, work_records, billing_lines, payout_lines | `getStrategy(model)`, `approveWorkRecords()` |
| `tracks` | 산업·트랙·요구사항·매칭 가중치·**비자 적격성** | industries, tracks, track_requirements, track_matching_weights, organization_types, visa_statuses, track_visa_eligibility | `getRequirements(trackId)`, `getWeights(trackId)`, `checkVisaEligibility(trackId, visaCode)` |
| `payroll` (V3) | 급여대장 (DIRECT_EMPLOYMENT 전용) | payroll_periods, payroll_items | — |

**금지 사항**: `matching` 모듈이 `candidates` 테이블을 직접 SELECT 하지 않습니다. `talent.getCandidatesForMatching(criteria)`를 호출합니다.

### 4.1 코어와 버티컬의 분리

```
WORKFORCE CORE (산업 중립)   iam · talent · tracks · org · matching
                             engagement · ops · payroll
CARE VERTICAL  (돌봄 전용)   care  ← 간병 요청·배정·간병사 일정·서비스 기록
```

`care` 모듈의 개념(간병 요청, 병실, 보호자)을 코어에 올리면 농업·요리 등 신규 산업을 붙일 때 전면 재작업이 됩니다. 반대로 `engagement`와 `work_records`는 반드시 코어에 있어야 합니다 — 어느 산업이든 사람은 고용되고, 일하고, 정산되기 때문입니다.

### 4.2 고용 모델 Strategy

```ts
interface EngagementStrategy {
  readonly model: EngagementModel;              // DIRECT_EMPLOYMENT | DELEGATION | BROKERAGE
  requiredContractDocuments(): DocumentSpec[];
  complianceChecks(): ComplianceCheck[];
  calculatePayout(records: WorkRecord[], ctx: EngagementContext): PayoutLine[];
  taxTreatment(): 'WAGE_INCOME' | 'BUSINESS_INCOME' | 'NONE';
  revenueRecognition(): 'GROSS' | 'NET';
}
```

**경계 규칙**: 기관 청구(`billing_lines`) 계산은 모델과 무관합니다. 모델별로 달라지는 것은 인력 지급(`payout_lines`), 계약 서류, 세무 처리, 컴플라이언스뿐입니다. 상세는 `docs/04_고용모델_및_버티컬확장.md`.

---

## 5. 권한 모델 (가장 중요한 설계)

### 5.1 역할

```
CANDIDATE      후보자
CAREGIVER      간병사
PATIENT_FAMILY 환자·보호자
ORG_MEMBER     기관 담당자 (기관별 소속)
ORG_ADMIN      기관 관리자
ADMIN          플랫폼 운영자
SUPER_ADMIN    플랫폼 관리자
PARTNER        교육·인력 파트너
```

한 `user`가 여러 `user_roles`를 가질 수 있습니다. **요양보호사가 간병사로도 일하는 경우가 실제로 흔하므로 이 분리는 선택이 아닙니다.**

### 5.2 데이터 scope — 같은 후보자, 다른 화면

| 필드 | ADMIN | ORG (검증 완료 + 면접 수락 후) | ORG (그 전) | CAREGIVER/기타 |
|---|---|---|---|---|
| 실명 | ○ | ○ | ✕ (`Candidate #102`) | ✕ |
| 연락처 | ○ | ○ | ✕ | ✕ |
| 국적·체류자격 | ○ | 제한적 | ✕ | ✕ |
| 경력·교육·언어 | ○ | ○ | ○ | ✕ |
| 서류 원본 파일 | ○ | ✕ (상태값만) | ✕ | ✕ |
| 매칭 점수·근거 | ○ | ○ | ○ | ✕ |

**구현**: 응답 직렬화 시 `@Scope('org' | 'admin' | 'self')` 데코레이터로 필드를 필터링합니다. 컨트롤러에서 if 문으로 처리하면 반드시 새는 곳이 생깁니다.

### 5.3 환자 정보 최소 노출

간병사(SCR-403)에게 노출되는 환자 정보는 **업무 수행에 필요한 항목으로 한정**합니다.

- 노출: 병실, 필요한 지원 항목, 이동 능력 수준, 주의사항
- 비노출: 실명, 진단명, 상세 병력

---

## 6. 상태머신

### 6.1 Candidate Journey (`talent`)

```
APPLIED → PROFILE_REGISTERED → DOC_REVIEW → TRAINING → READY
       → MATCHED → INTERVIEW → PLACED → ACTIVE
                                    ↘ INACTIVE / SUSPENDED
```
전이할 때마다 `candidate_journey_steps`에 이력 행을 남깁니다. 이 이력이 근속 데이터의 원천입니다.

### 6.2 Document (`talent`)

```
PENDING → UNDER_REVIEW → VERIFIED
                       ↘ REJECTED → (재제출) → UNDER_REVIEW
          VERIFIED → EXPIRED   (expires_at 도달 시 배치 스케줄러가 전이)
```
**만료 30일 전 자동 알림이 없으면 배치 중인 인력이 무효화됩니다.** BullMQ 반복 잡으로 처리합니다.

### 6.3 Job (`matching`)

```
DRAFT → OPEN → (PAUSED) → FILLED → CLOSED
              ↘ EXPIRED
```

### 6.4 Application (`matching`)

```
APPLIED → UNDER_REVIEW → INTERVIEW_REQUESTED → INTERVIEW_DONE
        → OFFERED → ACCEPTED
        ↘ REJECTED / WITHDRAWN
```
**무응답 7일 경과 시 운영자 태스크 자동 생성** (SLA 잡).

### 6.5 Care Assignment (`care`) — F-008

```
REQUEST → CANDIDATE_SEARCH → OFFER → ACCEPT → ASSIGNED
        → IN_SERVICE → COMPLETED
        ↘ DECLINED / CANCELLED / OPS_REVIEW / DISPUTED
```
**SLA: 요청 후 4시간 내 배정.** 초과 시 자동으로 `ISSUE`로 이동하고 담당자 알림 (SCR-505).

### 6.6 Engagement (`engagement`)

```
DRAFT → CONTRACT_PENDING → ACTIVE → ENDED
                         ↘ SUSPENDED / TERMINATED
```
`CONTRACT_PENDING → ACTIVE` 전이는 **`engagement_compliance_checks`가 전부 PASS**일 때만 허용합니다. 도급/파견 판단과 근로시간 규정 확인이 이 게이트에 걸립니다.

모델 전환은 상태 전이가 아닙니다. 기존 건을 `ENDED` 처리하고 새 engagement를 만들어 `previous_engagement_id`로 연결합니다.

### 6.7 Cohort Member (`recruiting`)

```
APPLIED → SELECTED → IN_TRAINING → COMPLETED → EXAM_PASSED → PLACED
        ↘ DROPPED (어느 단계에서든)
```
`DROPPED` 전이 시 **`dropped_stage`와 `drop_reason`을 필수로 기록**합니다. 이 두 필드 없이는 퍼널 개선이 불가능합니다.

### 6.8 Worker Clearance (`quality`)

```
PENDING → PASS → EXPIRED (유효기간 도래)
        ↘ FAIL
```
6개 항목(`IDENTITY_VERIFIED`, `CRIMINAL_RECORD_CLEAR`, `HEALTH_CHECK`, `VISA_ELIGIBLE`, `MANDATORY_TRAINING`, `SCOPE_TRAINING`)이 **전부 PASS**여야 배치 가능합니다. 운영자 예외 처리 경로를 만들지 마세요.

### 6.9 Payroll (V3)

```
OPEN → CALCULATED → CONFIRMED → PAID
```
⚠️ 도급/파견 판정과 근로시간 규정 적용 방식에 대한 노무 검토 완료 전에는 계산 로직을 구현하지 않습니다.

---

## 7. 매칭 엔진 (F-006) — V1은 룰 기반

### 7.1 입력

```ts
interface MatchCriteria {
  jobId: string;
  region: string;          // 시/도 + 시/군/구
  track: CareerTrack;
  employmentType: string;
  minExperienceYears: number;
  languageLevel?: string;  // TOPIK 등급
  dormRequired: boolean;
  startDate: Date;
}
```

### 7.2 점수 규칙 (`matching_rules` 기본값 + `track_matching_weights` 트랙별 오버라이드 — 하드코딩 금지)

| 규칙 | 배점 | 판정 |
|---|---|---|
| 지역 일치 | 25 | 시/군/구 일치 25, 시/도만 일치 15 |
| 경력 충족 | 20 | 요구 이상 20, 미달 시 0 |
| 필수교육 수료 | 20 | 수료 20 |
| 서류 검증 완료 | 15 | 전체 VERIFIED 15, 일부 7 |
| 근무 조건 일치 | 12 | 숙소·근무형태 일치 |
| 언어 수준 | 8 | 요구 충족 8, 1등급 미달 4 |
| **하드 필터** | — | `status != READY`, 근무 가능일 불일치, 필수 자격 미보유 → **후보 제외** |
| **체류자격 필터** | — | `track_visa_eligibility` 조회. `NOT_ALLOWED` → 제외, `PENDING_CONFIRMATION` → 운영자 검토 큐. 배치 예정일 이후 `visa_expires_on` → 제외 |
| **클리어런스 필터** | — | `worker_clearances` 6개 항목이 전부 `PASS`가 아니면 **후보 제외**. 국적은 절대 입력값으로 쓰지 않음 |

### 7.3 출력 (SCR-204 / SCR-504가 그대로 소비)

```ts
interface MatchResult {
  candidateId: string;
  score: number;              // 0–100
  reasons: string[];          // "지역 조건 일치 (경기) +25"
  missingRequirements: string[]; // "한국어 3급 (권장 4급)"
}
```

**`reasons`와 `missingRequirements`가 이 엔진의 존재 이유입니다.** 점수만 주는 매칭은 기관도 후보자도 신뢰하지 않습니다.

### 7.4 학습 데이터 축적

운영자가 SCR-504에서 내리는 모든 **추천 / 제외 / 제외 사유**를 `match_logs`에 적재합니다. Phase 4 AI 매칭은 이 로그로 학습합니다. **지금 수집하지 않으면 나중에 만들 수 없습니다.**

---

## 8. 가격 · 정산 (V2 → V3)

```
Pricing Engine (V2, 견적만)
  base_rate(service_type, region)
    + night_surcharge
    + holiday_surcharge
    + platform_fee
  = estimated_total          → SCR-305에 노출

Settlement (V3, 확정 청구)
  SERVICE_LOGS의 실제 근무시간 기준으로 재계산
  → authorize(예약 시) → capture(서비스 종료 후)
```

- 예약 시점에는 **승인(authorize)만** 합니다. 실제 근무시간이 확정되지 않았기 때문입니다.
- 취소 정책은 `cancellation_policy_version`으로 버전 관리하고, **동의 시점의 정책**을 적용합니다.
- `DISPUTED` 상태를 반드시 둡니다. 근무시간 이견은 반드시 발생합니다.

---

## 9. API 설계 규약

### 9.1 공통

- Base: `/api/v1`
- 인증: `Authorization: Bearer <access_token>`
- 페이지네이션: `?page=1&size=20` → `{ items, total, page, size }`
- 에러: `{ code, message, details? }` — `code`는 `TALENT_DOC_EXPIRED` 형태의 도메인 코드
- 멱등성: `POST /assignments/{id}/start` 등 상태 전이 API는 `Idempotency-Key` 헤더 지원

### 9.2 엔드포인트 (V1 기준)

```
# Auth
POST   /auth/register           POST /auth/login
POST   /auth/refresh            POST /auth/logout
POST   /auth/otp/send           POST /auth/otp/verify
GET    /auth/me

# Candidates
GET    /candidates              POST  /candidates
GET    /candidates/{id}         PATCH /candidates/{id}
POST   /candidates/{id}/documents
GET    /candidates/{id}/journey
GET    /candidates/{id}/jobs
POST   /candidates/{id}/tracks

# Organizations
POST   /organizations           GET   /organizations/{id}
PATCH  /organizations/{id}

# Jobs & Matching
POST   /jobs                    GET   /jobs
GET    /jobs/{id}               PATCH /jobs/{id}
POST   /jobs/{id}/apply
GET    /jobs/{id}/matches       POST  /jobs/{id}/recommend
POST   /jobs/{id}/exclude

# Interviews
POST   /interviews              GET   /interviews
PATCH  /interviews/{id}

# Care (V2)
POST   /care-requests           GET   /care-requests/{id}
POST   /care-requests/{id}/match
POST   /care-requests/{id}/assign
POST   /assignments/{id}/start  POST  /assignments/{id}/end
POST   /assignments/{id}/logs
GET    /caregivers/{id}/schedule

# Admin & Ops
GET    /admin/metrics           GET   /admin/alerts
GET    /admin/candidates        PATCH /admin/candidates/{id}/status
POST   /admin/candidates/bulk
PATCH  /admin/organizations/{id}/verify
GET    /support-tickets         PATCH /support-tickets/{id}

# Settlement (V3 — 착수 보류)
GET    /caregivers/{id}/settlements
POST   /payments/authorize      POST  /payments/capture
```

---

## 10. 국제화 (i18n) — 4개 언어

**ko / vi / ru / en을 처음부터 넣습니다.** 러시아어는 고려인 세그먼트(C·E) 공급 전략상 필수이며, 나중에 붙이면 전면 수정이 됩니다.

- 백엔드: 에러 코드만 반환, 문구는 클라이언트가 번역
- 알림 템플릿: `notification_templates(code, locale, channel, body)`
- 후보자의 `locale`은 `users.locale`에 저장하고 모든 알림에 적용
- **적용 범위**: FIELD 트랙(Candidate·Caregiver·Patient)은 4개 언어, DESK 트랙(Org·Admin)은 한국어만
- 레이아웃: 라벨은 한국어 기준 길이의 2.5배 수용. 고정 폭 버튼 금지, 말줄임 대신 줄바꿈

상세 IA·디자인 토큰은 `docs/09_IA_및_디자인시스템.md`.

---

## 11. 리포지토리 구조

```
carelink/
├─ CLAUDE.md                    ← Claude Code 작업 지침 (먼저 읽을 것)
├─ docs/
│  ├─ 01_사업제안서.md
│  ├─ 02_ARCHITECTURE.md        ← 이 문서
│  └─ 03_schema.sql
├─ wireframe/
│  └─ index.html                ← 화면 정의서 (SCREENS 배열 = 사양 원본)
├─ apps/
│  ├─ api/                      NestJS
│  │  └─ src/modules/{iam,talent,org,matching,care,ops}/
│  │     └─ <module>/{controller,service,repository,dto,entity,state}
│  ├─ web-org/                  Next.js — Organization Web
│  ├─ web-admin/                Next.js — Admin Console
│  ├─ web-care/                 Next.js — Patient 반응형 웹 (V2)
│  ├─ mobile-candidate/         Flutter
│  └─ mobile-caregiver/         Flutter (V2)
├─ packages/
│  ├─ shared-types/             API 타입 (OpenAPI 생성)
│  └─ ui/                       공용 디자인 시스템
└─ infra/
   ├─ docker-compose.yml
   └─ migrations/
```

---

## 12. 개발 순서 (Claude Code 작업 단위)

각 단계는 **동작하는 상태로 끝나야** 합니다. 다음 단계로 넘어가기 전에 통합 테스트가 통과해야 합니다.

| # | 작업 | 산출물 | 완료 기준 |
|---|---|---|---|
| 1 | 스키마 마이그레이션 | `03_schema.sql` 적용 (industries/tracks 포함) | 시드 데이터로 모든 FK 정상 |
| 2 | `iam` 모듈 | 회원가입·로그인·역할·JWT | SCR-001~003 동작 |
| 3 | `talent` 프로필 | 후보자 CRUD, 트랙 | SCR-103~104 동작 |
| 4 | `talent` 서류 | 업로드, 검증 상태머신, 만료 잡 | SCR-105 + 만료 알림 |
| 5 | `talent` 여정·교육 | 여정 이력, 교육 진도 저장 | SCR-102, 106 |
| 6 | `org` 모듈 | 기관 등록·검증 게이트 | SCR-201, 503 |
| 7 | `matching` 채용요청 | Job CRUD, 급여 공개 범위 | SCR-202 |
| 8 | `matching` 룰 엔진 | 점수 + reasons + missing | SCR-107, 108, 203, 204 |
| 9 | `matching` 지원·면접 | 상태머신 + 알림 | SCR-109, 205 |
| 10 | `ops` 운영 콘솔 | 대시보드, 일괄 작업, 매칭 센터 | SCR-501, 502, 504 |
| 10.3 | `recruiting` 모듈 | 파트너·채널·캠페인·코호트 퍼널 | SCR-510, 511 |
| 10.4 | `quality` 모듈 | 클리어런스 게이트, 업무범위 스캔, 교대 패턴 | SCR-509 |
| 10.5 | `engagement` 모듈 | 모델·계약·컴플라이언스 게이트 + Strategy 3종 골격 | SCR-508 |
| — | **V1 완료 — 파일럿 투입** | | |
| 11 | `care` 요청·배정 | 요청, 매칭, 배정, SLA 잡 | SCR-301~305, 505 |
| 12 | `care` 근무 기록 | QR 체크인, append-only 로그 | SCR-401~404, 306 |
| 13 | `ops` 사건 관리 | 유형 구조화, 에스컬레이션 | SCR-506 |
| — | **V2 완료** | | |
| 12.5 | `engagement` 집계 | `service_logs` → `work_records` 승인 잡 | — |
| 14 | `payroll` | ⚠️ 착수 전 도급/파견·근로시간 노무 검토 필요 | SCR-307, 405 |

---

## 13. 비기능 요구사항

| 항목 | 기준 |
|---|---|
| 응답 시간 | 목록 API p95 < 500ms, 매칭 실행 < 3s (비동기 시 즉시 202) |
| 가용성 | 업무시간 99.5%. 간병 배정은 야간에도 동작해야 함 |
| 보안 | 서류 파일 presigned URL(만료 5분), 전 구간 TLS, 개인정보 컬럼 암호화 |
| 감사 | 개인정보 조회·상태 변경·정산 관련 행위 전량 `audit_logs` 적재 |
| 보존 | 동의 이력은 버전별 영구 보존, 서류 원본은 정책상 보존기간 후 파기 |
| 접근성 | FIELD 트랙(간병사·후보자·보호자)은 고령·비한국어 사용자 기준 — 최소 폰트 16px, 터치 타깃 48px, 색+아이콘+텍스트 3중 상태 전달 |
| 테스트 | 상태머신 전이는 단위 테스트 필수. 매칭 엔진은 골든 케이스 20건 이상 |

---

## 14. 유의 사항 (개발 중 판단이 필요할 때)

1. **자격·체류 관련 로직을 자동 판정하지 마세요.** 플랫폼은 상태를 기록할 뿐, 적격성은 사람이 판정하고 그 결과를 입력합니다.
2. **간병 서비스 카탈로그에 의료행위를 넣지 마세요.** 투약·주사·석션·처치는 항목 자체가 없어야 합니다. 자유 입력에서 감지되면 자동 배정을 막고 운영자 큐로 보냅니다.
3. **GPS 출퇴근은 기본값이 아닙니다.** 위치정보 동의와 법규 검토가 선행돼야 하며, 병실 QR이 동의 부담이 낮고 정확도도 높습니다.
4. **기관이 후보자 연락처를 조회하는 경로를 하나로만 두세요.** 우회 경로가 생기면 플랫폼을 건너뛴 직거래가 발생하고 수익모델이 무너집니다.
5. **트랙·산업 코드를 상수로 하드코딩하지 마세요.** `tracks` 테이블에서 읽습니다. 하드코딩하면 새 산업을 열 때마다 배포가 필요해집니다.
6. **`if (model === 'DIRECT_EMPLOYMENT')` 분기를 서비스 로직에 흩뿌리지 마세요.** Strategy 팩토리를 통합니다.
7. **국적을 매칭 로직에 쓰지 마세요.** 차별이자 계약·규제 리스크입니다. `worker_clearances`와 한국어 수준으로 판단합니다. 언어는 간병 업무의 본질이므로 정당한 기준이지만, 국적은 아닙니다.
8. **체류자격 적격성을 자동 판정하지 마세요.** `track_visa_eligibility`는 명백한 조합만 담고, 회색 영역은 `PENDING_CONFIRMATION`으로 사람에게 넘깁니다. 비자 부적격 인력 배치는 불법 취업 알선입니다.
9. **판단이 서지 않으면 만들지 말고 물어보세요.** 특히 정산·계약·개인정보 범위는 코드로 결정할 사안이 아닙니다.
