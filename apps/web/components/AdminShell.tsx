import Link from 'next/link';
import { LocaleSwitcher } from '@carelink/ui';
import { currentUser, adminBadges } from '@/lib/session';
import { NavItem } from './NavItem';
import { SessionBox } from './SessionBox';

/**
 * Admin Console 사이드바 — 3그룹(운영 / 자원 / 공급), 그룹 라벨은 Micro 10.5px.
 * design/README §Screens 'Admin Console' 항목의 구조를 그대로 따릅니다.
 *
 * V2·V3 화면은 메뉴에 두지 않습니다. 라우트가 없는 항목을 회색으로 걸어 두면
 * "언제 열리냐"는 문의만 만들고, 열린 척하는 화면보다 없는 편이 낫습니다.
 */
const NAV = [
  {
    group: '운영',
    items: [
      { href: '/admin', label: '운영 대시보드' },
      { href: '/admin/matching', label: '매칭 센터', badge: 'matching' as const },
      { href: '/admin/care', label: '간병 운영' },
      { href: '/admin/tickets', label: '사건 · 문의', badge: 'tickets' as const },
    ],
  },
  {
    group: '자원',
    items: [
      { href: '/admin/candidates', label: '후보자 관리' },
      { href: '/admin/organizations', label: '기관 관리' },
      { href: '/admin/engagements', label: '고용 · 계약' },
      { href: '/admin/clearances', label: '품질 · 안전' },
    ],
  },
  {
    group: '공급',
    items: [
      { href: '/admin/partners', label: '파트너 · 채널' },
      { href: '/admin/cohorts', label: '코호트' },
    ],
  },
  {
    group: '설정',
    items: [
      // 버티컬 확장의 실행 창구입니다. 농업·미용을 열 때 개발자가 아니라
      // 운영자가 여기서 산업과 트랙을 만듭니다 (§5.8).
      { href: '/admin/tracks', label: '산업 · 트랙' },
    ],
  },
];

export async function AdminShell({ children }: { children: React.ReactNode }) {
  const [me, badges] = await Promise.all([currentUser(), adminBadges()]);

  return (
    <div className="cl-shell">
      <nav className="cl-sidebar">
        {/* 시안의 로고 블록 — 24px 검은 타일 + 'CareLink' + mono 'ADMIN CONSOLE'. */}
        <Link
          href="/admin"
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: 'var(--cl-s2) var(--cl-s4) var(--cl-s5)', color: 'var(--cl-text)',
          }}
        >
          <span
            aria-hidden="true"
            style={{
              width: 24, height: 24, borderRadius: 7, background: 'var(--cl-text)',
              color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13,
            }}
          >
            ♥
          </span>
          <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.25 }}>
            <span style={{ fontSize: 14, fontWeight: 700 }}>CareLink</span>
            <span style={{ fontFamily: 'var(--cl-font-mono)', fontSize: 'var(--cl-micro)', fontWeight: 500, color: 'var(--cl-text-muted)' }}>
              ADMIN CONSOLE
            </span>
          </span>
        </Link>
        {NAV.map((section) => (
          <div key={section.group}>
            <div className="cl-nav-group">{section.group}</div>
            {section.items.map((item) => (
              <NavItem
                key={item.href}
                href={item.href}
                label={item.label}
                badge={'badge' in item && item.badge ? badges[item.badge] : undefined}
              />
            ))}
          </div>
        ))}
        <div style={{ padding: 'var(--cl-s6)' }}>
          <LocaleSwitcher locale="ko" variant="desk" />
          <SessionBox phone={me?.phone ?? undefined} />
          <p
            style={{
              margin: 'var(--cl-s4) 0 0', fontSize: 'var(--cl-micro)',
              color: 'var(--cl-text-disabled)', lineHeight: 1.6,
            }}
          >
            DESK는 한국어 전용입니다. 다국어는 후보자·간병사·보호자 앱에서 제공됩니다.
          </p>
        </div>
      </nav>
      <main className="cl-main">{children}</main>
    </div>
  );
}
