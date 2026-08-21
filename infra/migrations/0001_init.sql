-- 이 파일은 docs/03_schema.sql에서 생성됩니다. 직접 편집하지 마세요.
-- 스키마의 단일 출처는 docs/03_schema.sql입니다 (docs/02 서두).
-- 재생성: pnpm db:split

-- =============================================================================
-- CARELINK PLATFORM — PostgreSQL Schema (v1)
-- =============================================================================
-- 대상: PostgreSQL 15+
-- 원칙
--   1) 상태값은 ENUM으로 고정한다. 문자열 자유 입력은 상태머신을 무너뜨린다.
--   2) 근무 기록(service_logs)과 감사 로그(audit_logs)는 append-only.
--      UPDATE/DELETE 권한을 애플리케이션 롤에서 회수할 것.
--   3) 개인정보 컬럼은 애플리케이션 레벨 암호화 후 저장(pgcrypto 또는 KMS).
--      아래 주석에 [PII] 로 표기된 컬럼이 대상.
--   4) V2 / V3 섹션은 해당 단계 전까지 생성만 하고 사용하지 않는다.
--      단, settlement 계열은 간병사 법적 관계 확정 전까지 생성하지 않는다.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- ENUM 정의
-- =============================================================================
CREATE TYPE user_role AS ENUM (
  'CANDIDATE','CAREGIVER','PATIENT_FAMILY','ORG_MEMBER','ORG_ADMIN',
  'PARTNER','ADMIN','SUPER_ADMIN'
);

-- career_track ENUM은 제거했다. 트랙은 tracks 테이블로 관리한다(§0 참조).
-- 이유: 농업·미용·요리 등 신규 산업을 추가할 때 코드 배포 없이 행 추가만으로
--       확장되어야 하기 때문. ENUM이면 산업이 늘 때마다 마이그레이션이 필요하다.

CREATE TYPE candidate_status AS ENUM (
  'DRAFT','DOC_REVIEW','TRAINING','READY','MATCHED','PLACED','INACTIVE','SUSPENDED'
);

CREATE TYPE journey_step AS ENUM (
  'APPLIED','PROFILE_REGISTERED','DOC_REVIEW','TRAINING','READY',
  'MATCHED','INTERVIEW','PLACED','ACTIVE'
);

-- 체류자격 확보 절차. 커리어 여정(journey_step)과는 별개의 축이다.
--
-- 왜 나누는가: 두 축은 순서도 의미도 다르다. 커리어 여정에서 계약(PLACED)은
-- 매칭·면접을 거친 8번째 단계지만, 체류자격 절차에서 고용계약은 2번째다 —
-- E-7-2 심사가 고용주를 전제로 하기 때문에 계약이 먼저 있어야 신청이 된다.
-- 한 축에 우겨넣으면 둘 중 하나는 반드시 거짓이 된다.
--
-- 모든 후보자에게 붙는 축이 아니다. F-5·F-6·F-4처럼 이미 취업 가능한 자격을
-- 가진 국내 인력은 이 절차가 없다. track_visa_eligibility 조회 결과가
-- REQUIRES_CONVERSION 이거나 해외 신규 발급 건일 때만 시작한다.
-- 국적으로 판정하지 않는다 (docs/07 §2.2).
CREATE TYPE visa_process_step AS ENUM (
  'CONTRACT_SIGNED',       -- 고용계약 체결. E-7-2는 고용주 없이 신청이 되지 않는다
  'DOCUMENT_REVIEW',       -- 제출 서류 준비·심사
  'APPLICATION_SUBMITTED', -- 출입국·재외공관 접수
  'APPROVED',              -- 발급 또는 자격 변경 승인. 국내 변경 건은 여기가 종착점
  'ENTERED',               -- 입국 완료. 해외 신규 발급 건에만 해당
  'REJECTED',              -- 불허. 사유 기록 필수
  'WITHDRAWN'              -- 본인 철회·이탈
);

CREATE TYPE document_type AS ENUM (
  'IDENTITY',        -- 신분 (여권·외국인등록증·신분증)
  'CRIMINAL_RECORD', -- 범죄경력 회보서. 배치 전 필수. 2년마다 갱신.
  'EDUCATION','CAREER','QUALIFICATION',
  'HEALTH',          -- 건강진단서. 발급 6개월 이내.
  'OTHER'
);

CREATE TYPE document_status AS ENUM (
  'PENDING','UNDER_REVIEW','VERIFIED','REJECTED','EXPIRED'
);

-- organization_type ENUM도 제거했다. organization_types 테이블로 관리한다(§0).
-- 농가·미용실·음식점은 병원과 다른 유형이며, 산업별로 계속 늘어난다.

CREATE TYPE verification_status AS ENUM ('PENDING','VERIFIED','REJECTED','SUSPENDED');

CREATE TYPE job_status AS ENUM ('DRAFT','OPEN','PAUSED','FILLED','CLOSED','EXPIRED');

-- 급여 공개 범위: 기관은 비공개를 원하고 후보자는 공개를 요구한다.
-- 이 값이 지원 전환율에 직접 영향을 주므로 필드로 분리해 측정 대상으로 둔다.
CREATE TYPE salary_visibility AS ENUM ('PUBLIC','AFTER_MATCH','NEGOTIABLE');

CREATE TYPE application_status AS ENUM (
  'APPLIED','UNDER_REVIEW','INTERVIEW_REQUESTED','INTERVIEW_DONE',
  'OFFERED','ACCEPTED','REJECTED','WITHDRAWN'
);

CREATE TYPE interview_status AS ENUM (
  'REQUESTED','CONFIRMED','COMPLETED','CANCELLED','NO_SHOW'
);
-- NO_SHOW를 CANCELLED와 분리하는 이유: 평균 충원 기간 KPI와 공급 품질 관리에 쓰인다.

CREATE TYPE training_type AS ENUM ('LANGUAGE','JOB','MANDATORY');
CREATE TYPE enrollment_status AS ENUM ('ENROLLED','IN_PROGRESS','COMPLETED','DROPPED','EXPIRED');

-- ---- V2: Care Service --------------------------------------------------------
-- 서비스 유형(보호자가 요청하는 서비스의 총 커버 시간)과
-- 교대 패턴(그 시간을 몇 명이 어떻게 나눠 근무하는가)은 다른 개념이다.
-- 예: 24시간 커버를 1명이 상주(H24_LIVE_IN)할 수도, 3명이 8시간씩(H8_3SHIFT) 할 수도 있다.
CREATE TYPE care_service_type AS ENUM ('H12','H24','DAY','NIGHT');

CREATE TYPE care_request_status AS ENUM (
  'DRAFT','SUBMITTED','MATCHING','OFFER_SENT','ASSIGNED',
  'IN_SERVICE','COMPLETED','CANCELLED','OPS_REVIEW','ISSUE'
);

CREATE TYPE assignment_status AS ENUM (
  'OFFERED','ACCEPTED','DECLINED','ASSIGNED','IN_SERVICE',
  'COMPLETED','CANCELLED','DISPUTED'
);

CREATE TYPE check_method AS ENUM ('QR','GPS','MANUAL');
-- GPS 사용 시 위치정보 수집·이용 동의와 법규 검토가 선행되어야 한다. 기본값은 QR.

CREATE TYPE ticket_status AS ENUM ('NEW','IN_REVIEW','RESOLVED','ESCALATED');
CREATE TYPE ticket_type AS ENUM (
  'SAFETY_INCIDENT',      -- 안전사고
  'SERVICE_QUALITY',      -- 서비스 품질
  'WORK_HOUR_DISPUTE',    -- 근무시간 이견
  'PAYMENT',              -- 결제·정산
  'HARASSMENT',           -- 부당 대우 · 차별 · 괴롭힘
  'SCOPE_VIOLATION',      -- 간병사 업무범위 초과 요구 (의료행위 요구 등)
  'OTHER'
);
-- SCOPE_VIOLATION 과 HARASSMENT 는 4시간 내 1차 대응, 별도 에스컬레이션 경로.

-- =============================================================================
-- 0. INDUSTRY / TRACK — 확장 축
-- =============================================================================
-- 설계 원칙: 트랙마다 달라지는 것(필요 서류·교육·자격·비자·매칭 가중치)은
--            전부 데이터로 둔다. 화면과 로직은 하나이고, 요구사항만 조회한다.
--            새 산업 추가는 코드 배포가 아니라 행 추가로 끝나야 한다.
-- 참조: docs/04_고용모델_및_버티컬확장.md §5

CREATE TABLE industries (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code        VARCHAR(32) UNIQUE NOT NULL,   -- CARE | FOOD_SERVICE | AGRICULTURE | BEAUTY
  label_ko    VARCHAR(80) NOT NULL,
  is_active   BOOLEAN NOT NULL DEFAULT false, -- MVP는 CARE만 true
  launched_on DATE,
  sort_order  INT NOT NULL DEFAULT 0
);

CREATE TABLE tracks (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  industry_id  UUID NOT NULL REFERENCES industries(id),
  code         VARCHAR(64) UNIQUE NOT NULL,
  label_ko     VARCHAR(120) NOT NULL,
  label_vi     VARCHAR(120),
  label_en     VARCHAR(120),
  -- 자격 경로 유형. 트랙별 온보딩 분기의 기준값.
  --   NONE               무자격 진입 가능
  --   TRAINING_REQUIRED  교육 이수 필요
  --   NATIONAL_LICENSE   국가자격·면허 필요 (리드타임 최장)
  qualification_type VARCHAR(32) NOT NULL DEFAULT 'TRAINING_REQUIRED',
  -- 관련 체류자격 코드. 표시·필터용이며 적격성을 자동 판정하지 않는다.
  visa_types   TEXT[],
  is_active    BOOLEAN NOT NULL DEFAULT true,
  sort_order   INT NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_tracks_industry ON tracks(industry_id, is_active);

-- 트랙별 요구사항. SCR-105(서류)와 SCR-102(여정)가 이 테이블을 읽어 분기한다.
CREATE TABLE track_requirements (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  track_id     UUID NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  kind         VARCHAR(32) NOT NULL,   -- DOCUMENT | TRAINING | LICENSE | HEALTH_CHECK | AGE
  ref_code     VARCHAR(64),            -- document_type 값 또는 training_programs.code
  is_mandatory BOOLEAN NOT NULL DEFAULT true,
  note         TEXT
);

-- 트랙별 매칭 가중치 오버라이드. 없으면 matching_rules의 기본값을 쓴다.
CREATE TABLE track_matching_weights (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  track_id   UUID NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  rule_code  VARCHAR(64) NOT NULL,
  max_points INT NOT NULL,
  UNIQUE (track_id, rule_code)
);

-- 기관 유형도 산업별로 늘어난다. 병원 · 농가 · 미용실 · 음식점.
CREATE TABLE organization_types (
  code        VARCHAR(48) PRIMARY KEY,
  industry_id UUID NOT NULL REFERENCES industries(id),
  label_ko    VARCHAR(80) NOT NULL,
  is_active   BOOLEAN NOT NULL DEFAULT true
);

-- =============================================================================
-- 0-2. VISA / 체류자격 — 매칭의 하드 필터
-- =============================================================================
-- 원칙: 시스템은 체류자격 적격성을 '판정'하지 않는다. 사람이 판정한 결과를 '기록'한다.
--       단, 명백히 불가능한 조합(예: E-9 → 요양보호사)은 매칭에서 하드 필터로 제외한다.
--       비자 부적격 인력을 배치하면 불법 취업 알선이 되므로 편의 기능이 아니라
--       컴플라이언스 게이트다.
-- 참조: docs/06_외국인력_비자_및_공급전략.md

CREATE TABLE visa_statuses (
  code          VARCHAR(16) PRIMARY KEY,   -- F-4 | F-5 | F-6 | F-2 | H-2 | E-7-2 | D-2 | D-10 | E-9
  label_ko      VARCHAR(80) NOT NULL,
  -- 취업활동 제한 유형
  --   NONE          제한 없음 (F-5, F-6)
  --   PARTIAL       일부 제한 (F-4 단순노무 제한, F-2-R 지역·업종 조건)
  --   INDUSTRY      허용 업종 한정 (E-9)
  --   OCCUPATION    특정 직종 한정 (E-7-2 = 노인의료복지시설)
  --   NONE_ALLOWED  취업 불가 (D-2 원칙, D-10)
  work_restriction VARCHAR(24) NOT NULL,
  is_ethnic_korean BOOLEAN NOT NULL DEFAULT false,  -- 동포 자격 여부
  -- 신규 발급 중단 여부. H-2는 2026-02-12부터 신규 발급 중단(F-4로 통합).
  new_issuance_stopped BOOLEAN NOT NULL DEFAULT false,
  stopped_on    DATE,
  note          TEXT
);

-- 트랙 × 체류자격 허용 매트릭스.
-- 이 테이블이 매칭 엔진의 하드 필터 입력이다.
CREATE TABLE track_visa_eligibility (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  track_id      UUID NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  visa_code     VARCHAR(16) NOT NULL REFERENCES visa_statuses(code),
  -- ALLOWED               즉시 취업 가능
  -- REQUIRES_QUALIFICATION 국가자격 취득 후 가능 (체류자격 변경 불요)
  -- REQUIRES_CONVERSION   자격 취득 + 체류자격 변경 필요 (D-2/D-10 → E-7-2)
  -- PENDING_CONFIRMATION  판단 미확정 → 자동 배정 차단, 운영자 검토 큐로
  -- NOT_ALLOWED           불가
  eligibility   VARCHAR(32) NOT NULL,
  target_visa_code VARCHAR(16) REFERENCES visa_statuses(code), -- 전환 목표 자격
  lead_time_months INT,          -- 취업까지 예상 소요 개월
  note          TEXT,
  -- 언제 누가 판정했는지. 회색 영역일수록 근거와 시점이 남아야 합니다.
  -- users FK는 아래에서 ALTER로 붙입니다 — 이 시점에는 users가 아직 없습니다.
  decided_by    UUID,
  decided_at    TIMESTAMPTZ,
  -- 확정 판정인지 잠정인지. 잠정이면 뒤집힐 것을 전제로 운영해야 합니다.
  is_provisional BOOLEAN NOT NULL DEFAULT false,
  UNIQUE (track_id, visa_code)
);

-- 적격성 판정 이력.
--
-- **되돌릴 때가 진짜 문제입니다.** F-4를 ALLOWED로 열어 배치한 뒤 불가로
-- 뒤집히면 이미 현장에 있는 인력이 **불법 취업 상태**가 됩니다. 그때 누가
-- 영향받는지 몇 분 안에 찾지 못하면 대응이 불가능합니다.
--
-- track_visa_eligibility는 현재 상태만 들고 있으므로(UPDATE로 덮임), 변경
-- 이력은 여기에 append-only로 쌓습니다. 정정도 UPDATE가 아니라 새 행입니다.
CREATE TABLE visa_eligibility_decisions (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  track_id      UUID NOT NULL REFERENCES tracks(id),
  visa_code     VARCHAR(16) NOT NULL REFERENCES visa_statuses(code),
  from_eligibility VARCHAR(32),
  to_eligibility   VARCHAR(32) NOT NULL,
  is_provisional BOOLEAN NOT NULL DEFAULT false,
  -- 판정 근거. '1345 문서 회신 2026-09-15' 같은 원문 출처를 남깁니다.
  basis         TEXT,
  decided_by    UUID,
  decided_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_visa_decisions_track ON visa_eligibility_decisions(track_id, visa_code, decided_at DESC);

-- =============================================================================
-- 1. IAM
-- =============================================================================
CREATE TABLE users (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email           VARCHAR(255) UNIQUE,                  -- [PII]
  phone           VARCHAR(32)  UNIQUE,                  -- [PII]
  password_hash   VARCHAR(255),                         -- OTP 로그인만 쓰면 NULL 허용
  locale          VARCHAR(8)  NOT NULL DEFAULT 'ko',    -- ko | vi | ru | en (docs/09 §6 · docs/12 D8)
  status          VARCHAR(24) NOT NULL DEFAULT 'ACTIVE',-- ACTIVE|SUSPENDED|WITHDRAWAL_REQUESTED
  -- 탈퇴 요청 시점. 파기 기준일(30일)이 여기서부터 센다 (docs/11 §4).
  -- status만 두면 "언제부터 30일인가"를 알 수 없어 파기 잡이 성립하지 않는다.
  -- 철회하면(ACTIVE 복귀) NULL로 되돌린다.
  withdrawal_requested_at TIMESTAMPTZ,
  -- 익명화 완료 시점. 재실행 방지이자 파기 대장이다 — 이 값이 없으면
  -- 잡이 매일 같은 행을 다시 익명화하려 하고, 무엇이 언제 파기됐는지 남지 않는다.
  anonymized_at   TIMESTAMPTZ,
  last_login_at   TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 한 계정이 복수 역할을 갖는다. 요양보호사가 간병사로도 일하는 경우가 흔하다.
CREATE TABLE user_roles (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role            user_role NOT NULL,
  organization_id UUID,                                 -- ORG_MEMBER/ORG_ADMIN일 때만
  is_primary      BOOLEAN NOT NULL DEFAULT false,
  approved_at     TIMESTAMPTZ,                          -- 기관 소속은 승인 전까지 NULL
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- NULLS NOT DISTINCT가 필요하다. 기본 동작에서는 NULL끼리 서로 다른 값으로 취급되어
  -- organization_id가 NULL인 개인 역할(CANDIDATE 등)이 몇 번이고 중복 삽입된다.
  -- ON CONFLICT DO NOTHING도 이 제약을 타야 발동한다. (PostgreSQL 15+)
  UNIQUE NULLS NOT DISTINCT (user_id, role, organization_id)
);

-- 동의 이력은 버전별로 적재한다. 분쟁 시 '동의 시점의 약관'이 방어 근거가 된다.
CREATE TABLE consent_records (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  -- TOS | PRIVACY | SENSITIVE_INFO | OVERSEAS_TRANSFER
  -- THIRD_PARTY_ORG | THIRD_PARTY_INSURER | LOCATION | MARKETING
  consent_code    VARCHAR(64) NOT NULL,
  version         VARCHAR(32) NOT NULL,
  is_required     BOOLEAN NOT NULL DEFAULT true,
  agreed          BOOLEAN NOT NULL,
  agreed_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_address      INET,
  -- 국외이전 동의인 경우에만 채움. 이전받는 자·국가를 명시하지 않은 동의는 무효다.
  transfer_country   VARCHAR(64),
  transfer_recipient VARCHAR(200)
);
-- 필수 동의와 선택 동의를 한 화면에서 일괄 체크로 받으면 무효다. 항목별로 분리할 것.
-- SENSITIVE_INFO(건강·범죄경력)와 OVERSEAS_TRANSFER는 각각 별도 동의여야 한다.

CREATE TABLE refresh_tokens (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL,
  device_id  VARCHAR(128),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- 2. TALENT
-- =============================================================================
-- 기관에 노출되는 유일한 후보자 식별자. UUID를 그대로 보여주면 화면에서 읽히지 않고
-- 운영자가 전화로 부를 수도 없다. 'C-00102' 형태의 순번으로 발급한다.
-- 실명 게이트가 열리기 전까지 이 값이 후보자를 가리키는 이름 역할을 한다.
CREATE SEQUENCE candidate_display_seq START 101;

CREATE TABLE candidates (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  display_code      VARCHAR(16) NOT NULL UNIQUE,        -- '#102' — 기관에는 이 값만 노출
  name              VARCHAR(120),                        -- [PII] 면접 수락 후에만 기관에 공개
  birth_date        DATE,                                -- [PII]
  gender            VARCHAR(16),
  nationality       VARCHAR(64),                         -- [PII 준함] 기관 노출 제한
  -- 체류자격. [PII] ADMIN 전용. 기관에는 '취업 가능 여부'만 노출한다.
  visa_status_code  VARCHAR(16) REFERENCES visa_statuses(code),
  -- 체류기간 만료일. 서류 만료와 동일하게 알림 잡을 돌린다.
  -- 만료된 체류자격으로 배치되어 있으면 불법 취업이 된다.
  visa_expires_on   DATE,
  visa_verified_by  UUID,                                -- 확인한 운영자
  visa_verified_at  TIMESTAMPTZ,
  current_location  VARCHAR(120),
  preferred_regions TEXT[],
  employment_types  TEXT[],                              -- FULL_TIME | SHIFT | PART_TIME ...
  dorm_required     BOOLEAN DEFAULT false,
  available_from    DATE,
  status            candidate_status NOT NULL DEFAULT 'DRAFT',
  assignee_id       UUID REFERENCES users(id),           -- 담당 운영자
  -- 유입 출처. 채널별 CAC 산출의 기준이다.
  channel_id        UUID,                                -- recruiting_channels.id
  campaign_id       UUID,                                -- recruiting_campaigns.id
  -- 기존 인력 추천. 실측상 전환율이 가장 높은 채널이므로 별도 추적한다.
  referred_by       UUID REFERENCES users(id),
  tags              TEXT[],
  last_activity_at  TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_candidates_status ON candidates(status);
CREATE INDEX idx_candidates_available ON candidates(available_from);
-- 체류기간 만료 알림 잡의 기준 인덱스
CREATE INDEX idx_candidates_visa_expiry ON candidates(visa_expires_on)
  WHERE visa_expires_on IS NOT NULL;

-- 복수 트랙 허용. MVP는 3개 트랙(요양·의료지원·병원간병)을 동시에 운영하되,
-- is_primary 를 1개로 강제한다. KPI를 트랙별로 분리 측정하기 위한 기준값이다.
-- 합산 지표만 보면 어느 트랙이 통했는지 판별할 수 없다.
CREATE TABLE candidate_tracks (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  track_id     UUID NOT NULL REFERENCES tracks(id),
  is_primary   BOOLEAN NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (candidate_id, track_id)
);
CREATE UNIQUE INDEX uq_candidate_primary_track
  ON candidate_tracks(candidate_id) WHERE is_primary;

CREATE TABLE experiences (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  candidate_id  UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  organization  VARCHAR(200),
  role_title    VARCHAR(120),
  started_on    DATE,
  ended_on      DATE,
  -- 종료된 경력의 개월 수. 재직 중(ended_on IS NULL)이면 NULL이다.
  -- 원래는 COALESCE(ended_on, CURRENT_DATE)였으나 두 가지 이유로 바꿨다.
  --   1) CURRENT_DATE는 immutable이 아니라 STORED 생성 컬럼에 쓸 수 없다 (PostgreSQL이 거부).
  --   2) 설령 됐더라도 STORED는 INSERT 시점에 고정되므로, 재직 중인 경력은
  --      시간이 지나도 그 값에 머물러 실제보다 짧게 집계된다.
  -- 재직 중을 포함한 현재 기준 경력은 아래 experiences_current 뷰를 쓴다.
  -- ::timestamp 캐스팅은 필수다. age(date,date)는 age(timestamptz,timestamptz)로 해석되는데
  -- date→timestamptz 캐스트가 TimeZone 설정에 의존해 stable이므로 생성 컬럼에 쓸 수 없다.
  months        INT GENERATED ALWAYS AS (
                  CASE WHEN started_on IS NOT NULL AND ended_on IS NOT NULL
                    THEN GREATEST(0, (EXTRACT(YEAR  FROM age(ended_on::timestamp, started_on::timestamp)) * 12
                                    + EXTRACT(MONTH FROM age(ended_on::timestamp, started_on::timestamp)))::INT)
                  END
                ) STORED,
  verified      BOOLEAN NOT NULL DEFAULT false,
  description   TEXT
);

-- 조회 시점 기준 경력 개월 수. 재직 중이면 오늘까지로 계산한다.
-- 매칭 엔진의 EXPERIENCE 규칙은 이 뷰를 사용한다 (experiences.months 직접 참조 금지).
CREATE VIEW experiences_current AS
SELECT e.*,
       CASE WHEN e.started_on IS NULL THEN NULL
            ELSE GREATEST(0, (EXTRACT(YEAR  FROM age(COALESCE(e.ended_on, CURRENT_DATE), e.started_on)) * 12
                            + EXTRACT(MONTH FROM age(COALESCE(e.ended_on, CURRENT_DATE), e.started_on)))::INT)
       END AS months_to_date
FROM experiences e;

CREATE TABLE educations (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  school       VARCHAR(200),
  major        VARCHAR(120),
  degree       VARCHAR(64),
  graduated_on DATE,
  verified     BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE languages (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  language     VARCHAR(32) NOT NULL,    -- ko | vi | en
  level_code   VARCHAR(32),             -- TOPIK_1..6 | NATIVE | BASIC
  certified    BOOLEAN NOT NULL DEFAULT false,
  UNIQUE (candidate_id, language)
);

-- 서류 원본은 절대 직접 URL로 노출하지 않는다. presigned URL(만료 5분)만 발급.
CREATE TABLE documents (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  candidate_id  UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  doc_type      document_type NOT NULL,
  -- S3 object key. 원본 파기 후에는 NULL이 된다 (아래 original_purged_at 참조).
  -- NOT NULL로 두면 docs/11 §1.2가 요구하는 파기 자체가 불가능해진다.
  file_key      VARCHAR(512),
  file_name     VARCHAR(255),
  status        document_status NOT NULL DEFAULT 'PENDING',
  reviewer_id   UUID REFERENCES users(id),
  reviewed_at   TIMESTAMPTZ,
  reject_reason TEXT,
  issued_on     DATE,
  expires_at    DATE,                      -- 만료 30일 전 자동 알림 잡의 기준
  -- 범죄경력·건강진단서는 확인 후 원본을 파기하고 결과값만 남긴다.
  -- 유출 시 피해 규모가 다른 항목과 비교되지 않는다.
  original_purged_at TIMESTAMPTZ,
  verdict       VARCHAR(32),               -- CLEAR | FLAGGED | FIT | UNFIT — 원본 대신 남기는 결과값
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- 파일이 없는 서류는 파기된 것뿐이다. 업로드 실패로 키가 비는 것을 막는다.
  CONSTRAINT documents_file_key_present
    CHECK (file_key IS NOT NULL OR original_purged_at IS NOT NULL)
);
CREATE INDEX idx_documents_expiry ON documents(expires_at)
  WHERE status = 'VERIFIED';

-- 커리어 여정 이력. 근속·전환 데이터의 원천이므로 전이마다 행을 추가한다(갱신 아님).
CREATE TABLE candidate_journey_steps (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  candidate_id  UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  step          journey_step NOT NULL,
  entered_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor_id      UUID REFERENCES users(id),
  note          TEXT
);
CREATE INDEX idx_journey_candidate ON candidate_journey_steps(candidate_id, entered_at DESC);

-- 체류자격 절차 이력. candidate_journey_steps와 같은 append-only 형태다.
-- 정정은 UPDATE가 아니라 새 행으로 남긴다 — 어느 단계에서 얼마나 걸렸는지가
-- 세그먼트별 리드타임(docs/06 §3.4)의 유일한 실측 근거이기 때문이다.
CREATE TABLE candidate_visa_process_steps (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  candidate_id   UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  step           visa_process_step NOT NULL,
  -- 이 절차가 목표하는 체류자격. track_visa_eligibility.target_visa_code에서 온다.
  -- 예: D-10 보유자가 요양보호 트랙으로 가면 E-7-2.
  target_visa_code VARCHAR(16) REFERENCES visa_statuses(code),
  entered_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- 판정은 사람이 하고 결과만 기록한다 (CLAUDE.md §6-1, §6-11).
  actor_id       UUID REFERENCES users(id),
  -- REJECTED면 사유가 반드시 있어야 한다. 이탈 시점만 세고 사유를 안 남기면
  -- 개선이 불가능하다 (docs/08 §7.4와 같은 이유).
  reason         TEXT,
  note           TEXT,
  CONSTRAINT visa_process_rejected_needs_reason
    CHECK (step <> 'REJECTED' OR reason IS NOT NULL)
);
CREATE INDEX idx_visa_process_candidate
  ON candidate_visa_process_steps(candidate_id, entered_at DESC);

-- 교육: MVP에서 LMS를 직접 만들지 않는다. 파트너가 올리는 진도율을 저장만 한다.
CREATE TABLE training_programs (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code          VARCHAR(64) UNIQUE NOT NULL,
  name          VARCHAR(200) NOT NULL,
  program_type  training_type NOT NULL,
  track_id      UUID REFERENCES tracks(id),
  -- partner_id의 FK는 partners 테이블 정의 이후 ALTER로 붙인다 (아래 6절 끝).
  -- 이 테이블(talent)이 partners(recruiting)보다 먼저 정의되므로 인라인 REFERENCES는 전방 참조가 된다.
  partner_id    UUID,
  total_hours   INT,
  is_mandatory  BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE training_enrollments (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  candidate_id  UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  program_id    UUID NOT NULL REFERENCES training_programs(id),
  status        enrollment_status NOT NULL DEFAULT 'ENROLLED',
  progress_rate NUMERIC(5,2) NOT NULL DEFAULT 0,   -- 0.00 ~ 100.00
  enrolled_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at  TIMESTAMPTZ,
  certificate_key VARCHAR(512),
  UNIQUE (candidate_id, program_id)
);

-- =============================================================================
-- 3. ORGANIZATION
-- =============================================================================
CREATE TABLE organizations (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                VARCHAR(200) NOT NULL,
  industry_id         UUID NOT NULL REFERENCES industries(id),
  org_type            VARCHAR(48) NOT NULL REFERENCES organization_types(code),
  -- 단순 라벨이 아니라 기능 분기 키로 사용한다.
  business_reg_no     VARCHAR(32),                 -- [PII 준함]
  address             VARCHAR(300),
  region              VARCHAR(120),
  contact_name        VARCHAR(120),                -- [PII]
  contact_phone       VARCHAR(32),                 -- [PII]
  verification_status verification_status NOT NULL DEFAULT 'PENDING',
  verified_at         TIMESTAMPTZ,
  contract_type       VARCHAR(64),                 -- SUCCESS_FEE | SUBSCRIPTION | HYBRID
  -- E-7-2 취업처 적격성. 학생을 모으기 전에 시설부터 확보해야 한다.
  -- 자격을 땄는데 심사 통과할 시설이 없으면 그 인력은 이탈하고,
  -- 첫 기수 실패는 대학과의 관계를 끊는다.
  e7_sponsor_status   VARCHAR(24) NOT NULL DEFAULT 'NOT_REVIEWED',
                      -- NOT_REVIEWED | ELIGIBLE | INELIGIBLE | CONDITIONAL
  e7_reviewed_at      TIMESTAMPTZ,
  e7_review_note      TEXT,
  domestic_employees  INT,                         -- 내국인 근로자 수. 영세 사업장은 E-7 난항
  dormitory_provided  BOOLEAN NOT NULL DEFAULT false,  -- 지방 시설 정착의 결정 요인
  korean_support_staff BOOLEAN NOT NULL DEFAULT false,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- 검증(VERIFIED) 전 기관은 후보자 실명·연락처를 조회할 수 없다. API scope에서 강제할 것.

CREATE TABLE organization_users (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_admin        BOOLEAN NOT NULL DEFAULT false,
  approved_at     TIMESTAMPTZ,
  UNIQUE (organization_id, user_id)
);

-- =============================================================================
-- 4. MATCHING
-- =============================================================================
CREATE TABLE jobs (
  id                 UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id    UUID NOT NULL REFERENCES organizations(id),
  track_id           UUID NOT NULL REFERENCES tracks(id),
  title              VARCHAR(200),
  headcount          INT NOT NULL DEFAULT 1,
  region             VARCHAR(120) NOT NULL,
  employment_type    VARCHAR(64),
  start_date         DATE,
  dorm_provided      BOOLEAN NOT NULL DEFAULT false,
  salary_min         INT,
  salary_max         INT,
  salary_visibility  salary_visibility NOT NULL DEFAULT 'AFTER_MATCH',
  min_experience_yrs NUMERIC(4,1) DEFAULT 0,
  language_level     VARCHAR(32),
  extra_conditions   TEXT,
  status             job_status NOT NULL DEFAULT 'DRAFT',
  opened_at          TIMESTAMPTZ,
  filled_at          TIMESTAMPTZ,
  created_by         UUID REFERENCES users(id),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_jobs_open ON jobs(status, region, track_id);

CREATE TABLE job_requirements (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id        UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  requirement   VARCHAR(200) NOT NULL,
  is_mandatory  BOOLEAN NOT NULL DEFAULT false   -- true면 매칭 하드 필터
);

-- 매칭 점수 규칙은 코드가 아니라 테이블로 관리한다. 운영 중 조정이 반드시 발생한다.
CREATE TABLE matching_rules (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  rule_code   VARCHAR(64) UNIQUE NOT NULL,  -- REGION | EXPERIENCE | TRAINING | DOCUMENT | CONDITION | LANGUAGE
  max_points  INT NOT NULL,
  params      JSONB NOT NULL DEFAULT '{}',
  is_active   BOOLEAN NOT NULL DEFAULT true,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE matches (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id         UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  candidate_id   UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  score          INT NOT NULL,
  reasons        JSONB NOT NULL DEFAULT '[]',   -- ["지역 조건 일치 (경기) +25", ...]
  missing        JSONB NOT NULL DEFAULT '[]',   -- ["한국어 3급 (권장 4급)"]
  computed_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (job_id, candidate_id)
);

-- 운영자의 추천/제외 판단 로그. Phase 4 AI 매칭의 학습 데이터가 된다.
-- 지금 수집하지 않으면 나중에 만들 수 없다.
CREATE TABLE match_logs (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id        UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  candidate_id  UUID NOT NULL REFERENCES candidates(id),
  action        VARCHAR(32) NOT NULL,   -- RECOMMENDED | EXCLUDED | VIEWED
  score_at_time INT,
  reason         TEXT,
  actor_id      UUID REFERENCES users(id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE applications (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id        UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  candidate_id  UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  status        application_status NOT NULL DEFAULT 'APPLIED',
  applied_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  status_changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),  -- 무응답 7일 SLA 잡 기준
  result_note   TEXT,
  UNIQUE (job_id, candidate_id)
);
CREATE INDEX idx_applications_sla ON applications(status, status_changed_at);

CREATE TABLE interviews (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  application_id UUID REFERENCES applications(id) ON DELETE CASCADE,
  job_id        UUID NOT NULL REFERENCES jobs(id),
  candidate_id  UUID NOT NULL REFERENCES candidates(id),
  scheduled_at  TIMESTAMPTZ,
  mode          VARCHAR(16),           -- ONSITE | VIDEO | PHONE
  interviewer   VARCHAR(120),
  status        interview_status NOT NULL DEFAULT 'REQUESTED',
  memo          TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- 4-1. RECRUITING — 파트너 · 채널 · 코호트
-- =============================================================================
-- 리크루팅을 스프레드시트로 관리하면 두 번째 기수에서 무너진다.
-- 핵심 측정값: 채널별 CAC, 단계별 이탈 '시점', 추천 전환율, 시설별 근속률.
-- "이탈률 20%"는 정보가 아니다. "교육 6주차 집중 이탈"이 대응 가능한 정보다.
-- 참조: docs/08_리크루팅_전략_및_D10_실행안.md

CREATE TYPE partner_type AS ENUM (
  'UNIVERSITY',       -- 대학 (취업지원처·국제교류처)
  'TRAINING_CENTER',  -- 요양보호사 교육기관 (지자체 지정)
  'LANGUAGE_SCHOOL',  -- 어학 교육기관 (국내·현지)
  'OVERSEAS_AGENCY',  -- 현지 송출·모집 파트너
  'LOCAL_GOVERNMENT', -- 광역·기초 지자체
  'CARE_AGENCY',      -- 간병 사업자
  'OTHER'
);

CREATE TYPE partner_status AS ENUM ('PROSPECT','IN_TALKS','MOU_SIGNED','ACTIVE','PAUSED','TERMINATED');

CREATE TABLE partners (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  partner_type   partner_type NOT NULL,
  name           VARCHAR(200) NOT NULL,
  country        VARCHAR(64) NOT NULL DEFAULT 'KR',
  region         VARCHAR(120),
  status         partner_status NOT NULL DEFAULT 'PROSPECT',
  contact_name   VARCHAR(120),               -- [PII]
  contact_email  VARCHAR(255),               -- [PII]
  contact_phone  VARCHAR(32),                -- [PII]
  -- 대학: 국제교류처와 취업지원처를 모두 잡아야 한다.
  -- 국제교류처가 유학생 데이터를 갖고, 취업지원처가 실적 압박을 받는다.
  secondary_dept VARCHAR(120),
  mou_signed_on  DATE,
  mou_expires_on DATE,
  -- 파트너 유형별 부가 정보 (예: 대학의 베트남 유학생 수, 양성대학 지정 여부,
  -- 교육원의 지자체 지정번호·실습처 보유 여부)
  attributes     JSONB NOT NULL DEFAULT '{}',
  note           TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- training_programs.partner_id 지연 FK (docs/08 §7.2)
-- 적격성 판정자 FK. 판정 테이블은 tracks 근처에 있어야 읽기 좋지만
-- users는 그보다 뒤에 만들어지므로 여기서 붙입니다.
ALTER TABLE track_visa_eligibility
  ADD CONSTRAINT track_visa_eligibility_decided_by_fkey
  FOREIGN KEY (decided_by) REFERENCES users(id);
ALTER TABLE visa_eligibility_decisions
  ADD CONSTRAINT visa_eligibility_decisions_decided_by_fkey
  FOREIGN KEY (decided_by) REFERENCES users(id);

ALTER TABLE training_programs
  ADD CONSTRAINT training_programs_partner_id_fkey
  FOREIGN KEY (partner_id) REFERENCES partners(id);
CREATE INDEX idx_partners_type ON partners(partner_type, status);

-- 세그먼트별 채널 마스터 (A~F). docs/08 §1 세그먼트 지도와 1:1 대응.
CREATE TABLE recruiting_channels (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code            VARCHAR(32) UNIQUE NOT NULL,  -- SEG_A_DIASPORA | SEG_D_D10_VN ...
  label_ko        VARCHAR(120) NOT NULL,
  track_id        UUID REFERENCES tracks(id),
  target_visa_code VARCHAR(16) REFERENCES visa_statuses(code),
  lead_time_months INT,
  target_headcount_3y INT,
  priority_order  INT NOT NULL DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT false,
  note            TEXT
);

-- 캠페인 단위. 비용을 기록해야 채널별 CAC가 나온다.
CREATE TABLE recruiting_campaigns (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  channel_id   UUID NOT NULL REFERENCES recruiting_channels(id),
  partner_id   UUID REFERENCES partners(id),
  name         VARCHAR(200) NOT NULL,
  campaign_type VARCHAR(32),        -- INFO_SESSION | ONLINE_AD | COMMUNITY | REFERRAL
  started_on   DATE,
  ended_on     DATE,
  cost_amount  INT NOT NULL DEFAULT 0,
  reach_count  INT,
  applicant_count INT
);

-- 기수(코호트). D-10 1기 등.
CREATE TABLE cohorts (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  channel_id     UUID NOT NULL REFERENCES recruiting_channels(id),
  code           VARCHAR(64) UNIQUE NOT NULL,   -- D10-VN-2026-1
  name           VARCHAR(200) NOT NULL,
  training_partner_id UUID REFERENCES partners(id),
  target_size    INT,
  starts_on      DATE,
  expected_placement_on DATE,
  status         VARCHAR(24) NOT NULL DEFAULT 'PLANNED', -- PLANNED|RECRUITING|IN_TRAINING|EXAM|PLACEMENT|CLOSED
  note           TEXT
);

-- 기수 × 후보자. 이탈 '시점'을 남기는 것이 이 테이블의 존재 이유다.
CREATE TABLE cohort_members (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cohort_id    UUID NOT NULL REFERENCES cohorts(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES candidates(id) ON DELETE CASCADE,
  -- APPLIED → SELECTED → IN_TRAINING → COMPLETED → EXAM_PASSED → PLACED
  --         ↘ DROPPED (어느 단계에서든)
  stage        VARCHAR(32) NOT NULL DEFAULT 'APPLIED',
  joined_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  dropped_at   TIMESTAMPTZ,
  dropped_stage VARCHAR(32),      -- 이탈 시점. 이게 없으면 개선할 수 없다.
  drop_reason  VARCHAR(200),
  placed_at    TIMESTAMPTZ,
  UNIQUE (cohort_id, candidate_id)
);
CREATE INDEX idx_cohort_stage ON cohort_members(cohort_id, stage);

-- =============================================================================
-- 4-2. QUALITY & SAFETY — 배치 전 게이트와 업무범위 통제
-- =============================================================================
-- 원칙: 국적을 거르는 것이 아니라 '검증되지 않은 인력'을 거른다.
--       nationality 컬럼은 통계·행정 목적에만 쓰고 매칭 로직에서 참조 금지.
--       언어 능력은 국적과 다르다 — 간병은 의사소통이 업무의 본질이므로
--       한국어 수준(TOPIK·KIIP)은 정당한 매칭 기준이다.
-- 참조: docs/07_품질관리_및_리스크통제.md

CREATE TYPE clearance_type AS ENUM (
  'IDENTITY_VERIFIED',      -- 신분 확인
  'CRIMINAL_RECORD_CLEAR',  -- 범죄경력 확인 (2년 갱신)
  'HEALTH_CHECK',           -- 건강진단 (1년 갱신)
  'VISA_ELIGIBLE',          -- 체류자격 적격 (외국인만)
  'MANDATORY_TRAINING',     -- 감염관리·인권·안전
  'SCOPE_TRAINING'          -- 업무범위 교육 — 대부분의 사고가 여기서 시작된다
);

CREATE TYPE clearance_result AS ENUM ('PENDING','PASS','FAIL','EXPIRED','N_A');

-- 인력 단위 배치 전 게이트. 유효기간이 있고 만료되면 신규 배정이 차단된다.
-- engagement_compliance_checks(배치 단위, 일회성)와 구분할 것.
CREATE TABLE worker_clearances (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  worker_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  clearance_type clearance_type NOT NULL,
  result         clearance_result NOT NULL DEFAULT 'PENDING',
  document_id    UUID,                    -- 근거 서류 (documents.id)
  checked_by     UUID REFERENCES users(id),
  checked_at     TIMESTAMPTZ,
  expires_on     DATE,                    -- NULL이면 무기한
  note           TEXT,
  UNIQUE (worker_user_id, clearance_type)
);
CREATE INDEX idx_clearance_expiry ON worker_clearances(expires_on)
  WHERE result = 'PASS';
-- 전 항목 PASS 여야 배치 가능. 운영자가 예외 처리할 수 없도록 시스템에서 강제한다.

-- 교대 패턴 마스터.
-- 24시간 입주(H24_LIVE_IN)를 기본값으로 두지 않는다.
-- 잠을 못 자는 사람에게 품질을 요구할 수 없으므로, 24시간 상주를 유지하는 한
-- 나머지 통제 장치도 결국 무너진다. 정부 급여화 시범사업도 3교대를 원칙으로 한다.
CREATE TABLE shift_patterns (
  code              VARCHAR(24) PRIMARY KEY,
  label_ko          VARCHAR(80) NOT NULL,
  hours_per_worker  NUMERIC(4,1) NOT NULL,
  workers_per_day   INT NOT NULL,
  -- true면 운영자 승인 없이 배정 불가
  requires_approval BOOLEAN NOT NULL DEFAULT false,
  is_recommended    BOOLEAN NOT NULL DEFAULT true,
  sort_order        INT NOT NULL DEFAULT 0,
  note              TEXT
);

-- 의료행위 감지 사전.
-- 자유 입력(care_requests.cautions, 상담 메시지)을 스캔한다.
-- 감지 시 '거절'이 아니라 '검토 트리거'다. 자동 거절하면 표현을 바꿔 우회하므로,
-- 사람이 개입해 보호자에게 설명하는 것이 목적이다.
CREATE TABLE restricted_act_keywords (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  keyword    VARCHAR(64) NOT NULL,
  category   VARCHAR(32) NOT NULL,   -- MEDICATION | INJECTION | SUCTION | WOUND_CARE | MEASUREMENT | OTHER
  severity   VARCHAR(16) NOT NULL DEFAULT 'HIGH',
  is_active  BOOLEAN NOT NULL DEFAULT true,
  UNIQUE (keyword)
);

-- =============================================================================
-- 5. CARE SERVICE  (V2 — 실매칭 운영이 안정된 뒤 착수)
-- =============================================================================
CREATE TABLE hospitals (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        VARCHAR(200) NOT NULL,
  address     VARCHAR(300),
  region      VARCHAR(120),
  is_partner  BOOLEAN NOT NULL DEFAULT false,   -- MVP는 화이트리스트만 노출
  active_caregivers INT NOT NULL DEFAULT 0
);
-- 공급(간병사)이 없는 병원을 노출하면 신청은 들어오고 배정은 안 되어 취소율이 오른다.

-- 서비스 카탈로그. 의료행위 및 간병사 법적 업무범위를 넘는 항목은 여기에 존재하지 않는다.
CREATE TABLE care_service_items (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code        VARCHAR(64) UNIQUE NOT NULL,  -- MEAL_SUPPORT | MOBILITY | HYGIENE | POSITION_CHANGE ...
  label_ko    VARCHAR(120) NOT NULL,
  is_active   BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE care_requests (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  requester_id    UUID NOT NULL REFERENCES users(id),   -- 보호자 또는 기관 담당자
  organization_id UUID REFERENCES organizations(id),    -- 기관 발주인 경우
  hospital_id     UUID REFERENCES hospitals(id),
  ward            VARCHAR(120),
  service_type    care_service_type NOT NULL,
  -- 교대 패턴. 미지정 시 서비스 유형에 따른 기본값을 적용하되,
  -- H24_LIVE_IN은 운영자 승인 전까지 배정되지 않는다.
  shift_pattern_code VARCHAR(24) REFERENCES shift_patterns(code),
  shift_approved_by  UUID REFERENCES users(id),
  -- 자유 입력 스캔 결과. 감지 시 status = OPS_REVIEW 로 전이.
  restricted_flags   TEXT[],
  start_at        TIMESTAMPTZ NOT NULL,
  end_at          TIMESTAMPTZ,
  support_items   TEXT[],                                -- care_service_items.code 참조
  mobility_level  VARCHAR(32),
  cautions        TEXT,                                  -- 자유 입력. 의료행위 요구 감지 시 OPS_REVIEW
  status          care_request_status NOT NULL DEFAULT 'DRAFT',
  sla_due_at      TIMESTAMPTZ,                           -- 요청 후 4시간
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_care_requests_board ON care_requests(status, sla_due_at);

CREATE TABLE caregivers (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id       UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  candidate_id  UUID REFERENCES candidates(id),   -- 후보자가 간병사를 겸하는 경우 연결
  display_code  VARCHAR(16) NOT NULL UNIQUE,
  experience_yrs NUMERIC(4,1) DEFAULT 0,
  rating_avg    NUMERIC(3,2),
  completed_count INT NOT NULL DEFAULT 0,
  is_active     BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE caregiver_availability (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  caregiver_id UUID NOT NULL REFERENCES caregivers(id) ON DELETE CASCADE,
  starts_at    TIMESTAMPTZ NOT NULL,
  ends_at      TIMESTAMPTZ NOT NULL,
  kind         VARCHAR(16) NOT NULL DEFAULT 'AVAILABLE'  -- AVAILABLE | BLOCKED
);
-- 이 데이터가 없으면 운영자가 전화로 확인하게 되고, '매칭 시간 단축'이라는 MVP 목표가 무너진다.

CREATE TABLE care_assignments (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  care_request_id UUID NOT NULL REFERENCES care_requests(id) ON DELETE CASCADE,
  caregiver_id   UUID NOT NULL REFERENCES caregivers(id),
  status         assignment_status NOT NULL DEFAULT 'OFFERED',
  offered_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at   TIMESTAMPTZ,
  confirmed_by   UUID REFERENCES users(id),       -- 운영자 확인. 초기에는 필수.
  -- 교대 배정: 같은 care_request에 복수 간병사가 시간대를 나눠 배정된다.
  shift_start_time TIME,
  shift_end_time   TIME,
  started_at     TIMESTAMPTZ,
  ended_at       TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ***** APPEND-ONLY *****
-- 근무 기록은 수정·삭제하지 않는다. 정정은 correction_of 로 새 행을 추가한다.
-- 정산 분쟁(DISPUTED)에서 유일한 근거가 되는 테이블이다.
CREATE TABLE service_logs (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  assignment_id  UUID NOT NULL REFERENCES care_assignments(id) ON DELETE CASCADE,
  log_type       VARCHAR(32) NOT NULL,   -- SHIFT_START | SHIFT_END | SUPPORT | NOTE | ISSUE
  item_code      VARCHAR(64),            -- care_service_items.code
  occurred_at    TIMESTAMPTZ NOT NULL,
  check_method   check_method,
  geo_point      JSONB,                  -- GPS 사용 시에만. 동의 없으면 NULL.
  memo           TEXT,
  correction_of  UUID REFERENCES service_logs(id),
  created_by     UUID REFERENCES users(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_service_logs_assignment ON service_logs(assignment_id, occurred_at);

-- append-only를 **DB가 강제한다**.
--
-- 애플리케이션에 PATCH·DELETE 엔드포인트를 두지 않는 것만으로는 부족하다.
-- psql로 직접 붙으면 그대로 고쳐지고, 그러면 "근무시간 분쟁에서 유일한 근거"는
-- 근거가 아니다. 운영 중 사고가 나서 급하게 고치고 싶어지는 순간이 반드시 오는데,
-- 그때 막아 주는 것은 규칙이 아니라 트리거다.
--
-- 정정은 correction_of로 새 행을 넣는다 (§5.4).
CREATE OR REPLACE FUNCTION forbid_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION
    '% 은(는) append-only 테이블입니다. 정정은 correction_of로 새 행을 추가하세요 (CLAUDE.md §5.4)',
    TG_TABLE_NAME
    USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER service_logs_append_only
  BEFORE UPDATE OR DELETE ON service_logs
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

-- 가격 산정 규칙. 예약 시점 견적과 종료 후 확정 청구가 같은 규칙을 쓴다.
CREATE TABLE pricing_rules (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  service_type  care_service_type NOT NULL,
  region        VARCHAR(120),
  base_rate     INT NOT NULL,
  night_rate_pct   NUMERIC(5,2) DEFAULT 0,
  holiday_rate_pct NUMERIC(5,2) DEFAULT 0,
  platform_fee_pct NUMERIC(5,2) DEFAULT 0,
  effective_from DATE NOT NULL,
  effective_to   DATE
);

-- =============================================================================
-- 5-2. COMPLIANCE — 국외이전 · 계약 · 보존정책
-- =============================================================================
-- 참조: docs/11_개인정보_보안_및_컴플라이언스.md

-- 국외이전 이력. 현지 파트너에 선발 결과·교육 이력을 회신하는 것도 국외이전이다.
CREATE TABLE overseas_transfers (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subject_user_id UUID NOT NULL REFERENCES users(id),
  partner_id     UUID REFERENCES partners(id),
  country        VARCHAR(64) NOT NULL,
  purpose        VARCHAR(200) NOT NULL,
  transferred_fields TEXT[] NOT NULL,  -- 이전 항목. 건강·범죄경력은 이전 금지.
  consent_id     UUID REFERENCES consent_records(id),
  transferred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  actor_id       UUID REFERENCES users(id)
);
CREATE INDEX idx_overseas_subject ON overseas_transfers(subject_user_id, transferred_at DESC);

-- 기관·파트너 계약. 아키텍처 문서에는 있었으나 스키마에 누락되어 있던 테이블.
CREATE TABLE contracts (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  counterparty_type VARCHAR(24) NOT NULL,  -- ORGANIZATION | PARTNER | INSURER
  organization_id UUID REFERENCES organizations(id),
  partner_id      UUID REFERENCES partners(id),
  contract_no     VARCHAR(64) UNIQUE,
  contract_type   VARCHAR(48) NOT NULL,    -- SUCCESS_FEE | SUBSCRIPTION | SERVICE_SUPPLY | DATA_PROCESSING
  -- 요율·수수료 구조. 채널마다 다르므로 JSONB로 둔다.
  pricing_terms   JSONB NOT NULL DEFAULT '{}',
  -- 개인정보 처리 위탁·국외이전 조항 포함 여부. 파트너 계약의 필수 확인 항목.
  includes_dpa    BOOLEAN NOT NULL DEFAULT false,
  effective_from  DATE NOT NULL,
  effective_to    DATE,
  status          VARCHAR(24) NOT NULL DEFAULT 'DRAFT',  -- DRAFT|ACTIVE|EXPIRED|TERMINATED
  file_key        VARCHAR(512),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 데이터 유형별 보존기간. 파기 배치 잡의 기준값.
-- 수동 파기 정책은 지켜지지 않는다. 반드시 자동화할 것.
CREATE TABLE data_retention_policies (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  data_type      VARCHAR(64) UNIQUE NOT NULL,
  retention_days INT,                      -- NULL이면 영구 보존
  purge_strategy VARCHAR(32) NOT NULL,     -- HARD_DELETE | ANONYMIZE | ARCHIVE
  legal_basis    VARCHAR(200),
  is_active      BOOLEAN NOT NULL DEFAULT true
);

-- =============================================================================
-- 6. OPS
-- =============================================================================
CREATE TABLE support_tickets (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_type   ticket_type NOT NULL,
  severity      VARCHAR(16) NOT NULL DEFAULT 'NORMAL',  -- LOW | NORMAL | HIGH
  reporter_id   UUID REFERENCES users(id),
  reporter_role user_role,
  related_type  VARCHAR(32),          -- CARE_REQUEST | JOB | ORGANIZATION | CANDIDATE
  related_id    UUID,
  assignee_id   UUID REFERENCES users(id),
  status        ticket_status NOT NULL DEFAULT 'NEW',
  sla_due_at    TIMESTAMPTZ,          -- SAFETY_INCIDENT/HARASSMENT/SCOPE_VIOLATION = 4시간
  resolution    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at   TIMESTAMPTZ
);

CREATE TABLE notification_templates (
  id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code      VARCHAR(64) NOT NULL,
  locale    VARCHAR(8)  NOT NULL,
  channel   VARCHAR(16) NOT NULL,   -- PUSH | SMS | ALIMTALK | EMAIL
  title     VARCHAR(200),
  body      TEXT NOT NULL,
  UNIQUE (code, locale, channel)
);

CREATE TABLE notifications (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code       VARCHAR(64) NOT NULL,
  payload    JSONB NOT NULL DEFAULT '{}',
  channel    VARCHAR(16) NOT NULL,
  sent_at    TIMESTAMPTZ,
  read_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ***** APPEND-ONLY *****
-- 개인정보 조회, 상태 변경, 정산 관련 행위를 전량 적재한다.
CREATE TABLE audit_logs (
  id          BIGSERIAL PRIMARY KEY,
  actor_id    UUID REFERENCES users(id),
  actor_role  user_role,
  action      VARCHAR(64) NOT NULL,   -- VIEW_PII | STATUS_CHANGE | EXPORT | ASSIGN | SETTLE
  target_type VARCHAR(32),
  target_id   UUID,
  before      JSONB,
  after       JSONB,
  ip_address  INET,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_target ON audit_logs(target_type, target_id, created_at DESC);

-- 감사 로그도 append-only다 (§5.4).
--
-- 여기가 고쳐지면 "누가 언제 무엇을 봤는가"가 무너진다. 개인정보 조회 이력은
-- 분쟁·감사에서 우리를 방어하는 유일한 기록이고, 고칠 수 있는 기록은 방어가
-- 되지 않는다 (docs/11 §5).
CREATE TRIGGER audit_logs_append_only
  BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION forbid_mutation();

-- =============================================================================
-- 7. ENGAGEMENT — 고용·계약 모델
-- =============================================================================
-- 결정: 직접고용을 우선 검토하되, 향후 중개로 전환 가능한 구조로 설계한다.
-- 참조: docs/04_고용모델_및_버티컬확장.md §2~3
--
-- 핵심 설계 결정 ─ 고용 모델은 '배치 단위(engagement)'에 붙는다.
--   전역 설정이나 조직 단위가 아니다. 이유는 셋이다.
--     1) 전환기에는 기존 건(직접고용)과 신규 건(중개)이 병존해야 한다.
--     2) 지역·트랙·기관별로 다른 모델이 합리적일 수 있다.
--     3) 전역 플래그로 두면 전환 시점에 과거 정산 이력이 전부 깨진다.
--
-- 전환은 UPDATE가 아니라 신규 engagement 생성이다.
--   기존 건은 ENDED 처리하고, 새 건에 previous_engagement_id로 연결한다.
--   실제로도 근로계약 종료 + 신규 계약 체결이라는 법적 절차가 수반된다.
-- =============================================================================

CREATE TYPE engagement_model AS ENUM (
  'DIRECT_EMPLOYMENT',  -- CARELINK가 근로계약 당사자(사용자). 4대보험·퇴직금·근로시간 규제 적용
  'DELEGATION',         -- 위탁·용역. 사업소득 원천징수
  'BROKERAGE'           -- 순수 중개. 기관↔인력 직접 계약, 플랫폼은 수수료만 수취
);

CREATE TYPE engagement_status AS ENUM (
  'DRAFT','CONTRACT_PENDING','ACTIVE','SUSPENDED','ENDED','TERMINATED'
);

-- 배치 1건 = 인력 × 기관 × 기간
CREATE TABLE engagements (
  id                     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  worker_user_id         UUID NOT NULL REFERENCES users(id),
  candidate_id           UUID REFERENCES candidates(id),
  organization_id        UUID NOT NULL REFERENCES organizations(id),
  track_id               UUID NOT NULL REFERENCES tracks(id),
  job_id                 UUID REFERENCES jobs(id),
  model                  engagement_model NOT NULL,
  status                 engagement_status NOT NULL DEFAULT 'DRAFT',
  started_on             DATE,
  ended_on               DATE,
  end_reason             VARCHAR(120),
  previous_engagement_id UUID REFERENCES engagements(id),  -- 모델 전환 시 연결

  -- ── 근로자파견 (2026-08-21 U1·U2 확정) ────────────────────────────────
  -- 노무사 검토 결과 해당 직군은 파견 허용 업무이고 파견사업 허가를 보유합니다.
  -- CARELINK가 파견사업주, 기관이 사용사업주입니다.
  --
  -- 파견법 §6은 동일 사용사업주에게 동일 근로자를 **2년 초과** 파견하지
  -- 못하게 합니다. 초과하면 사용사업주(병원)에게 **직접고용 의무**가 발생해
  -- 계약 관계가 통째로 뒤집힙니다. 그래서 개시일을 별도 컬럼으로 둡니다 —
  -- started_on은 배치 시작일이고, 파견 기간은 같은 인력×기관 조합의 **누적**이라
  -- 배치 한 건의 기간과 다릅니다.
  is_dispatch            BOOLEAN NOT NULL DEFAULT false,
  dispatch_started_on    DATE,
  -- 파견사업 허가번호. 파견 계약서에 기재 의무가 있습니다.
  dispatch_permit_no     VARCHAR(64),
  CONSTRAINT engagements_dispatch_needs_start
    CHECK (NOT is_dispatch OR dispatch_started_on IS NOT NULL),

  created_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- 2년 제한 조회는 인력×기관 조합으로 들어옵니다.
CREATE INDEX idx_engagements_dispatch
  ON engagements(worker_user_id, organization_id, dispatch_started_on)
  WHERE is_dispatch;
CREATE INDEX idx_engagements_worker ON engagements(worker_user_id, status);
CREATE INDEX idx_engagements_org ON engagements(organization_id, status);

-- DIRECT_EMPLOYMENT 전용. 다른 모델에서는 행이 생성되지 않는다.
CREATE TABLE employment_contracts (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  engagement_id    UUID NOT NULL REFERENCES engagements(id) ON DELETE CASCADE,
  contract_no      VARCHAR(64) UNIQUE,
  contract_type    VARCHAR(32) NOT NULL,   -- PERMANENT | FIXED_TERM | PART_TIME
  wage_type        VARCHAR(16) NOT NULL,   -- MONTHLY | DAILY | HOURLY
  wage_amount      INT NOT NULL,
  contractual_hours_per_week NUMERIC(5,2),
  break_policy     TEXT,
  probation_months INT NOT NULL DEFAULT 0,
  -- 4대보험 가입 여부·취득일. 직접고용에서만 채워진다.
  social_insurance JSONB NOT NULL DEFAULT '{}',
  signed_at        TIMESTAMPTZ,
  file_key         VARCHAR(512),           -- 계약서 원본 (presigned URL로만 접근)
  effective_from   DATE NOT NULL,
  effective_to     DATE
);

-- 배치 전 통과해야 하는 컴플라이언스 게이트.
-- 직접고용의 최대 리스크는 '도급인가 파견인가' 판정이므로, 이를 워크플로로 강제한다.
CREATE TABLE engagement_compliance_checks (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  engagement_id UUID NOT NULL REFERENCES engagements(id) ON DELETE CASCADE,
  check_code    VARCHAR(64) NOT NULL,
  -- DISPATCH_LAW_REVIEW  도급/파견 판단 및 지휘·명령권 확인
  -- WORKING_HOURS        근로시간·휴게 규정 적용 방식 확인
  -- SOCIAL_INSURANCE     4대보험 취득 처리
  -- VISA_ELIGIBILITY     체류·고용 가능 여부 (사람이 판정한 결과 기록)
  -- CONTRACT_SIGNED      계약서 서명 완료
  result        VARCHAR(16) NOT NULL DEFAULT 'PENDING',  -- PENDING | PASS | FAIL | N_A
  checked_by    UUID REFERENCES users(id),
  checked_at    TIMESTAMPTZ,
  note          TEXT,
  UNIQUE (engagement_id, check_code)
);

-- ***** APPEND-ONLY *****
-- 근무 원장. service_logs(원시 이벤트)를 집계하고 운영자가 승인한 결과가 여기 쌓인다.
-- 정산의 유일한 입력값이며, 고용 모델과 무관하게 동일한 구조를 쓴다.
-- 직접고용에서는 소정·야간·연장·휴일을 분 단위로 분리해야 급여 계산이 가능하다.
CREATE TABLE work_records (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  engagement_id    UUID NOT NULL REFERENCES engagements(id),
  source_type      VARCHAR(32) NOT NULL,   -- CARE_ASSIGNMENT | PLACEMENT_SHIFT
  source_id        UUID,
  work_date        DATE NOT NULL,
  started_at       TIMESTAMPTZ,
  ended_at         TIMESTAMPTZ,
  break_minutes    INT NOT NULL DEFAULT 0,
  normal_minutes   INT NOT NULL DEFAULT 0,
  night_minutes    INT NOT NULL DEFAULT 0,
  overtime_minutes INT NOT NULL DEFAULT 0,
  holiday_minutes  INT NOT NULL DEFAULT 0,
  approved_by      UUID REFERENCES users(id),
  approved_at      TIMESTAMPTZ,
  correction_of    UUID REFERENCES work_records(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_work_records_engagement ON work_records(engagement_id, work_date);

-- 기관 청구. 고용 모델과 무관하게 동일하게 계산된다.
-- (기관에 얼마를 받는지는 인력과의 계약 형태와 상관없다)
CREATE TABLE billing_lines (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID NOT NULL REFERENCES organizations(id),
  engagement_id   UUID REFERENCES engagements(id),
  work_record_id  UUID REFERENCES work_records(id),
  line_type       VARCHAR(32) NOT NULL,  -- SERVICE | PLACEMENT_FEE | SUBSCRIPTION | SURCHARGE
  description     VARCHAR(200),
  quantity        NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit_amount     INT NOT NULL,
  amount          INT NOT NULL,
  period_start    DATE,
  period_end      DATE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 인력 지급. 고용 모델에 따라 성격이 달라진다.
--   DIRECT_EMPLOYMENT → WAGE (급여). payroll_items와 연결.
--   DELEGATION        → SERVICE_FEE (용역대가). 사업소득 원천징수.
--   BROKERAGE         → 행이 생성되지 않는다. 기관이 인력에게 직접 지급한다.
CREATE TABLE payout_lines (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  engagement_id  UUID NOT NULL REFERENCES engagements(id),
  work_record_id UUID REFERENCES work_records(id),
  payout_type    VARCHAR(32) NOT NULL,  -- WAGE | SERVICE_FEE | ALLOWANCE | DEDUCTION
  description    VARCHAR(200),
  amount         INT NOT NULL,
  period_start   DATE,
  period_end     DATE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- 8. PAYROLL — DIRECT_EMPLOYMENT 전용 (V3)
-- =============================================================================
-- ⚠️ 구현 착수 전 확인이 필요하다. docs/04 §8 참조.
--    · 기관 현장 배치가 도급인지 근로자파견인지 (지휘·명령권 실질 판단)
--    · 해당 직군이 근로자파견 허용 업무인지 / 근로자공급사업 허가 필요 여부
--    · 24시간 간병의 근로시간·휴게 규정 적용 방식
--    위 답이 나오기 전에는 테이블만 두고 계산 로직을 구현하지 않는다.
-- =============================================================================
CREATE TABLE payroll_periods (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  period_ym   CHAR(7) NOT NULL,          -- '2026-09'
  status      VARCHAR(24) NOT NULL DEFAULT 'OPEN',  -- OPEN | CALCULATED | CONFIRMED | PAID
  closed_at   TIMESTAMPTZ,
  UNIQUE (period_ym)
);

CREATE TABLE payroll_items (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payroll_period_id UUID NOT NULL REFERENCES payroll_periods(id),
  engagement_id     UUID NOT NULL REFERENCES engagements(id),
  base_pay          INT NOT NULL DEFAULT 0,
  overtime_pay      INT NOT NULL DEFAULT 0,
  night_pay         INT NOT NULL DEFAULT 0,
  holiday_pay       INT NOT NULL DEFAULT 0,
  allowances        JSONB NOT NULL DEFAULT '{}',
  deductions        JSONB NOT NULL DEFAULT '{}',   -- 4대보험, 소득세, 지방소득세
  gross_amount      INT NOT NULL DEFAULT 0,
  net_amount        INT NOT NULL DEFAULT 0,
  paid_at           TIMESTAMPTZ,
  UNIQUE (payroll_period_id, engagement_id)
);

