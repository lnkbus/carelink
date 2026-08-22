import Link from 'next/link';
import { currentUser, landingFor } from '@/lib/session';

/**
 * 인트로 — 로그인하지 않은 사람이 처음 보는 화면.
 *
 * 종전에는 루트가 곧바로 `/login`으로 튕겼습니다. 주소를 받은 사람은
 * 무엇을 하는 곳인지 모른 채 번호부터 넣어야 했고, 기관 담당자에게 링크를
 * 보내면 "이게 뭐냐"는 회신이 먼저 왔습니다.
 *
 * 이미 로그인한 사람은 여기 머물지 않습니다 — 역할이 목적지를 정합니다.
 * 매번 인트로를 지나게 하면 하루에 수십 번 들어오는 운영자에게는
 * 클릭 한 번이 통행세가 됩니다.
 */
export const dynamic = 'force-dynamic';

export default async function IntroPage() {
  const me = await currentUser();
  const landing = me ? landingFor(me) : null;

  return (
    <main className="cl-intro">
      <header className="cl-intro-bar">
        <span className="cl-intro-brand">
          <span aria-hidden="true" className="cl-intro-mark">♥</span>
          케어링크
        </span>
        <Link className="cl-intro-cta" href={landing ?? '/login'}>
          {landing ? '내 화면으로' : '로그인'}
        </Link>
      </header>

      <section className="cl-intro-hero">
        <p className="cl-intro-eyebrow">돌봄 · 의료 인력 운영 플랫폼</p>
        <h1>
          사람을 구하는 일과<br />
          사람을 지키는 일을 한 곳에서
        </h1>
        <p className="cl-intro-lead">
          확보 · 검증 · 교육 · 자격 · 매칭 · 배치 · 근무 · 근속.
          흩어져 있던 여덟 단계를 하나의 기록으로 잇습니다.
        </p>
        <Link className="cl-intro-cta cl-intro-cta-lg" href={landing ?? '/login'}>
          {landing ? '내 화면으로' : '휴대폰 번호로 시작'}
        </Link>
        <p className="cl-intro-note">비밀번호가 없습니다. 번호로 인증합니다.</p>
      </section>

      {/*
        누가 무엇을 하는 곳인지 먼저 말합니다. 이 플랫폼에는 수요 측이
        둘이고 (기관은 인력을 고용하고, 보호자는 환자에게 간병사를 붙입니다),
        그걸 설명하지 않으면 같은 화면을 보고 서로 다른 것을 기대합니다.
      */}
      <section className="cl-intro-who">
        <h2>누가 쓰나요</h2>
        <div className="cl-intro-grid">
          <article>
            <h3>기관</h3>
            <p>병원 · 요양기관이 인력을 <b>고용</b>합니다.</p>
            <p className="cl-intro-where">이 웹 · <code>/org</code></p>
          </article>
          <article>
            <h3>운영자</h3>
            <p>검증 · 매칭 · 품질 · 사건을 <b>관리</b>합니다.</p>
            <p className="cl-intro-where">이 웹 · <code>/admin</code></p>
          </article>
          <article>
            <h3>후보자</h3>
            <p>자격을 갖춰 <b>일자리를 찾습니다</b>.</p>
            <p className="cl-intro-where">앱</p>
          </article>
          <article>
            <h3>간병사</h3>
            <p>현장에서 <b>일하고 기록합니다</b>.</p>
            <p className="cl-intro-where">앱</p>
          </article>
          <article>
            <h3>보호자</h3>
            <p>환자에게 <b>간병사를 요청합니다</b>.</p>
            <p className="cl-intro-where">앱</p>
          </article>
        </div>
        <p className="cl-intro-note">
          이 주소는 <b>기관과 운영자</b>를 위한 화면입니다. 후보자 · 간병사 ·
          보호자는 앱을 쓰세요 — 장갑 낀 손으로 몇 초 안에 쓰는 화면은
          마우스와 표를 쓰는 화면과 규격이 다릅니다.
        </p>
      </section>

      <footer className="cl-intro-foot">
        <span>CARELINK</span>
        <span>돌봄 · 의료 인력 운영 플랫폼</span>
      </footer>
    </main>
  );
}
