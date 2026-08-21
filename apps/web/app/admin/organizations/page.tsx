import { redirect } from 'next/navigation';
import type { Organization, Paged } from '@carelink/shared-types';
import { DataTable, KpiChip, KpiRow, PageHeader, Restricted, Section, StatusPill, Td, Tr } from '@carelink/ui';
import { AdminShell } from '@/components/AdminShell';
import { ApiError, apiGet } from '@/lib/api';
import { label } from '@/lib/labels-admin';
import { redirectToLogin } from '@/lib/session';

export const dynamic = 'force-dynamic';

const VERIFY_TONE: Record<string, 'signal' | 'flag' | 'alert' | 'neutral'> = {
  VERIFIED: 'signal', PENDING: 'flag', UNDER_REVIEW: 'flag', REJECTED: 'alert', SUSPENDED: 'alert',
};

const E7_TONE: Record<string, 'signal' | 'flag' | 'alert' | 'neutral'> = {
  ELIGIBLE: 'signal', CONDITIONAL: 'flag', INELIGIBLE: 'alert', NOT_REVIEWED: 'neutral',
};

/**
 * SCR-503 기관 관리.
 *
 * `verification_status = VERIFIED`가 후보자 개인정보 조회의 게이트입니다 (§6-6).
 * 그래서 검증 상태를 다른 열 뒤에 두지 않고 이름 바로 옆에 둡니다 —
 * 이 화면에서 가장 자주 확인하는 값입니다.
 *
 * E-7-2 스폰서 자격은 별개입니다. 검증된 기관이라도 스폰서 자격이 없으면
 * 외국인력을 배치할 수 없습니다 (§6-17).
 */
export default async function OrganizationsPage() {
  let data: Paged<Organization>;
  try {
    data = await apiGet<Paged<Organization>>('/organizations', { size: 50 });
  } catch (e) {
    if (e instanceof ApiError && (e.status === 401 || e.status === 403)) redirectToLogin(e);
    throw e;
  }

  const verified = data.items.filter((o) => o.verificationStatus === 'VERIFIED').length;
  const pending = data.items.filter((o) => o.verificationStatus !== 'VERIFIED').length;
  const e7 = data.items.filter((o) => o.e7SponsorStatus === 'ELIGIBLE').length;
  const dorm = data.items.filter((o) => o.dormitoryProvided).length;

  return (
    <AdminShell>
      <PageHeader
        title="기관 관리"
        screenId="SCR-503"
        description="검증 상태가 후보자 개인정보 조회의 게이트입니다. 검증 전 기관은 display_code까지만 봅니다."
      />
      <div className="cl-body">
        <div style={{ marginTop: 'var(--cl-s6)' }}>
          <KpiRow>
            <KpiChip label="전체 기관" value={data.total} unit="곳" />
            <KpiChip label="검증 완료" value={verified} unit="곳" tone="signal" />
            <KpiChip label="검증 대기" value={pending} unit="곳" tone={pending ? 'flag' : 'neutral'} />
            <KpiChip
              label="E-7-2 스폰서 적격"
              value={e7}
              unit="곳"
              tone={e7 ? 'signal' : 'neutral'}
              hint="스폰서 미검증 시설에 외국인력을 배치하면 안 됩니다 (§6-17)"
            />
            <KpiChip label="기숙사 제공" value={dorm} unit="곳" />
          </KpiRow>
        </div>

        <Section
          title="기관"
          note="사업자번호·담당자 연락처는 운영자와 그 기관 소속 담당자에게만 보입니다. 권한 밖 필드는 회색 처리가 아니라 렌더링하지 않습니다."
        >
          <DataTable
            columns={[
              { key: 'name', label: '기관명' },
              { key: 'verify', label: '검증', width: 120 },
              { key: 'type', label: '유형', width: 120 },
              { key: 'region', label: '지역', width: 110 },
              { key: 'e7', label: 'E-7-2 스폰서', width: 130 },
              { key: 'support', label: '지원', width: 150 },
              { key: 'contact', label: '담당자', width: 160 },
            ]}
            empty="등록된 기관이 없습니다"
          >
            {data.items.map((o) => (
              <Tr key={o.id} tone={o.verificationStatus === 'REJECTED' ? 'alert' : undefined}>
                <Td>{o.name}</Td>
                <Td>
                  <StatusPill
                    tone={VERIFY_TONE[o.verificationStatus] ?? 'neutral'}
                    label={label(o.verificationStatus)}
                  />
                </Td>
                <Td tone="muted">{label(o.orgType)}</Td>
                <Td>{o.region ?? '—'}</Td>
                <Td>
                  {o.e7SponsorStatus
                    ? <StatusPill tone={E7_TONE[o.e7SponsorStatus] ?? 'neutral'} label={label(o.e7SponsorStatus)} />
                    : <Restricted reason="운영자 전용" />}
                </Td>
                <Td tone="muted">
                  {[o.dormitoryProvided ? '기숙사' : null, o.koreanSupportStaff ? '한국어 지원' : null]
                    .filter(Boolean).join(' · ') || '—'}
                </Td>
                <Td>
                  {o.contactName
                    ? (
                      <span>
                        {o.contactName}
                        {o.contactPhone && (
                          <span style={{ fontFamily: 'var(--cl-font-mono)', color: 'var(--cl-text-muted)', marginLeft: 6 }}>
                            {o.contactPhone}
                          </span>
                        )}
                      </span>
                    )
                    : <Restricted reason="소속 담당자만" />}
                </Td>
              </Tr>
            ))}
          </DataTable>
        </Section>
      </div>
    </AdminShell>
  );
}
