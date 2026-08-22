import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Note, SignupCard } from './Card';
import { APP_URL } from '@/lib/intro';
import { currentUser, landingFor } from '@/lib/session';

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

  // **로그인하지 않아도 이 화면은 보여 줍니다.**
  //
  // 종전에는 여기서 `/login`으로 돌려보냈습니다. 무엇을 신청할 수 있는지
  // 보기도 전에 번호부터 넣으라는 뜻이었고, 순서가 거꾸로입니다. 게다가
  // 서버 리다이렉트라 인트로에서 '가입 신청'을 눌러도 화면이 그대로
  // 머물렀습니다 — 버튼이 죽은 것처럼 보였습니다.
  //
  // 로그인은 **신청서를 낼 때** 필요합니다. 그때 안내합니다.
  if (me) {
    // 이미 쓸 수 있는 화면이 있거나 신청이 대기 중이면 신청서를 또 받지
    // 않습니다 — 두 번 내면 승인 큐에 같은 사람이 둘 쌓입니다.
    const landing = landingFor(me);
    if (landing !== '/no-access') redirect(landing);
  }

  return (
    <SignupCard
      title="어떤 자격으로 쓰시나요"
      // 로그인 전에는 계정이 아직 없습니다. '이미 만들어졌습니다'를 그대로
      // 두면 처음 온 사람에게 거짓말이 됩니다.
      lead={
        me
          ? '계정은 이미 만들어졌습니다. 이제 무엇으로 쓸지 신청합니다.'
          : '기관과 파트너는 신청 후 승인을 거칩니다. 무엇을 신청하는지 먼저 보시고, 번호 인증은 신청서를 낼 때 합니다.'
      }
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

      {!me && (
        <Note>
          신청서를 내려면 <strong style={{ color: 'var(--cl-text)' }}>휴대폰 번호 인증</strong>이
          필요합니다. 비밀번호는 없습니다 — 번호를 넣으면 인증 문자가 갑니다.
          {' '}
          <Link href="/login?next=/signup" style={{ color: 'var(--cl-action-strong)', fontWeight: 600 }}>
            번호 인증하고 계속하기
          </Link>
        </Note>
      )}

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
