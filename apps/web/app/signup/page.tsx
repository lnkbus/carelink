import { redirect } from 'next/navigation';
import { LoginRequired, Note, Notes, PathCard, SignupCard } from './Card';
import { APP_URL } from '@/lib/intro';
import { currentUser, landingFor } from '@/lib/session';

export const dynamic = 'force-dynamic';

/**
 * SCR-002 신청 자격 선택.
 *
 * ── 왜 로그인 뒤가 아닌가 ────────────────────────────────────────────
 * '가입'이라는 말과 달리 계정은 로그인할 때 이미 만들어집니다 (번호 +
 * 인증번호). 여기서 하는 일은 **무엇으로 쓸 것인지 신청**하는 것입니다.
 * 그래서 화면은 로그인 없이 열어 두고, 신청서를 낼 때 번호를 받습니다.
 *
 * ── 앱 사용자를 여기서 붙잡지 않습니다 ───────────────────────────────
 * 후보자·간병사·보호자는 신청이 없습니다 — 앱에서 역할을 고르면 그
 * 자리에서 열립니다. 그 사람들이 이 화면에 왔다면 주소를 잘못 찾은
 * 것이므로, 폼을 보여 주는 대신 앱으로 보냅니다.
 */
const PATHS = [
  {
    block: 'SCR-002-02',
    href: '/signup/org',
    icon: 'building' as const,
    tone: 'org' as const,
    title: '기관으로 신청',
    who: '병원 · 요양원 · 재활병원 담당자',
    body: '병원 · 요양기관이 인력을 요청하려면 여기입니다. 사업자등록번호로 기관을 새로 등록하거나, 이미 등록된 기관에 담당자로 합류합니다.',
  },
  {
    block: 'SCR-002-03',
    href: '/signup/partner',
    icon: 'users' as const,
    tone: 'partner' as const,
    title: '파트너로 제휴 신청',
    who: '교육기관 · 대학 · 해외 송출기관',
    body: '교육기관 · 송출기관이 후보자를 보내는 경로입니다. 제휴는 계약이라 운영자가 확인한 뒤 열립니다.',
  },
];

export default async function SignupPage() {
  const me = await currentUser();
  const landing = me ? landingFor(me) : null;
  // 이미 쓸 수 있는 화면이 있거나 신청이 대기 중이면 신청서를 또 받지
  // 않습니다 — 두 번 내면 승인 큐에 같은 사람이 둘 쌓입니다.
  if (landing && landing !== '/no-access') redirect(landing);

  return (
    <SignupCard
      landing={landing}
      title="어떤 자격으로 쓰시나요"
      // 로그인 전에는 계정이 아직 없습니다. '이미 만들어졌습니다'를 그대로
      // 두면 처음 온 사람에게 거짓말이 됩니다.
      lead={
        me
          ? '계정은 이미 만들어졌습니다. 이제 무엇으로 쓸지 신청합니다.'
          : '기관과 파트너는 신청 후 승인을 거칩니다. 무엇을 신청하는지 먼저 보시고, 번호 인증은 신청서를 낼 때 합니다.'
      }
      headBlock="SCR-002-01"
      caption="문의 1600-0000 · 평일 09:00–18:00"
      captionBlock="SCR-002-07"
    >
      <div className="cl-su-paths">
        {PATHS.map((p) => (
          <PathCard key={p.href} {...p} />
        ))}
      </div>

      {/* 로그인했으면 이 안내는 할 일이 없습니다. */}
      {!me && <LoginRequired next="/signup" block="SCR-002-04" />}

      <Notes>
        <Note icon="phone" block="SCR-002-05">
          <b>후보자 · 간병사 · 보호자이신가요?</b>
          <br />
          신청이 필요 없습니다. <a href={APP_URL}>앱</a>에서 역할을 고르면 그 자리에서
          시작합니다. 이 주소는 운영자와 기관 담당자를 위한 화면입니다.
        </Note>

        <Note icon="shield" block="SCR-002-06">
          기관 신청은 <b>승인이 두 단계</b>입니다. 먼저 담당자 소속을 승인받아 기관
          화면이 열리고, 사업자 검증이 끝나야 후보자의 실명과 연락처가 보입니다.
          검증 전에는 <code>CD-1001</code> 같은 익명 ID로만 표시됩니다.
        </Note>
      </Notes>
    </SignupCard>
  );
}
