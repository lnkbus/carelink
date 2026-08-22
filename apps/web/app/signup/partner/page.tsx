import { redirect } from 'next/navigation';
import { Note, SignupCard } from '../Card';
import { PartnerRequest } from './PartnerRequest';
import { currentUser, landingFor } from '@/lib/session';

export const dynamic = 'force-dynamic';

/** 교육기관 · 송출기관 제휴 신청 (SCR-510의 입구). */
export default async function PartnerSignupPage() {
  const me = await currentUser();
  if (!me) redirect('/login');
  const landing = landingFor(me);
  if (landing !== '/no-access') redirect(landing);

  return (
    <SignupCard
      title="파트너 제휴 신청"
      lead="교육기관 · 대학 · 해외 송출기관이 후보자를 보내는 경로입니다."
      back={{ href: '/signup', label: '뒤로' }}
    >
      <PartnerRequest />

      <Note>
        제휴는 <strong style={{ color: 'var(--cl-text)' }}>계약</strong>이라 운영자만 승인합니다.
        기관이 자기를 파트너로 넣을 수는 없습니다. 신청 뒤 운영자가 연락해 계약 조건과
        정산 방식을 확인하고, 그 결과를 확인한 뒤에 파트너로 등록됩니다.
      </Note>
      <Note>
        승인되면 보낸 후보자의 <strong style={{ color: 'var(--cl-text)' }}>교육 이력</strong>을
        볼 수 있습니다. 후보자의 실명·연락처는 열리지 않습니다 — 파트너에게 필요한 것은
        누가 어디까지 진행했는가이고, 그 이상은 후보자의 정보입니다.
      </Note>
    </SignupCard>
  );
}
