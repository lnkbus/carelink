import Link from 'next/link';
import { redirect } from 'next/navigation';
import { StatusPill } from '@carelink/ui';
import { RoleDecisionNotice } from '@/components/RoleDecisionNotice';
import { LogoutLink } from '@/components/SessionBox';
import { Note, SignupCard } from '../signup/Card';
import { currentUser, hasPending, landingFor } from '@/lib/session';

export const dynamic = 'force-dynamic';

/**
 * 승인 대기.
 *
 * ── 왜 별도 화면인가 ────────────────────────────────────────────────
 * 종전에는 신청해 둔 사람과 볼 화면이 없는 사람이 똑같이 `/no-access`를
 * 봤습니다. 방금 신청서를 낸 사람이 '사용할 수 있는 화면이 없습니다'를
 * 읽으면 신청이 접수되지 않았다고 생각하고 **한 번 더 신청합니다** —
 * 승인 큐에 같은 사람이 둘 쌓입니다.
 *
 * 그래서 이 화면은 세 가지를 말합니다: 무엇을 신청했는가, 누가 승인하는가,
 * 승인되면 무엇이 열리는가. 기다리는 시간이 같아도 아는 채로 기다리는
 * 것과 모르는 채로 기다리는 것은 다릅니다.
 */
const WHO_APPROVES: Record<string, string> = {
  ORG_MEMBER: '운영자 또는 그 기관의 관리자',
  ORG_ADMIN: '운영자',
  PARTNER: '운영자',
};

// 라벨이 '승인되면 ·'이므로 문장은 그 뒤를 잇습니다. 여기에 '승인되면'을
// 또 쓰면 화면에 두 번 나옵니다 — 실제로 그렇게 나왔습니다.
const WHAT_OPENS: Record<string, string> = {
  ORG_MEMBER: '채용 요청 · 후보자 검색 · 면접 관리 화면이 열립니다.',
  ORG_ADMIN: '기관 화면과 함께 담당자 승인 권한이 열립니다.',
  PARTNER: '보낸 후보자의 교육 이력을 볼 수 있습니다.',
};

const ROLE_LABEL: Record<string, string> = {
  ORG_MEMBER: '기관 담당자',
  ORG_ADMIN: '기관 관리자',
  PARTNER: '파트너',
};

export default async function PendingPage() {
  const me = await currentUser();
  if (!me) redirect('/login');
  // 승인이 끝났으면 여기 머물 이유가 없습니다. 사용자가 새로 고칠 때마다
  // 자기 화면으로 넘어갑니다 — 승인됐다는 사실을 따로 알릴 방법이 아직
  // 없기 때문에, 이 자동 이동이 그 역할을 합니다.
  if (!hasPending(me)) redirect(landingFor(me));

  const pending = me.roles.filter((r) => !r.approved);

  return (
    <SignupCard
      title="승인을 기다리는 중입니다"
      lead="신청은 접수됐습니다. 다시 신청하지 않으셔도 됩니다."
      // 대기자에게 '내 화면으로'는 지금 있는 이 화면입니다. 로그아웃은
      // 카드 안에 있습니다.
      headerCta={false}
      caption="문의 1600-0000 · 평일 09:00–18:00"
    >
      {/* 여러 건을 신청한 사람은 하나가 반려되고 하나가 대기 중일 수
          있습니다. 결과를 먼저 보여 줍니다 — 대기 목록만 보면 반려된 건이
          조용히 사라진 것으로 읽힙니다. */}
      <RoleDecisionNotice />

      <div style={{ display: 'grid', gap: 'var(--cl-s4)' }}>
        {pending.map((r) => (
          <div
            key={`${r.role}:${r.organizationId ?? ''}`}
            style={{
              padding: 'var(--cl-s5)', border: '1px solid var(--cl-line-strong)', borderRadius: 14,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--cl-s3)', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 18, fontWeight: 700 }}>{ROLE_LABEL[r.role] ?? r.role}</span>
              <StatusPill tone="flag" label="승인 대기" />
            </div>
            <dl style={{ margin: 'var(--cl-s4) 0 0', fontSize: 15, lineHeight: 1.8, color: 'var(--cl-text-sub)' }}>
              <div>
                <dt style={{ display: 'inline', fontWeight: 600 }}>승인하는 사람 · </dt>
                <dd style={{ display: 'inline', margin: 0 }}>{WHO_APPROVES[r.role] ?? '운영자'}</dd>
              </div>
              <div>
                <dt style={{ display: 'inline', fontWeight: 600 }}>승인되면 · </dt>
                <dd style={{ display: 'inline', margin: 0 }}>{WHAT_OPENS[r.role] ?? ''}</dd>
              </div>
            </dl>
          </div>
        ))}
      </div>

      <Note>
        승인되면 이 화면을 새로 고치는 것만으로 자기 화면으로 넘어갑니다.
        따로 다시 로그인하지 않으셔도 됩니다.
      </Note>

      {pending.some((r) => r.role === 'ORG_MEMBER' || r.role === 'ORG_ADMIN') && (
        <Note>
          <strong style={{ color: 'var(--cl-text)' }}>소속 승인과 사업자 검증은 별개입니다.</strong>
          {' '}소속이 승인되면 기관 화면이 열리지만, 사업자 검증이 끝나기 전에는 후보자가{' '}
          <code>CD-1001</code> 형태의 익명 ID로만 보입니다. 검증 서류에 문제가 있으면
          운영자가 신청서에 적힌 번호로 연락합니다.
        </Note>
      )}

      <div style={{ marginTop: 'var(--cl-s6)', display: 'flex', gap: 'var(--cl-s5)', alignItems: 'center' }}>
        <LogoutLink />
        <Link href="/signup" style={{ fontSize: 'var(--cl-caption)', color: 'var(--cl-text-muted)' }}>
          다른 자격으로도 신청
        </Link>
      </div>
    </SignupCard>
  );
}
