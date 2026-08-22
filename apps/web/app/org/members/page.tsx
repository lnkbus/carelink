import type { PendingRoleRequest } from '@carelink/shared-types';
import { PageHeader, Section } from '@carelink/ui';
import { ApprovalQueue } from '@/components/ApprovalQueue';
import { OrgShell } from '@/components/OrgShell';
import { ApiError, apiGet } from '@/lib/api';
import { currentOrg, redirectToLogin } from '@/lib/session';

export const dynamic = 'force-dynamic';

/**
 * 기관 담당자 승인 — 그 기관의 관리자만.
 *
 * 운영자가 모든 기관의 모든 입사자를 승인하면 그 큐는 반드시 밀립니다.
 * 새 담당자가 들어오는 일은 기관에서 가장 자주 일어나는 일이고, 그때마다
 * 외부에 요청해야 하면 기관은 계정을 돌려 쓰기 시작합니다 — 누가 무엇을
 * 했는지가 사라집니다.
 *
 * 자기 기관 신청만 나옵니다. 남의 기관 신청서는 그 자체가 개인정보라
 * 서버가 애초에 내려보내지 않습니다.
 */
export default async function OrgMembersPage() {
  const org = await currentOrg();

  let items: PendingRoleRequest[];
  try {
    items = await apiGet<PendingRoleRequest[]>('/organizations/me/members/pending');
  } catch (e) {
    // ORG_ADMIN이 아니면 403입니다. 사이드바에 항목을 걸지 않으므로 보통
    // 여기 오지 않지만, 주소를 직접 친 경우를 위해 이유를 들려 보냅니다.
    if (e instanceof ApiError && (e.status === 401 || e.status === 403)) redirectToLogin(e);
    throw e;
  }

  return (
    <OrgShell orgName={org.name} verificationStatus={org.verificationStatus}>
      <PageHeader
        title="담당자 승인"
        description="우리 기관으로 합류를 신청한 사람입니다. 승인하면 채용 요청과 후보자 검색 화면이 열립니다."
      />
      <div className="cl-body">
        <Section
          title="승인 대기"
          note="승인하기 전에 신청자에게 전화로 확인하세요. 화면에 있는 것은 번호와 신청 시각뿐이고, 그 사람이 우리 직원인지는 시스템이 알 수 없습니다."
        >
          <ApprovalQueue
            items={items}
            audience="org"
            emptyNote="합류를 신청한 사람이 없습니다."
          />
        </Section>
      </div>
    </OrgShell>
  );
}
