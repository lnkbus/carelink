import Link from 'next/link';
import { LocaleSwitcher } from '@carelink/ui';
import { NavItem } from './NavItem';

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
      { href: '/', label: '운영 대시보드', screen: 'SCR-501' },
      { href: '/matching', label: '매칭 센터', screen: 'SCR-504' },
    ],
  },
  {
    group: '자원',
    items: [
      { href: '/candidates', label: '후보자 관리', screen: 'SCR-502' },
      { href: '/organizations', label: '기관 관리', screen: 'SCR-503' },
      { href: '/engagements', label: '고용 · 계약', screen: 'SCR-508' },
      { href: '/clearances', label: '품질 · 안전', screen: 'SCR-509' },
    ],
  },
  {
    group: '공급',
    items: [
      { href: '/partners', label: '파트너 · 채널', screen: 'SCR-510' },
      { href: '/cohorts', label: '코호트', screen: 'SCR-511' },
    ],
  },
];

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="cl-shell">
      <nav className="cl-sidebar">
        <Link
          href="/"
          style={{
            display: 'block', padding: '0 var(--cl-s6) var(--cl-s5)',
            fontWeight: 700, letterSpacing: '.2em', fontSize: 'var(--cl-subtitle)',
            color: 'var(--cl-text)',
          }}
        >
          CARELINK
        </Link>
        {NAV.map((section) => (
          <div key={section.group}>
            <div className="cl-nav-group">{section.group}</div>
            {section.items.map((item) => (
              <NavItem key={item.href} href={item.href} label={item.label} screen={item.screen} />
            ))}
          </div>
        ))}
        <div style={{ padding: 'var(--cl-s6)' }}>
          <LocaleSwitcher locale="ko" variant="desk" />
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
