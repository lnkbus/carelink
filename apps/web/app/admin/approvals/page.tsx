import type { PendingRoleRequest } from '@carelink/shared-types';
import { KpiChip, KpiRow, PageHeader, Section } from '@carelink/ui';
import { AdminShell } from '@/components/AdminShell';
import { ApprovalQueue } from '@/components/ApprovalQueue';
import { ApiError, apiGet } from '@/lib/api';
import { redirectToLogin } from '@/lib/session';

export const dynamic = 'force-dynamic';

/**
 * 운영자 승인 큐 — 기관 첫 담당자와 파트너 제휴.
 *
 * 두 번째 이후 담당자는 그 기관의 관리자가 처리하지만, 여기에도 보입니다.
 * 기관 관리자가 응답하지 않는 동안 신청자가 무기한 기다리는 것을 막는
 * 뒷문입니다 — 없으면 운영자가 psql을 열게 됩니다.
 *
 * 이 큐가 밀리면 기관 담당자는 로그인해도 아무 화면을 못 엽니다. 사이드바
 * 배지가 그래서 붙어 있습니다.
 */
export default async function ApprovalsPage() {
  let items: PendingRoleRequest[];
  try {
    items = await apiGet<PendingRoleRequest[]>('/admin/role-requests');
  } catch (e) {
    if (e instanceof ApiError && (e.status === 401 || e.status === 403)) redirectToLogin(e);
    throw e;
  }

  const firstContacts = items.filter((r) => r.becomesAdmin).length;
  const partners = items.filter((r) => r.role === 'PARTNER').length;
  const joins = items.length - firstContacts - partners;

  return (
    <AdminShell>
      <PageHeader
        title="가입 승인"
        description="소속 승인과 사업자 검증은 별개입니다. 여기서 승인해도 기관 검증이 끝나기 전에는 후보자가 익명 ID로만 보입니다."
      />
      <div className="cl-body">
        <div style={{ marginTop: 'var(--cl-s6)' }}>
          <KpiRow>
            <KpiChip label="승인 대기" value={items.length} unit="건" tone={items.length ? 'flag' : 'neutral'} />
            <KpiChip
              label="기관 첫 담당자"
              value={firstContacts}
              unit="건"
              hint="승인하면 그 기관의 관리자가 됩니다 — 이후 동료는 이 사람이 승인합니다"
            />
            <KpiChip label="합류 신청" value={joins} unit="건" />
            <KpiChip
              label="파트너 제휴"
              value={partners}
              unit="건"
              hint="제휴는 계약이라 운영자만 승인합니다"
            />
          </KpiRow>
        </div>

        <Section
          title="승인 대기"
          note="반려하면 신청 행을 지우고 사유를 감사 로그에 남깁니다. 사유 없이는 반려할 수 없습니다 — 신청자가 같은 신청을 다시 냅니다."
        >
          <ApprovalQueue
            items={items}
            audience="admin"
            emptyNote="승인을 기다리는 신청이 없습니다."
          />
        </Section>
      </div>
    </AdminShell>
  );
}
