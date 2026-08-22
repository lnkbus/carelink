import Link from 'next/link';
import { Icon } from '@/components/Icon';
import { APP_POINTS, FLOW, ROLE_CARDS, STAGES, STATS, VERTICALS } from '@/lib/intro';
import { LOCALES, LOCALE_LABEL, type Locale, makeT, pickLocale } from '@/lib/intro-i18n';
import { currentUser, landingFor } from '@/lib/session';

/**
 * 인트로 — 공개 랜딩 (`design_handoff_carelink_intro` 최종본 + to-be 2섹션).
 *
 * **지금 있는 것이 아니라 만들려는 것 전체를 보여줍니다.** 시안의 8섹션에
 * '인력 운영 8단계'와 '산업 확장'을 더했습니다 — 이 플랫폼의 값어치는
 * 화면 하나가 아니라 확보에서 근속까지를 한 기록으로 잇는다는 데 있고,
 * 그건 단계를 나열해야 보입니다.
 *
 * 다 된 것처럼 보이지 않게 **운영 중 / 준비 중을 함께 표시**합니다.
 * 파일럿에서 기대가 어긋나는 것이 못 만든 것보다 비쌉니다.
 *
 * 4개 언어입니다. 로케일은 `?lang=`로 고릅니다 — 라우팅 세그먼트(`/ko/...`)를
 * 쓰지 않은 이유는 로그인 뒤 화면들이 전부 ko 전용이라, 여기 하나 때문에
 * 앱 전체의 주소 구조를 바꿀 이유가 없기 때문입니다.
 */
export const dynamic = 'force-dynamic';

export default async function IntroPage({
  searchParams,
}: {
  searchParams: { lang?: string | string[] };
}) {
  const locale = pickLocale(searchParams.lang);
  const t = makeT(locale);
  const me = await currentUser();
  const landing = me ? landingFor(me) : null;

  return (
    <div className="cl-lp" lang={locale}>
      <Header t={t} locale={locale} landing={landing} />

      {/* ── 2. Hero ── */}
      <section id="top" className="cl-lp-wrap cl-lp-hero">
        <span className="cl-lp-badge">
          <Icon name="clock" size={16} />
          {t('hero.badge')}
        </span>
        <h1>{t('hero.title')}</h1>
        <p>{t('hero.lead')}</p>
      </section>

      {/* ── 3. 역할 분기 — 페이지의 핵심 전환 지점 ── */}
      <section id="roles" className="cl-lp-wrap cl-lp-roles">
        {ROLE_CARDS.map((c) => (
          <Link key={c.key} href={withLang(c.href, locale)} className="cl-lp-role">
            <span className={`cl-lp-role-icon cl-lp-tone-${c.tone}`}>
              <Icon name={c.icon} size={28} stroke={2.2} />
            </span>
            <span className="cl-lp-role-title">{t(`${c.key}.title`)}</span>
            <span className="cl-lp-role-body">{t(`${c.key}.body`)}</span>
            <span className="cl-lp-role-cta">
              {t(`${c.key}.cta`)}
              <Icon name="chevronRight" size={18} stroke={2.4} />
            </span>
          </Link>
        ))}
      </section>

      {/* ── 4. 지표 — 목표치입니다 (lib/intro.ts STATS 주석 · docs/17 D-12) ── */}
      <section className="cl-lp-stats-band">
        <div className="cl-lp-wrap cl-lp-stats">
          {STATS.map((s) => (
            <div key={s.key} className="cl-lp-stat">
              {/* 숫자와 단위도 사전에서 옵니다 — `18일`은 러시아어 화면에서
                  읽히지 않는 글자입니다. 자릿수 구분자도 언어마다 다릅니다. */}
              <span className={s.tone === 'signal' ? 'cl-lp-stat-n cl-lp-stat-signal' : 'cl-lp-stat-n'}>
                {t(`${s.key}.v`)}
              </span>
              <span className="cl-lp-stat-l">{t(s.key)}</span>
            </div>
          ))}
          {/*
            숫자만 두면 현재 실적으로 읽힙니다. 파일럿 전이라 실측치가 없고,
            공개 페이지의 숫자는 곧 주장입니다 — 한 줄로 밝힙니다.
          */}
          <p className="cl-lp-stat-note">{t('stat.note')}</p>
        </div>
      </section>

      {/* ── 5. 앱 미리보기 ── */}
      <section id="app" className="cl-lp-wrap cl-lp-app">
        <div className="cl-lp-app-copy">
          <h2>{lines(t('app.title'))}</h2>
          <p>{t('app.lead')}</p>
          <ul className="cl-lp-checks">
            {APP_POINTS.map((k) => (
              <li key={k}>
                <Icon name="circleCheck" size={20} stroke={2.1} />
                {t(k)}
              </li>
            ))}
          </ul>
        </div>
        <PhoneMock t={t} />
      </section>

      {/* ── 6. 진행 절차 ── */}
      <section id="flow" className="cl-lp-flow-band">
        <div className="cl-lp-wrap cl-lp-flow">
          <h2>{t('flow.title')}</h2>
          <div className="cl-lp-flow-grid">
            {FLOW.map((s) => (
              <div key={s.n} className="cl-lp-step">
                <span className={s.done ? 'cl-lp-step-n cl-lp-step-done' : 'cl-lp-step-n'}>{s.n}</span>
                <span className="cl-lp-step-t">{t(`${s.key}.t`)}</span>
                <span className="cl-lp-step-b">{t(`${s.key}.b`)}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── 7. 인력 운영 8단계 (to-be 전체) ── */}
      <section id="stages" className="cl-lp-wrap cl-lp-stages">
        <h2>{t('stages.title')}</h2>
        <p className="cl-lp-section-lead">{t('stages.lead')}</p>
        <ol className="cl-lp-stage-rail">
          {STAGES.map((s) => (
            <li key={s.n} className={s.live ? 'cl-lp-stage cl-lp-stage-live' : 'cl-lp-stage'}>
              <span className="cl-lp-stage-dot">
                {s.live ? <Icon name="check" size={14} stroke={3} /> : s.n}
              </span>
              <span className="cl-lp-stage-t">{t(`${s.key}.t`)}</span>
              <span className="cl-lp-stage-b">{t(`${s.key}.b`)}</span>
              {/* 색만으로 구분하지 않습니다 — 색각 이상 사용자에게는 변화가 없습니다. */}
              <span className="cl-lp-tag">{s.live ? t('stages.live') : t('stages.soon')}</span>
            </li>
          ))}
        </ol>
      </section>

      {/* ── 8. 산업 확장 ── */}
      <section id="verticals" className="cl-lp-vert-band">
        <div className="cl-lp-wrap cl-lp-vert">
          <h2>{t('verticals.title')}</h2>
          <p className="cl-lp-section-lead">{t('verticals.lead')}</p>
          <div className="cl-lp-chips">
            {VERTICALS.map((v) => (
              <span key={v.key} className={v.live ? 'cl-lp-chip cl-lp-chip-live' : 'cl-lp-chip'}>
                {v.live && <Icon name="check" size={15} stroke={2.6} />}
                {t(v.key)}
                <small>{v.live ? t('verticals.live') : t('verticals.planned')}</small>
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── 9. CTA 밴드 ── */}
      <section className="cl-lp-cta-band">
        <div className="cl-lp-wrap cl-lp-cta">
          <h2>{t('cta.title')}</h2>
          <p>{t('cta.lead')}</p>
          <div className="cl-lp-cta-row">
            <Link href={withLang(ROLE_CARDS[0].href, locale)} className="cl-lp-btn-white">
              {t('cta.primary')}
              <Icon name="chevronRight" size={20} stroke={2.6} />
            </Link>
            <Link href={withLang('/login', locale)} className="cl-lp-btn-ghost">
              {t('cta.secondary')}
            </Link>
          </div>
        </div>
      </section>

      <Footer t={t} locale={locale} />
    </div>
  );
}

/** `\n`이 든 문구를 줄바꿈으로. 언어마다 끊는 자리가 달라 사전에 둡니다. */
function lines(text: string) {
  return text.split('\n').map((l, i) => (
    <span key={l}>
      {i > 0 && <br />}
      {l}
    </span>
  ));
}

/**
 * 링크에 로케일을 붙입니다.
 *
 * 외부 주소(앱)에는 붙이지 않습니다 — 앱은 자기 저장소에 언어를 들고 있고,
 * 쿼리로 덮으면 사용자가 앱에서 고른 언어가 인트로 때문에 바뀝니다.
 */
function withLang(href: string, locale: Locale): string {
  if (!href.startsWith('/') || locale === 'ko') return href;
  return `${href}?lang=${locale}`;
}

/**
 * 1. 헤더 (sticky).
 *
 * 언어 전환이 **실제로 동작합니다.** 링크 4개라 JS가 필요 없고, 서버가
 * 그 로케일로 렌더합니다 — 인트로는 로그인 전 화면이라 클라이언트 상태를
 * 둘 이유가 없습니다.
 *
 * 앵커 링크는 640px 아래에서 숨깁니다 (핸드오프 Open items 2 — 결정).
 * 한 페이지 스크롤이라 앵커는 편의 기능이지 없으면 못 가는 길이 아닙니다.
 * **언어 전환은 남깁니다** — 한국어를 못 읽는 사람에게는 그게 유일한 문입니다.
 */
function Header({
  t, locale, landing,
}: {
  t: (k: string) => string;
  locale: Locale;
  landing: string | null;
}) {
  return (
    <header className="cl-lp-header">
      <div className="cl-lp-wrap cl-lp-header-in">
        <Link href={withLang('/', locale)} className="cl-lp-brand">
          <span className="cl-lp-brand-mark">
            <Icon name="check" size={18} stroke={2.4} />
          </span>
          CareLink
        </Link>
        <nav className="cl-lp-nav">
          <a href="#roles" className="cl-lp-nav-link">{t('nav.service')}</a>
          <a href="#app" className="cl-lp-nav-link">{t('nav.app')}</a>
          <a href="#stages" className="cl-lp-nav-link">{t('nav.stages')}</a>
          <span className="cl-lp-locale" role="group" aria-label="Language">
            {LOCALES.map((l) => (
              <Link
                key={l}
                href={l === 'ko' ? '/' : `/?lang=${l}`}
                className={l === locale ? 'cl-lp-locale-on' : undefined}
                aria-current={l === locale ? 'true' : undefined}
                hrefLang={l}
              >
                {LOCALE_LABEL[l]}
              </Link>
            ))}
          </span>
          <Link href={landing ?? withLang('/login', locale)} className="cl-lp-btn-primary">
            {landing ? t('nav.mine') : t('nav.login')}
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
function PhoneMock({ t }: { t: (k: string) => string }) {
  return (
    <div className="cl-lp-mock-wrap">
      <div className="cl-lp-mock">
        <div className="cl-lp-mock-profile">
          <span className="cl-lp-mock-avatar">
            <Icon name="user" size={24} stroke={2.1} />
          </span>
          <span className="cl-lp-mock-who">
            <b>흐엉</b>
            <span className="cl-mono">#C-10428 · {t('app.mock.role')}</span>
          </span>
        </div>

        <div className="cl-lp-mock-action">
          <span className="cl-lp-mock-label">
            <Icon name="clock" size={15} stroke={2.2} />
            {t('app.mock.todo')}
          </span>
          <b>{t('app.mock.task')}</b>
          <span className="cl-lp-mock-btn">
            <Icon name="camera" size={20} stroke={2.2} />
            {t('app.mock.upload')}
          </span>
        </div>

        <div className="cl-lp-mock-progress">
          <div className="cl-lp-mock-prow">
            <b>{t('app.mock.stage')}</b>
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
            <span>{t('app.mock.visa')}</span>
            <b className="cl-mono">D-42</b>
          </div>
        </div>
      </div>
    </div>
  );
}

function Footer({ t, locale }: { t: (k: string) => string; locale: Locale }) {
  return (
    <footer id="contact" className="cl-lp-footer">
      <div className="cl-lp-wrap cl-lp-footer-in">
        <div className="cl-lp-footer-brand">
          <b>CareLink</b>
          <span>{t('foot.tagline')}</span>
          <span className="cl-mono">{t('foot.support')}</span>
        </div>
        <div className="cl-lp-footer-links">
          <Link href={withLang('/login', locale)}>{t('foot.terms')}</Link>
          <Link href={withLang('/login', locale)}>{t('foot.privacy')}</Link>
          <Link href={withLang('/login', locale)}>{t('foot.careers')}</Link>
        </div>
      </div>
      <div className="cl-lp-wrap cl-lp-footer-note">{t('foot.preview')}</div>
    </footer>
  );
}
