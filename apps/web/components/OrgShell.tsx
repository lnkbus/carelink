import Link from 'next/link';
import { LocaleSwitcher, StatusPill } from '@carelink/ui';
import { currentUser, orgBadges } from '@/lib/session';
import { NavItem } from './NavItem';
import { SessionBox } from './SessionBox';

/**
 * 기관 웹 사이드바 — 232px, 헤더 56px, 표가 기본 단위 (design/README §Organization Web).
 *
 * 검증 상태를 사이드바에 항상 띄웁니다. 검증 전 기관은 후보자 실명·연락처를
 * 볼 수 없는데, 화면에 이유가 없으면 "왜 이름이 안 보이냐"는 문의가 됩니다.
 * 게이트는 숨기는 것이 아니라 설명하는 편이 낫습니다.
 */
const NAV = [
  { href: '/org', label: '대시보드' },
  { href: '/org/jobs', label: '채용 요청', badge: 'jobs' as const },
  { href: '/org/candidates', label: '후보자 검색' },
  { href: '/org/interviews', label: '면접 관리', badge: 'interviews' as const },
];

export async function OrgShell({
  children, orgName, verificationStatus,
}: {
  children: React.ReactNode;
  orgName?: string;
  verificationStatus?: string;
}) {
  const verified = verificationStatus === 'VERIFIED';
  const [me, badges] = await Promise.all([currentUser(), orgBadges()]);
  return (
    <div className="cl-shell">
      <nav className="cl-sidebar">
        <Link
          href="/org"
          style={{
            display: 'block', padding: '0 var(--cl-s6) var(--cl-s5)',
            fontWeight: 700, letterSpacing: '.2em', fontSize: 'var(--cl-subtitle)',
            color: 'var(--cl-text)',
          }}
        >
          CareLink
        </Link>

        {orgName && (
          <div style={{ padding: '0 var(--cl-s6) var(--cl-s5)' }}>
            <div style={{ fontSize: 'var(--cl-body)', fontWeight: 600, marginBottom: 'var(--cl-s2)' }}>
              {orgName}
            </div>
            <StatusPill
              tone={verified ? 'signal' : 'flag'}
              label={verified ? '검증 완료' : '검증 대기'}
            />
            {!verified && (
              <p
                style={{
                  margin: 'var(--cl-s3) 0 0', fontSize: 'var(--cl-micro)',
                  color: 'var(--cl-text-muted)', lineHeight: 1.6,
                }}
              >
                검증이 끝나기 전에는 후보자가 익명 ID로만 표시됩니다.
              </p>
            )}
          </div>
        )}

        {NAV.map((item) => (
          <NavItem
            key={item.href}
            href={item.href}
            label={item.label}
            badge={'badge' in item && item.badge ? badges[item.badge] : undefined}
          />
        ))}

        <div style={{ padding: 'var(--cl-s6)' }}>
          <LocaleSwitcher locale="ko" variant="desk" />
          <SessionBox phone={me?.phone ?? undefined} />
        </div>
      </nav>
      <main className="cl-main">{children}</main>
    </div>
  );
}
