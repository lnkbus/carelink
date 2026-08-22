import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Note, SignupCard } from './Card';
import { APP_URL } from '@/lib/intro';
import { currentUser, hasPending, landingFor } from '@/lib/session';

export const dynamic = 'force-dynamic';

/**
 * 가입 신청 입구.
 *
 * ── 왜 로그인 뒤에 있나 ──────────────────────────────────────────────
 * '가입'이라는 말과 달리, 계정은 로그인할 때 이미 만들어집니다 (번호 +
 * 인증번호). 여기서 하는 일은 **무엇으로 쓸 것인지 신청**하는 것입니다.
 * 그래서 로그인 전에 이 화면을 놓으면 신청자가 누구인지 모른 채 기관이
 * 만들어지고, 승인할 대상이 없습니다.
 *
 * ── 앱 사용자를 여기서 붙잡지 않습니다 ───────────────────────────────
 * 후보자·간병사·보호자는 신청이 없습니다 — 앱에서 역할을 고르면 그
 * 자리에서 열립니다. 그 사람들이 이 화면에 왔다면 주소를 잘못 찾은
 * 것이므로, 폼을 보여 주는 대신 앱으로 보냅니다.
 */
const PATHS = [
  {
    href: '/signup/org',
    title: '기관으로 신청',
    body: '병원 · 요양기관이 인력을 요청하려면 여기입니다. 사업자등록번호로 기관을 새로 등록하거나, 이미 등록된 기관에 담당자로 합류합니다.',
    who: '병원 · 요양원 · 재활병원 담당자',
  },
  {
    href: '/signup/partner',
    title: '파트너로 제휴 신청',
    body: '교육기관 · 송출기관이 후보자를 보내는 경로입니다. 제휴는 계약이라 운영자가 확인한 뒤 열립니다.',
    who: '교육기관 · 대학 · 해외 송출기관',
  },
];

export default async function SignupPage() {
  const me = await currentUser();
  // 로그인하지 않았으면 로그인 먼저. 로그인 뒤에는 역할이 없으므로
  // `/no-access`로 가고, 거기서 이 화면으로 오는 길이 있습니다.
  if (!me) redirect('/login');
  // 이미 쓸 수 있는 화면이 있거나 신청이 대기 중이면 신청서를 또 받지
  // 않습니다 — 두 번 내면 승인 큐에 같은 사람이 둘 쌓입니다.
  const landing = landingFor(me);
  if (landing !== '/no-access') redirect(landing);

  return (
    <SignupCard
      title="어떤 자격으로 쓰시나요"
      lead="계정은 이미 만들어졌습니다. 이제 무엇으로 쓸지 신청합니다."
    >
      <div style={{ display: 'grid', gap: 'var(--cl-s4)' }}>
        {PATHS.map((p) => (
          <Link
            key={p.href}
            href={p.href}
            style={{
              display: 'block', padding: 'var(--cl-s5)',
              border: '1px solid var(--cl-line-strong)', borderRadius: 14,
              color: 'var(--cl-text)',
            }}
          >
            <div style={{ fontSize: 18, fontWeight: 700 }}>{p.title}</div>
            <div style={{ marginTop: 6, fontSize: 12, color: 'var(--cl-text-muted)', letterSpacing: '.04em' }}>
              {p.who}
            </div>
            <div style={{ marginTop: 8, fontSize: 15, lineHeight: 1.6, color: 'var(--cl-text-sub)' }}>
              {p.body}
            </div>
          </Link>
        ))}
      </div>

      <Note>
        <strong style={{ color: 'var(--cl-text)' }}>후보자 · 간병사 · 보호자이신가요?</strong>
        <br />
        신청이 필요 없습니다. <a href={APP_URL} style={{ color: 'var(--cl-action-strong)' }}>앱</a>에서
        역할을 고르면 그 자리에서 시작합니다. 이 주소는 운영자와 기관 담당자를 위한 화면입니다.
      </Note>

      <Note>
        기관 신청은 <strong style={{ color: 'var(--cl-text)' }}>승인이 두 단계</strong>입니다.
        먼저 담당자 소속을 승인받아 기관 화면이 열리고, 사업자 검증이 끝나야 후보자의
        실명과 연락처가 보입니다. 검증 전에는 <code>CD-1001</code> 같은 익명 ID로만 표시됩니다.
      </Note>
    </SignupCard>
  );
}
