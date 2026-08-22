import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { APP_POINTS, FLOW, ROLE_CARDS, STATS } from '@/lib/intro';
import { currentUser, landingFor } from '@/lib/session';

/**
 * 인트로 — 공개 랜딩 (`design_handoff_carelink_intro` 최종본).
 *
 * 8개 섹션 한 페이지 스크롤. **1차 목표는 방문자를 세 갈래로 보내는 것**입니다
 * (§Screens 3) — 간병인 지원자 · 환자·가족 · 병원·요양원 담당자. 그 아래로
 * 지표 → 앱 미리보기 → 진행 절차 → CTA가 이어집니다.
 *
 * 종전에는 루트가 곧바로 `/login`으로 튕겼습니다. 주소를 받은 사람은 무엇을
 * 하는 곳인지 모른 채 번호부터 넣어야 했습니다.
 *
 * 이미 로그인한 사람에게는 헤더 버튼이 '내 화면으로'가 됩니다. 매번 인트로를
 * 지나게 하면 하루에 수십 번 들어오는 운영자에게는 클릭 한 번이 통행세입니다.
 */
export const dynamic = 'force-dynamic';

export default async function IntroPage() {
  const me = await currentUser();
  const landing = me ? landingFor(me) : null;

  return (
    <div className="cl-lp">
      <Header landing={landing} />

      {/* ── 2. Hero ── */}
      <section id="top" className="cl-lp-wrap cl-lp-hero">
        {/*
          시안 배지는 '서류 접수부터 근무 시작까지 평균 18일'이었습니다.
          지표 넷과 같은 문제입니다 — 근거가 없고, 공개 페이지에 걸면
          약속이 됩니다 (D-12). 검증되는 사실로 바꿉니다.
        */}
        <span className="cl-lp-badge">
          <Icon name="circleCheck" size={16} />
          배치 전 6개 항목 확인 · 예외 처리 경로 없음
        </span>
        <h1>간병 인력, 입국부터 현장까지 한 번에</h1>
        <p>
          CareLink는 해외 간병 인력의 서류·비자·매칭·근무 관리를 하나의 흐름으로
          연결합니다. 지금 어디에 해당하시는지 골라주세요.
        </p>
      </section>

      {/* ── 3. 역할 분기 — 페이지의 핵심 전환 지점 ── */}
      <section id="roles" className="cl-lp-wrap cl-lp-roles">
        {ROLE_CARDS.map((c) => (
          <Link key={c.key} href={c.href} className="cl-lp-role">
            <span className={`cl-lp-role-icon cl-lp-tone-${c.tone}`}>
              <Icon name={c.icon} size={28} stroke={2.2} />
            </span>
            <span className="cl-lp-role-title">{c.title}</span>
            <span className="cl-lp-role-body">{c.body}</span>
            <span className="cl-lp-role-cta">
              {c.cta}
              <Icon name="chevronRight" size={18} stroke={2.4} />
            </span>
          </Link>
        ))}
      </section>

      {/* ── 4. 지표 — 코드에서 확인되는 값만 (lib/intro.ts STATS 주석) ── */}
      <section className="cl-lp-stats-band">
        <div className="cl-lp-wrap cl-lp-stats">
          {STATS.map((s) => (
            <div key={s.label} className="cl-lp-stat">
              <span className={s.tone === 'signal' ? 'cl-lp-stat-n cl-lp-stat-signal' : 'cl-lp-stat-n'}>
                {s.value}
              </span>
              <span className="cl-lp-stat-l">{s.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── 5. 앱 미리보기 ── */}
      <section id="app" className="cl-lp-wrap cl-lp-app">
        <div className="cl-lp-app-copy">
          <h2>
            지금 내 서류가 어디까지 갔는지
            <br />
            한 화면에서 봅니다
          </h2>
          <p>
            지원·서류·심사·매칭·배치를 다섯 단계로 나누고, 다음에 할 일 하나만
            크게 보여줍니다. 글을 다 읽지 않아도 색과 아이콘으로 상태가 읽힙니다.
          </p>
          <ul className="cl-lp-checks">
            {APP_POINTS.map((t) => (
              <li key={t}>
                <Icon name="circleCheck" size={20} stroke={2.1} />
                {t}
              </li>
            ))}
          </ul>
        </div>
        <PhoneMock />
      </section>

      {/* ── 6. 진행 절차 ── */}
      <section id="flow" className="cl-lp-flow-band">
        <div className="cl-lp-wrap cl-lp-flow">
          <h2>다섯 단계, 각 단계마다 담당자가 있습니다</h2>
          <div className="cl-lp-flow-grid">
            {FLOW.map((s) => (
              <div key={s.n} className="cl-lp-step">
                <span className={s.done ? 'cl-lp-step-n cl-lp-step-done' : 'cl-lp-step-n'}>{s.n}</span>
                <span className="cl-lp-step-t">{s.title}</span>
                <span className="cl-lp-step-b">{s.body}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 7. CTA 밴드 ── */}
      <section className="cl-lp-cta-band">
        <div className="cl-lp-wrap cl-lp-cta">
          <h2>돌봄이 필요한 곳에, 준비된 사람을</h2>
          <p>지원부터 배치까지 CareLink가 처음부터 끝까지 관리합니다.</p>
          <div className="cl-lp-cta-row">
            <Link href={ROLE_CARDS[0].href} className="cl-lp-btn-white">
              간병인으로 지원
              <Icon name="chevronRight" size={20} stroke={2.6} />
            </Link>
            <Link href="/login" className="cl-lp-btn-ghost">
              기관 문의
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

/**
 * 1. 헤더 (sticky).
 *
 * 앵커 링크는 **640px 아래에서 숨깁니다.** 시안에는 햄버거 메뉴가 없고
 * (핸드오프 Open items 2), 좁은 폭에서 `flex-wrap`으로 두 줄이 되면 헤더가
 * 화면의 4분의 1을 먹습니다. 한 페이지 스크롤이라 앵커는 편의 기능이지
 * 없으면 못 가는 길이 아닙니다 — 스크롤하면 같은 곳에 닿습니다.
 */
function Header({ landing }: { landing: string | null }) {
  return (
    <header className="cl-lp-header">
      <div className="cl-lp-wrap cl-lp-header-in">
        <Link href="#top" className="cl-lp-brand">
          <span className="cl-lp-brand-mark">
            <Icon name="check" size={18} stroke={2.4} />
          </span>
          CareLink
        </Link>
        <nav className="cl-lp-nav">
          <a href="#roles" className="cl-lp-nav-link">서비스</a>
          <a href="#app" className="cl-lp-nav-link">앱 화면</a>
          <a href="#flow" className="cl-lp-nav-link">진행 절차</a>
          {/*
            언어 전환은 아직 동작하지 않습니다 — 카피가 ko만 작성돼 있습니다
            (핸드오프 Open items 4). 자리를 지우면 나중에 넣을 때 헤더를
            다시 짜야 하므로 표시만 두고 버튼으로 만들지 않았습니다.
          */}
          <span className="cl-lp-locale">
            <Icon name="globe" size={16} stroke={1.8} />
            KO
          </span>
          <Link href={landing ?? '/login'} className="cl-lp-btn-primary">
            {landing ? '내 화면으로' : '로그인'}
          </Link>
        </nav>
      </div>
    </header>
  );
}

/**
 * 앱 목업 — Candidate App(SCR-101)의 축약본입니다.
 *
 * 실제 앱 화면이 아니라 **인트로용 정적 표현**입니다. 값이 바뀌어도 여기는
 * 따라오지 않습니다 — 따라오게 만들면 공개 페이지가 후보자 데이터를 부르게
 * 되고, 그건 로그인 없이 열리는 화면입니다.
 */
function PhoneMock() {
  return (
    <div className="cl-lp-mock-wrap">
      <div className="cl-lp-mock">
        <div className="cl-lp-mock-profile">
          <span className="cl-lp-mock-avatar">
            <Icon name="user" size={24} stroke={2.1} />
          </span>
          <span className="cl-lp-mock-who">
            <b>흐엉님</b>
            <span className="cl-mono">#C-10428 · 요양보호사</span>
          </span>
        </div>

        <div className="cl-lp-mock-action">
          <span className="cl-lp-mock-label">
            <Icon name="clock" size={15} stroke={2.2} />
            지금 할 일
          </span>
          <b>건강검진 결과 올리기</b>
          <span className="cl-lp-mock-btn">
            <Icon name="camera" size={20} stroke={2.2} />
            사진 올리기
          </span>
        </div>

        <div className="cl-lp-mock-progress">
          <div className="cl-lp-mock-prow">
            <b>취업 준비 단계</b>
            <span className="cl-mono cl-lp-mock-count">3 / 5</span>
          </div>
          <div className="cl-lp-mock-bars">
            {[0, 1, 2, 3, 4].map((i) => (
              <span key={i} className={i < 3 ? 'cl-lp-bar cl-lp-bar-on' : 'cl-lp-bar'} />
            ))}
          </div>
          {/*
            체류자격은 날짜가 아니라 **남은 일수**로 보여줍니다. 사람은
            2026-09-10을 보고 남은 날을 계산하지 않고, 계산을 놓치면 자격
            무효가 아니라 불법 취업이 됩니다 (CLAUDE.md §5.9).
          */}
          <div className="cl-lp-mock-warn">
            <Icon name="alert" size={20} stroke={2.1} />
            <span>체류자격 만료</span>
            <b className="cl-mono">D-42</b>
          </div>
        </div>
      </div>
    </div>
  );
}

function Footer() {
  return (
    <footer id="contact" className="cl-lp-footer">
      <div className="cl-lp-wrap cl-lp-footer-in">
        <div className="cl-lp-footer-brand">
          <b>CareLink</b>
          <span>국제 간병 인력 배치 플랫폼</span>
          <span className="cl-mono">고객센터 1600-0000 · 평일 09:00–18:00</span>
        </div>
        <div className="cl-lp-footer-links">
          <Link href="/login">이용약관</Link>
          <Link href="/login">개인정보처리방침</Link>
          <Link href="/login">채용</Link>
        </div>
      </div>
    </footer>
  );
}
