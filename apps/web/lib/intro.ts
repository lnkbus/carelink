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
 * **목표치입니다.** 파일럿 전이라 실측치가 없고, 인트로는 지금 있는 것이
 * 아니라 **만들려는 것 전체**를 보여주는 자리로 정했습니다 (D-12 개정).
 * 그래서 페이지에 '목표 기준'이라고 함께 적습니다 — 숫자만 두면 현재
 * 실적으로 읽히고, 그건 화면 오류가 아니라 허위 표시입니다.
 *
 * 값이 확정되면 여기 한 곳만 고칩니다. 라벨은 `intro-i18n.ts`에 있습니다.
 */
export const STATS: { key: string; tone?: 'signal' }[] = [
  { key: 'stat.workers' },
  { key: 'stat.orgs' },
  { key: 'stat.days' },
  { key: 'stat.langs', tone: 'signal' },
];

/**
 * 인력 운영 8단계 (CLAUDE.md §1).
 *
 * 확보 → 검증 → 교육 → 자격 → 매칭 → 배치 → 근무 → 근속.
 * **지금 열린 단계와 준비 중인 단계를 함께 표시합니다** — 다 된 것처럼
 * 보이면 파일럿에서 기대가 어긋나고, 안 된 것만 보이면 이 플랫폼이 무엇을
 * 만들고 있는지 전달되지 않습니다.
 *
 * `live` 판정 기준은 V1 구현 여부입니다 (CLAUDE.md §2 · §8).
 */
export const STAGES = [
  { n: 1, key: 'stages.1', icon: 'users' as const, live: true },   // recruiting — 채널·파트너·코호트
  { n: 2, key: 'stages.2', icon: 'shield' as const, live: true },  // quality — worker_clearances 6종
  { n: 3, key: 'stages.3', icon: 'cap' as const, live: true },     // talent — 교육 진도
  { n: 4, key: 'stages.4', icon: 'award' as const, live: true },   // talent — 커리어 여정
  { n: 5, key: 'stages.5', icon: 'swap' as const, live: true },    // matching — 룰 엔진 + 근거
  { n: 6, key: 'stages.6', icon: 'pin' as const, live: true },     // engagement — 모델·컴플라이언스
  { n: 7, key: 'stages.7', icon: 'qr' as const, live: true },      // care — 병실 QR 체크인 (V2)
  { n: 8, key: 'stages.8', icon: 'trend' as const, live: false },  // 근속 지표는 파일럿 이후
];

/**
 * 산업 확장 (CLAUDE.md §5.8 · §5.14).
 *
 * 코어(iam·talent·tracks·org·matching·engagement·work-record·billing)는
 * 산업 중립입니다. 새 산업은 `industries` / `tracks` 행 추가로 열립니다 —
 * 코드 배포 없이. 그래서 여기 '확장 예정'은 희망이 아니라 구조입니다.
 */
export const VERTICALS = [
  { key: 'vertical.hospital', icon: 'heartPulse' as const, live: true },
  { key: 'vertical.care', icon: 'users' as const, live: true },
  { key: 'vertical.medical', icon: 'pulse' as const, live: true },
  { key: 'vertical.agri', icon: 'sprout' as const, live: false },
  { key: 'vertical.beauty', icon: 'scissors' as const, live: false },
  { key: 'vertical.food', icon: 'chefHat' as const, live: false },
  { key: 'vertical.build', icon: 'hardHat' as const, live: false },
  { key: 'vertical.logistics', icon: 'truck' as const, live: false },
];

/** 역할 분기 카드 (핸드오프 §Screens 3). 페이지의 핵심 전환 지점입니다. */
export const ROLE_CARDS = [
  { key: 'role.candidate', icon: 'user' as const, tone: 'action' as const, href: APP_URL },
  { key: 'role.guardian', icon: 'heart' as const, tone: 'signal' as const, href: APP_URL },
  // 기관은 '로그인'이 아니라 **가입 신청**으로 보냅니다. 계정이 없는
  // 담당자를 로그인 화면에 세우면 거기서 할 수 있는 일이 없습니다 —
  // 종전에 인트로 어디에도 /signup으로 가는 길이 없었습니다.
  { key: 'role.org', icon: 'building' as const, tone: 'neutral' as const, href: '/signup/org' },
];

/** 진행 절차 5단계 (핸드오프 §Screens 6). 1~3은 진행·완료, 4~5는 예정 표현입니다. */
export const FLOW = [1, 2, 3, 4, 5].map((n) => ({ n, done: n <= 3, key: `flow.${n}` }));

/** 앱 미리보기 옆 체크 3줄 (핸드오프 §Screens 5). */
export const APP_POINTS = ['app.point1', 'app.point2', 'app.point3'];
