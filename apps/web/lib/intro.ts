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
 * ⚠️ 지표 4개 — **시안용 샘플 값입니다** (핸드오프 §Screens 4 · Open items 3).
 *
 * 공개 페이지의 숫자는 곧 주장입니다. `1,240`과 `86`과 `18일`은 아직
 * 근거가 없습니다 — 공개 가능한 집계 엔드포인트가 없고, 평균 배치 일수는
 * 파일럿을 돌려 봐야 나옵니다.
 *
 * **공개 전에 셋 중 하나를 하세요** (docs/17 D-12):
 *   1. 공개 집계 엔드포인트를 만들어 실제 값을 물린다
 *   2. 검증 가능한 값으로 바꾼다 (지원 언어 4종 · 운영 트랙 3종 ·
 *      배치 전 필수 검증 6종 · 교대 간 최소 휴식 11시간 — 전부 코드에 있는 사실)
 *   3. 섹션을 뺀다
 *
 * 값을 여기 한 곳에 모아 둔 이유가 이것입니다. 결정이 나면 이 배열만 고칩니다.
 */
export const STATS: { value: string; label: string; tone?: 'signal' }[] = [
  { value: '1,240', label: '등록된 간병 인력' },
  { value: '86', label: '제휴 병원·요양원' },
  { value: '18일', label: '서류 접수부터 배치까지 평균' },
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
