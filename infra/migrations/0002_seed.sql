-- 이 파일은 docs/03_schema.sql에서 생성됩니다. 직접 편집하지 마세요.
-- 스키마의 단일 출처는 docs/03_schema.sql입니다 (docs/02 서두).
-- 재생성: pnpm db:split

-- =============================================================================
-- 9. 시드 데이터 (개발용 최소 세트)
-- =============================================================================
INSERT INTO matching_rules (rule_code, max_points, params) VALUES
  ('REGION',     25, '{"exact":25,"province":15}'),
  ('EXPERIENCE', 20, '{"meets":20,"below":0}'),
  ('TRAINING',   20, '{"mandatory_completed":20}'),
  ('DOCUMENT',   15, '{"all_verified":15,"partial":7}'),
  ('CONDITION',  12, '{"dorm_match":6,"employment_type_match":6}'),
  ('LANGUAGE',    8, '{"meets":8,"one_below":4}');

-- 산업 · 트랙 --------------------------------------------------------------
-- MVP는 CARE 산업의 3개 트랙을 전부 운영한다. 나머지 산업은 구조만 열어 두고
-- is_active = false 로 둔다(코드 배포 없이 활성화 가능).
INSERT INTO industries (code, label_ko, is_active, sort_order) VALUES
  ('CARE',         '돌봄 · 의료지원', true,  1),
  ('FOOD_SERVICE', '요리 · 외식',     false, 2),
  ('AGRICULTURE',  '농업',            false, 3),
  ('BEAUTY',       '미용',            false, 4);

INSERT INTO tracks (industry_id, code, label_ko, label_vi, qualification_type, visa_types, sort_order)
SELECT i.id, t.code, t.ko, t.vi, t.qt, t.visa, t.ord
FROM industries i
JOIN (VALUES
  -- 공급 확보는 무자격 진입이 가능한 HOSPITAL_CAREGIVER부터 시작한다.
  -- 그 근무 기록이 다른 트랙으로 가는 '검증된 경력'이 된다.
  ('CARE','HOSPITAL_CAREGIVER',  '병원 간병',   'Chăm sóc bệnh viện', 'TRAINING_REQUIRED', ARRAY['H-2','F-4','F-5','F-6'], 1),
  ('CARE','CARE_WORKER',         '요양보호',     'Điều dưỡng dài hạn', 'NATIONAL_LICENSE',  ARRAY['H-2','F-4','F-5','F-6'], 2),
  -- HEALTHCARE_ASSISTANT는 자격 취득 리드타임이 가장 길다.
  -- 매칭 성사가 아니라 '자격 경로가 굴러가는가'를 KPI로 본다.
  ('CARE','HEALTHCARE_ASSISTANT','의료지원',     'Trợ lý y tế',        'NATIONAL_LICENSE',  ARRAY['F-4','F-5','F-6'],       3)
) AS t(ind, code, ko, vi, qt, visa, ord) ON t.ind = i.code;

INSERT INTO organization_types (code, industry_id, label_ko)
SELECT t.code, i.id, t.ko FROM industries i
JOIN (VALUES
  ('CARE','HOSPITAL',         '병원'),
  ('CARE','CLINIC',           '의원'),
  ('CARE','NURSING_HOSPITAL', '요양병원'),
  ('CARE','NURSING_HOME',     '요양시설'),
  ('CARE','HOME_CARE',        '재가기관'),
  ('CARE','CARE_AGENCY',      '간병사업자')
) AS t(ind, code, ko) ON t.ind = i.code;

-- 트랙별 요구사항. 화면은 하나이고 요구사항만 여기서 달라진다.
INSERT INTO track_requirements (track_id, kind, ref_code, is_mandatory, note)
SELECT tr.id, v.kind, v.ref, v.mand, v.note
FROM tracks tr
JOIN (VALUES
  ('HOSPITAL_CAREGIVER',  'DOCUMENT','IDENTITY',      true,  NULL),
  ('HOSPITAL_CAREGIVER',  'DOCUMENT','HEALTH',        true,  '발급 6개월 이내'),
  ('HOSPITAL_CAREGIVER',  'TRAINING','MANDATORY_BASE',true,  '감염관리 · 인권 · 안전'),
  ('CARE_WORKER',         'DOCUMENT','IDENTITY',      true,  NULL),
  ('CARE_WORKER',         'DOCUMENT','HEALTH',        true,  NULL),
  ('CARE_WORKER',         'LICENSE', 'CARE_WORKER_LICENSE', true, '자격 보유 여부는 사람이 확인하고 결과만 기록'),
  ('CARE_WORKER',         'TRAINING','MANDATORY_BASE',true,  NULL),
  ('HEALTHCARE_ASSISTANT','DOCUMENT','IDENTITY',      true,  NULL),
  ('HEALTHCARE_ASSISTANT','DOCUMENT','EDUCATION',     true,  NULL),
  ('HEALTHCARE_ASSISTANT','DOCUMENT','HEALTH',        true,  NULL),
  ('HEALTHCARE_ASSISTANT','LICENSE', 'HC_ASSISTANT_LICENSE', true, '국가시험 경로. 취득까지 리드타임 최장'),
  ('HEALTHCARE_ASSISTANT','TRAINING','MANDATORY_BASE',true,  NULL)
) AS v(track, kind, ref, mand, note) ON v.track = tr.code;

-- 매칭 가중치 오버라이드: 의료지원 트랙은 자격·서류 비중을 높인다.
INSERT INTO track_matching_weights (track_id, rule_code, max_points)
SELECT tr.id, v.rule, v.pts FROM tracks tr
JOIN (VALUES
  ('HEALTHCARE_ASSISTANT','DOCUMENT', 25),
  ('HEALTHCARE_ASSISTANT','EXPERIENCE',15),
  ('HOSPITAL_CAREGIVER',  'TRAINING', 25),
  ('HOSPITAL_CAREGIVER',  'EXPERIENCE',15)
) AS v(track, rule, pts) ON v.track = tr.code;

-- 체류자격 마스터 (2026.08 기준) ----------------------------------------------
INSERT INTO visa_statuses (code, label_ko, work_restriction, is_ethnic_korean, new_issuance_stopped, stopped_on, note) VALUES
  ('F-5',  '영주',        'NONE',         false, false, NULL, '취업 제한 없음. 국적 무관'),
  ('F-6',  '결혼이민',    'NONE',         false, false, NULL, '취업 제한 없음. 베트남 출신 다수 — 통역·멘토 자산'),
  ('F-2',  '거주',        'PARTIAL',      false, false, NULL, 'F-2-R은 지역·업종 조건 있음'),
  ('F-4',  '재외동포',    'PARTIAL',      true,  false, NULL, '단순노무 제한. 간병 업무 해당 여부 확인 필요 → docs/06 §4'),
  ('H-2',  '방문취업',    'PARTIAL',      true,  true,  DATE '2026-02-12', '2026-02-12 신규 발급 중단, F-4로 통합. 기존자는 체류기간까지 유효'),
  ('E-7-2','특정활동(요양보호사)','OCCUPATION', false, false, NULL, '노인의료복지시설 한정. 병원 간병 불가'),
  ('D-2',  '유학',        'NONE_ALLOWED', false, false, NULL, '시간제취업 별도 허가. 요양보호사 교육 수강은 가능'),
  ('D-10', '구직',        'NONE_ALLOWED', false, false, NULL, '국내 전문대 이상 졸업자는 요양보호사 교육 수강 가능'),
  ('E-9',  '비전문취업',  'INDUSTRY',     false, false, NULL, '간병·요양은 허용 업종 아님. 2026 쿼터 8만(전년비 -38%)');

-- 트랙 × 비자 허용 매트릭스 ---------------------------------------------------
INSERT INTO track_visa_eligibility (track_id, visa_code, eligibility, target_visa_code, lead_time_months, note)
SELECT tr.id, v.visa, v.elig, v.target, v.lead, v.note
FROM tracks tr
JOIN (VALUES
  -- 병원 간병: 신규 유입 경로 없음. 국내 정착 인력만 가능.
  ('HOSPITAL_CAREGIVER','F-5', 'ALLOWED',              NULL,    0,  NULL),
  ('HOSPITAL_CAREGIVER','F-6', 'ALLOWED',              NULL,    0,  NULL),
  ('HOSPITAL_CAREGIVER','F-2', 'ALLOWED',              NULL,    0,  'F-2-R은 지역 조건 확인'),
  ('HOSPITAL_CAREGIVER','F-4', 'PENDING_CONFIRMATION', NULL,    0,  '단순노무 제한 해당 여부 미확정. 자동 배정 차단'),
  ('HOSPITAL_CAREGIVER','H-2', 'ALLOWED',              NULL,    0,  '기존 체류자 한정. 신규 없음'),
  ('HOSPITAL_CAREGIVER','E-9', 'NOT_ALLOWED',          NULL,    NULL, NULL),
  ('HOSPITAL_CAREGIVER','D-2', 'NOT_ALLOWED',          NULL,    NULL, NULL),
  ('HOSPITAL_CAREGIVER','D-10','NOT_ALLOWED',          NULL,    NULL, NULL),
  ('HOSPITAL_CAREGIVER','E-7-2','NOT_ALLOWED',         NULL,    NULL, 'E-7-2는 노인의료복지시설 한정'),
  -- 요양보호: 유일하게 신규 유입이 열린 트랙
  ('CARE_WORKER','F-5',  'REQUIRES_QUALIFICATION', NULL,    5,  '320시간 교육 + 국가시험'),
  ('CARE_WORKER','F-6',  'REQUIRES_QUALIFICATION', NULL,    5,  NULL),
  ('CARE_WORKER','F-2',  'REQUIRES_QUALIFICATION', NULL,    5,  NULL),
  ('CARE_WORKER','F-4',  'REQUIRES_QUALIFICATION', NULL,    5,  '자격 취득 시 단순노무 논란 해소'),
  ('CARE_WORKER','H-2',  'REQUIRES_QUALIFICATION', NULL,    5,  NULL),
  ('CARE_WORKER','D-10', 'REQUIRES_CONVERSION',    'E-7-2', 9,  '국내 전문대 이상 졸업자. 즉시 착수 가능한 최단 경로'),
  ('CARE_WORKER','D-2',  'REQUIRES_CONVERSION',    'E-7-2', 24, '양성대학 24학점 특례 또는 졸업 후 D-10 경유'),
  ('CARE_WORKER','E-9',  'NOT_ALLOWED',            NULL,    NULL, '준전문인력 분류로 불가'),
  -- 의료지원: 국가시험 리드타임 최장
  ('HEALTHCARE_ASSISTANT','F-5', 'REQUIRES_QUALIFICATION', NULL, 18, NULL),
  ('HEALTHCARE_ASSISTANT','F-6', 'REQUIRES_QUALIFICATION', NULL, 18, NULL),
  ('HEALTHCARE_ASSISTANT','F-2', 'REQUIRES_QUALIFICATION', NULL, 18, NULL),
  ('HEALTHCARE_ASSISTANT','F-4', 'REQUIRES_QUALIFICATION', NULL, 18, NULL),
  ('HEALTHCARE_ASSISTANT','E-9', 'NOT_ALLOWED',            NULL, NULL, NULL)
) AS v(track, visa, elig, target, lead, note) ON v.track = tr.code;

-- 데이터 보존정책 -------------------------------------------------------------
INSERT INTO data_retention_policies (data_type, retention_days, purge_strategy, legal_basis) VALUES
  ('CONSENT_RECORD',      NULL, 'ARCHIVE',     '분쟁 방어 — 영구 보존'),
  ('WORK_RECORD',         1095, 'ARCHIVE',     '임금채권 시효 — 노무 검토 후 확정'),
  ('PAYROLL',             1825, 'ARCHIVE',     '세무 5년'),
  ('DOCUMENT_IDENTITY',    365, 'HARD_DELETE', '계약 종료 후 1년'),
  ('DOCUMENT_CRIMINAL',      0, 'HARD_DELETE', '확인 즉시 원본 파기, 결과값만 보존'),
  ('DOCUMENT_HEALTH',        0, 'HARD_DELETE', '확인 즉시 원본 파기, 판정 결과만 보존'),
  ('INCIDENT',            1825, 'ARCHIVE',     '삭제 불가'),
  ('WITHDRAWN_USER',        30, 'ANONYMIZE',   '분쟁 진행 시 예외'),
  ('AUDIT_LOG',           1095, 'ARCHIVE',     NULL);

-- 리크루팅 채널 (세그먼트 A~F) --------------------------------------------------
-- 착수 순서는 규모가 아니라 순환 구조로 정한다.
--   A·B·C(국내 존재 인력) → 현금흐름 · MVP 검증
--   D(D-10)              → E-7-2 실적 = 대학·지자체·현지 파트너 협상 레퍼런스
--   E(현지 고려인)        → 규모 확대
--   F(양성대학)          → 장기 해자
INSERT INTO recruiting_channels (code, label_ko, target_visa_code, lead_time_months, target_headcount_3y, priority_order, is_active, note)
VALUES
  ('SEG_A_DIASPORA_KR', '국내 동포 (F-4)',            'F-4',  1,  NULL, 1, true,  '최대 모수. 간병사·요양보호사 양쪽 가능'),
  ('SEG_B_MARRIAGE',    '결혼이민자 (F-6)',           'F-6',  3,  400,  2, true,  '주간·재가 중심. 육아 부담으로 24시간 배치 어려움. 통역·멘토 자산'),
  ('SEG_C_KORYO_KR',    '국내 고려인 (F-4)',          'F-4',  5,  250,  3, true,  '안산·광주 커뮤니티 거점'),
  ('SEG_D_D10_VN',      '국내 대졸 베트남 (D-10)',    'D-10', 9,  200,  4, true,  '규모보다 속도와 레퍼런스. 메시지는 정착 경로'),
  ('SEG_E_KORYO_CIS',   '현지 고려인 신규 (F-4)',     'F-4',  12, 300,  5, false, '비자는 열림, 병목은 한국어 교육'),
  ('SEG_F_VN_COLLEGE',  '베트남 양성대학 (D-2)',      'D-2',  30, NULL, 6, false, '2~3년 장기 자산');

-- 교대 패턴 -------------------------------------------------------------------
INSERT INTO shift_patterns (code, label_ko, hours_per_worker, workers_per_day, requires_approval, is_recommended, sort_order, note) VALUES
  ('H8_3SHIFT',  '8시간 3교대',  8,  3, false, true,  1, '급여화 시범사업 원칙. 권장 기본값'),
  ('H12_2SHIFT', '12시간 2교대', 12, 2, false, true,  2, NULL),
  ('DAY',        '주간 전담',    10, 1, false, true,  3, NULL),
  ('NIGHT',      '야간 전담',    12, 1, false, true,  4, '야간수당 별도'),
  ('H24_LIVE_IN','24시간 상주',  24, 1, true,  false, 9,
   '비권장. 운영자 승인 필수. 직접고용 인력에게는 근로시간 규정 검토 완료 전 배정 금지');

-- 의료행위 감지 사전 (초기 세트. 운영하며 확장할 것) ---------------------------
INSERT INTO restricted_act_keywords (keyword, category) VALUES
  ('투약','MEDICATION'),('약 먹여','MEDICATION'),('약 챙겨','MEDICATION'),
  ('인슐린','INJECTION'),('주사','INJECTION'),('링거','INJECTION'),('수액','INJECTION'),
  ('석션','SUCTION'),('가래 제거','SUCTION'),('흡인','SUCTION'),
  ('욕창','WOUND_CARE'),('드레싱','WOUND_CARE'),('상처 소독','WOUND_CARE'),
  ('혈당','MEASUREMENT'),('혈당 체크','MEASUREMENT'),('채혈','MEASUREMENT'),
  ('관장','OTHER'),('도뇨','OTHER'),('소변줄','OTHER'),('콧줄','OTHER'),('경관영양','OTHER');
-- 주의: 감지는 자동 거절이 아니라 OPS_REVIEW 전이 트리거다.

INSERT INTO care_service_items (code, label_ko) VALUES
  ('MEAL_SUPPORT',    '식사 도움'),
  ('MOBILITY',        '이동 · 보행 보조'),
  ('HYGIENE',         '세면 · 위생 지원'),
  ('POSITION_CHANGE', '체위 변경'),
  ('DAILY_SUPPORT',   '일상생활 지원'),
  ('COMPANION',       '말벗 · 정서 지원');
-- 주의: 투약 · 주사 · 석션 · 처치 등 의료행위 항목은 이 목록에 추가하지 않는다.
