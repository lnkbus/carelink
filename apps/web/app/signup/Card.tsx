import Link from 'next/link';
import { Icon, type IconName } from '@/components/Icon';
import { SiteHeader } from '@/components/SiteHeader';

/**
 * 가입 흐름의 공통 뼈대 (시안 SCR-002).
 *
 * ── 헤더가 생겼습니다 ────────────────────────────────────────────────
 * 종전에는 카드 하나만 화면 가운데 떠 있었습니다. 신청하다 멈춘 사람이
 * 처음으로 돌아갈 길이 브라우저 뒤로가기뿐이었습니다. 시안이 이 헤더에
 * `data-shared="GLOBAL-HEADER"`를 달아 인트로와 같은 것임을 표시했고,
 * 그래서 `SiteHeader`로 빼 두 곳이 같은 것을 씁니다.
 *
 * 셸(AdminShell/OrgShell)은 여전히 쓰지 않습니다 — 아직 어느 구역에도
 * 속하지 않은 사람이고, 사이드바를 보여 주면 이미 들어온 것처럼 보입니다.
 */
export function SignupCard({
  title, lead, children, back, landing, caption, headerCta = true, headBlock, captionBlock,
}: {
  title: string;
  lead?: string;
  children: React.ReactNode;
  /** 시안 블록 코드. 헤딩 블록에 답니다 (예: 'SCR-002-01'). */
  headBlock?: string;
  back?: { href: string; label: string };
  /** 로그인한 사람의 랜딩. 헤더 버튼이 '로그인'/'내 화면으로'를 가릅니다. */
  landing?: string | null;
  /** 하단 문의 캡션 (시안 SCR-002-07). */
  caption?: string;
  /** 헤더 오른쪽 버튼. 대기 화면처럼 갈 곳이 지금 있는 곳이면 끕니다. */
  headerCta?: boolean;
  /** 캡션 블록 코드 (예: 'SCR-002-07'). */
  captionBlock?: string;
}) {
  return (
    <div className="cl-su">
      <SiteHeader landing={landing} cta={headerCta} />
      <main className="cl-su-main">
        {back && (
          <Link href={back.href} className="cl-su-back">← {back.label}</Link>
        )}
        <div className="cl-su-card">
          <div className="cl-su-head" data-block={headBlock}>
            <h1>{title}</h1>
            {lead && <p>{lead}</p>}
          </div>
          {children}
        </div>
        {caption && <p className="cl-su-caption" data-block={captionBlock}>{caption}</p>}
      </main>
    </div>
  );
}

/**
 * 경로 카드 (시안 SCR-002-02 · 03).
 *
 * 아이콘을 왼쪽에 세워 두는 것이 요점입니다. 제목만 있으면 '기관'과
 * '파트너'가 글자 길이로만 갈리고, 처음 온 사람은 자기가 어느 쪽인지
 * 두 번 읽어야 합니다.
 */
export function PathCard({
  href, icon, tone, title, who, body, block,
}: {
  href: string;
  /** 시안 블록 코드 (예: 'SCR-002-02'). */
  block?: string;
  icon: IconName;
  tone: 'org' | 'partner';
  title: string;
  who: string;
  body: string;
}) {
  return (
    <Link href={href} className="cl-su-path" data-block={block}>
      <span className={`cl-su-path-icon cl-su-path-icon-${tone}`} aria-hidden="true">
        <Icon name={icon} size={28} stroke={2.2} />
      </span>
      <span className="cl-su-path-body">
        <span className="cl-su-path-title">{title}</span>
        <span className="cl-su-path-who">{who}</span>
        <span className="cl-su-path-desc">{body}</span>
      </span>
      <span className="cl-su-path-go" aria-hidden="true">
        <Icon name="chevronRight" size={22} stroke={2.4} />
      </span>
    </Link>
  );
}

/**
 * 로그인이 필요한 자리 (시안 SCR-002-04).
 *
 * 신청 화면을 보는 것과 신청서를 내는 것은 다릅니다. 무엇을 신청하는지
 * 보기 전에 번호부터 넣으라고 하면 순서가 거꾸로입니다 — 그래서 화면은
 * 열어 두고, 여기서 안내합니다.
 *
 * 돌아올 곳을 `next`로 들려 보냅니다. 없으면 로그인 뒤 역할이 없어
 * `/no-access`로 가고, 거기서 다시 여기까지 두 번을 더 눌러야 합니다.
 */
export function LoginRequired({
  next, what, block,
}: { next: string; what?: string; block?: string }) {
  return (
    <div className="cl-su-auth" data-block={block}>
      <p>
        {what ? `${what}은(는) 누가 신청했는지 알아야 승인할 수 있습니다. ` : ''}
        신청서를 내려면 <strong>휴대폰 번호 인증</strong>이 필요합니다.
        비밀번호는 없습니다 — 번호를 넣으면 인증 문자가 갑니다.
      </p>
      <Link href={`/login?next=${encodeURIComponent(next)}`} className="cl-su-auth-btn">
        번호 인증하고 계속하기
        <Icon name="chevronRight" size={18} stroke={2.5} />
      </Link>
    </div>
  );
}

/** 안내 상자 (시안 SCR-002-05 · 06). 게이트를 숨기지 않고 설명하는 자리입니다. */
export function Note({
  icon, children, block,
}: { icon?: IconName; children: React.ReactNode; block?: string }) {
  return (
    <div className="cl-su-note" data-block={block}>
      {icon && (
        <span className="cl-su-note-icon" aria-hidden="true">
          <Icon name={icon} size={22} stroke={2} />
        </span>
      )}
      <span style={{ flex: 1, minWidth: 0 }}>{children}</span>
    </div>
  );
}

/** 안내 상자 여러 개를 묶습니다 — 시안은 이 둘만 간격이 다릅니다(14px). */
export function Notes({ children }: { children: React.ReactNode }) {
  return <div className="cl-su-notes">{children}</div>;
}
