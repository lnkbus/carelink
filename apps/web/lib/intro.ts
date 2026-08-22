/**
 * 인트로 화면의 콘텐츠 상수.
 *
 * 마크업에 흩어 두지 않고 한 곳에 모읍니다 — 문구와 숫자는 마케팅이
 * 고치는 값이고, JSX 사이에 박아 두면 고칠 때마다 개발자를 거칩니다.
 */

/**
 * 앱 주소. 후보자·간병사·보호자 화면은 **웹에 없습니다** (CLAUDE.md §4.1).
 * 인트로의 역할 카드 두 개가 여기로 나갑니다.
 */
export const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3300';

/**
 * 지표 4개 (핸드오프 §Screens 4).
 *
 * 시안 값은 `1,240` 등록 인력 · `86` 제휴 기관 · `18일` 평균 배치였고,
 * 핸드오프도 '시안용 샘플'로 못박고 있었습니다 (Open items 3).
 * **셋 다 근거가 없었습니다** — 공개 집계 엔드포인트가 없고, 평균 배치
 * 일수는 파일럿을 돌려 봐야 나옵니다. 로그인 뒤 화면이 아니라 누구나 보는
 * 페이지의 숫자라, 틀리면 화면 오류가 아니라 허위 표시입니다.
 *
 * 그래서 **코드에서 확인되는 값**으로 바꿨습니다 (D-12 결정 2안).
 * 규모 대신 규격을 말합니다 — 이 플랫폼이 파는 것은 인원수가 아니라
 * **막는 능력**이고, 아래 넷이 정확히 그것입니다.
 *
 * 값이 바뀌면 여기도 바뀝니다. 각 항목의 출처를 함께 적어 둡니다:
 */
export const STATS: { value: string; label: string; tone?: 'signal' }[] = [
  // CLAUDE.md §5.11 · quality/state/clearance.state.ts REQUIRED_CLEARANCES
  // 전부 PASS여야 배치됩니다. 운영자 예외 처리 경로가 없습니다.
  { value: '6개', label: '배치 전 필수 확인 · 예외 없음' },
  // CLAUDE.md §5.12-1 · care/state/care.state.ts MIN_REST_HOURS
  // 상수입니다. 테이블에서 읽지 않습니다 — 낮출 수 있게 만들면 인력이
  // 부족한 날 낮추게 되고, 그 날이 사고가 나는 날입니다.
  { value: '11시간', label: '교대 사이 최소 휴식' },
  // ops/state/ticket.state.ts TICKET_SLA_HOURS · CLAUDE.md §7 ticket-sla 잡
  // 안전사고·부당대우·업무범위 초과는 4시간 안에 1차 답변합니다.
  //
  // 트랙 수(3개)를 넣었다가 뺐습니다 — 그건 상수가 아니라 `tracks` 테이블의
  // 행 수이고, 농업·미용을 열면 코드 배포 없이 늘어납니다 (§5.8).
  // 공개 페이지에 박아 두면 그때 조용히 틀린 숫자가 됩니다.
  { value: '4시간', label: '안전·부당대우 신고 1차 답변' },
  // packages/field_ui/lib/src/locale.dart — enum AppLocale { ko, vi, ru, en }
  { value: '4개', label: '지원 언어 (KO·VI·RU·EN)', tone: 'signal' },
];

/** 역할 분기 카드 (핸드오프 §Screens 3). 페이지의 핵심 전환 지점입니다. */
export const ROLE_CARDS = [
  {
    key: 'candidate',
    icon: 'user' as const,
    tone: 'action' as const,
    title: '간병인으로 지원',
    body: '자격·서류를 등록하고 한국 병원·요양원 일자리에 지원합니다. 한국어·베트남어·러시아어 지원.',
    cta: '지원 시작',
    href: APP_URL,
  },
  {
    key: 'guardian',
    icon: 'heart' as const,
    tone: 'signal' as const,
    title: '간병인 찾기',
    body: '환자·가족을 위한 신청. 필요한 돌봄 조건을 고르면 자격이 확인된 간병인을 추천합니다.',
    cta: '신청하기',
    href: APP_URL,
  },
  {
    key: 'org',
    icon: 'building' as const,
    tone: 'neutral' as const,
    title: '기관 채용',
    body: '병원·요양원 담당자용. 공고 등록, 후보 검토, 비자·서류 진행 상황을 한 화면에서 관리합니다.',
    cta: '공고 등록',
    href: '/login',
  },
];

/** 진행 절차 5단계 (핸드오프 §Screens 6). 1~3은 진행·완료, 4~5는 예정 표현입니다. */
export const FLOW = [
  { n: 1, done: true, title: '지원', body: '기본 정보와 자격증을 등록합니다.' },
  { n: 2, done: true, title: '서류', body: '여권·건강검진·범죄경력을 제출합니다.' },
  { n: 3, done: true, title: '심사', body: '운영팀이 서류 유효기간과 요건을 확인합니다.' },
  { n: 4, done: false, title: '매칭', body: '조건이 맞는 기관과 근무 조건을 확정합니다.' },
  { n: 5, done: false, title: '입국·배치', body: '비자 발급과 입국 일정을 안내하고 배치합니다.' },
];

/** 앱 미리보기 옆 체크 3줄 (핸드오프 §Screens 5). */
export const APP_POINTS = [
  '자격·서류는 운영팀이 직접 확인합니다',
  '체류자격 만료일은 남은 일수로 알려드립니다',
  '한국어·베트남어·러시아어로 같은 화면을 씁니다',
];
