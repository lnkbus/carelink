import { redirect } from 'next/navigation';
import type { Industry } from '@carelink/shared-types';
import { Note, SignupCard } from '../Card';
import { OrgSignupForm } from './OrgSignupForm';
import { apiGet } from '@/lib/api';
import { currentUser, landingFor } from '@/lib/session';

export const dynamic = 'force-dynamic';

/**
 * 기관 가입 신청.
 *
 * 만들어지는 상태는 둘 다 '대기'입니다:
 *   organizations.verification_status = PENDING   운영자가 사업자등록증 확인
 *   user_roles.approved_at            = NULL      운영자가 소속 승인
 *
 * 자동으로 열지 않는 이유는 화면에도 적어 둡니다. 아무나 사업자번호를
 * 지어내 기관을 만들면 검증 전이라도 채용 요청을 올려 후보자에게 노출됩니다.
 */
export default async function OrgSignupPage() {
  const me = await currentUser();
  if (!me) redirect('/login');
  const landing = landingFor(me);
  if (landing !== '/no-access') redirect(landing);

  // 산업 목록은 로그인한 사용자면 누구나 봅니다 — 기관명·라벨이라 개인정보가
  // 아닙니다. 실패하면 빈 목록으로 두고 폼이 그 사실을 말합니다.
  const industries = await apiGet<Industry[]>('/industries').catch(() => [] as Industry[]);

  return (
    <SignupCard
      title="기관 등록 신청"
      lead="사업자등록번호를 먼저 넣어 주세요. 이미 등록된 기관이면 합류 신청으로 안내합니다."
      back={{ href: '/signup', label: '뒤로' }}
    >
      {industries.length === 0 ? (
        <Note>
          산업 목록을 불러오지 못했습니다. 잠시 뒤 다시 시도해 주세요 — 이 값이 없으면
          신청을 접수해도 어느 산업의 기관인지 정할 수 없습니다.
        </Note>
      ) : (
        <OrgSignupForm industries={industries} />
      )}

      <Note>
        신청하면 <strong style={{ color: 'var(--cl-text)' }}>운영자가 사업자등록증을 확인</strong>합니다.
        승인되면 담당자로 기관 화면이 열리고, 이후 같은 기관의 다른 담당자는 첫 담당자가
        직접 승인합니다.
      </Note>
      <Note>
        소속 승인과 사업자 검증은 <strong style={{ color: 'var(--cl-text)' }}>별개</strong>입니다.
        승인을 받아 화면이 열려도 검증이 끝나기 전에는 후보자가 <code>CD-1001</code> 형태의
        익명 ID로만 보입니다. 실명과 연락처는 검증 완료 + 후보자가 면접 요청을 수락한
        뒤에 열립니다.
      </Note>
    </SignupCard>
  );
}
