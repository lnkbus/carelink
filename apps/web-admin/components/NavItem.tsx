'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function NavItem({ href, label, screen }: { href: string; label: string; screen: string }) {
  const pathname = usePathname();
  const active = href === '/' ? pathname === '/' : pathname.startsWith(href);
  return (
    <Link href={href} className="cl-nav-item" aria-current={active ? 'page' : undefined}>
      <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        {label}
        <span style={{ fontFamily: 'var(--cl-font-mono)', fontSize: 'var(--cl-micro)', opacity: 0.55 }}>
          {screen}
        </span>
      </span>
    </Link>
  );
}
