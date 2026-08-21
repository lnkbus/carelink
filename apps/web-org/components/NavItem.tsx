'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * 사이드바 항목 (시안 SCR-201: 높이 34 · radius 8 · 13.5px).
 *
 * **배지가 화면 ID를 대신합니다.**
 *
 * 종전에는 오른쪽에 `SCR-504` 같은 화면 번호를 띄웠습니다. 그건 개발자에게만
 * 쓸모 있고, 운영자에게는 아무 정보도 아닙니다. 시안은 같은 자리에 **처리해야
 * 할 건수**를 둡니다 — 사이드바를 훑는 것만으로 어디에 일이 쌓였는지 보이고,
 * 그게 담당자가 하루에 수십 번 하는 일입니다.
 */
export function NavItem({
  href, label, badge, phase,
}: {
  href: string;
  label: string;
  /** 처리 대기 건수. 0이면 띄우지 않습니다 — 0은 정보가 아니라 잡음입니다. */
  badge?: number;
  /** `V2`처럼 아직 안 열린 화면 표시. 시안은 opacity 0.6으로 낮춥니다. */
  phase?: string;
}) {
  const pathname = usePathname();
  const active = href === '/' ? pathname === '/' : pathname.startsWith(href);

  return (
    <Link
      href={href}
      className="cl-nav-item"
      aria-current={active ? 'page' : undefined}
      style={phase ? { opacity: 0.6 } : undefined}
    >
      <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <span style={{ flex: 1 }}>{label}</span>
        {badge !== undefined && badge > 0 && (
          <span
            style={{
              fontFamily: 'var(--cl-font-mono)', fontSize: 'var(--cl-micro)', fontWeight: 700,
              color: 'var(--cl-flag)', background: 'var(--cl-flag-tint)',
              borderRadius: 'var(--cl-r-pill)', padding: '2px 6px',
            }}
          >
            {badge}
          </span>
        )}
        {phase && (
          <span style={{ fontFamily: 'var(--cl-font-mono)', fontSize: 'var(--cl-micro)', color: 'var(--cl-text-muted)' }}>
            {phase}
          </span>
        )}
      </span>
    </Link>
  );
}
