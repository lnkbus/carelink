import { redirect } from 'next/navigation';
import type { Engagement } from '@carelink/shared-types';
import { DataTable, KpiChip, KpiRow, PageHeader, Section, StatusPill, Td, Tr } from '@carelink/ui';
import { Shell } from '@/components/Shell';
import { ApiError, apiGet } from '@/lib/api';
import { label } from '@/lib/labels';

export const dynamic = 'force-dynamic';

const STATUS_TONE: Record<string, 'signal' | 'flag' | 'alert' | 'action' | 'neutral'> = {
  ACTIVE: 'signal', CONTRACT_PENDING: 'flag', DRAFT: 'neutral',
  SUSPENDED: 'alert', TERMINATED: 'alert', ENDED: 'neutral',
};

const MODEL_TONE: Record<string, 'signal' | 'flag' | 'action' | 'neutral'> = {
  DIRECT_EMPLOYMENT: 'flag', DELEGATION: 'action', BROKERAGE: 'neutral',
};

/**
 * SCR-508 고용 · 계약.
 *
 * 고용 모델은 전역 설정이 아니라 **배치 단위**에 붙습니다 (§5.7). 전환기에
 * 직접고용과 중개가 병존해야 하고, 지역·트랙별로 다를 수 있기 때문입니다.
 * 그래서 이 화면에 '기본 고용 모델' 설정이 없습니다.
 *
 * 모델 전환은 UPDATE가 아닙니다 — 기존 건을 ENDED 처리하고 새 행을 만들어
 * previous_engagement_id로 잇습니다. 표에서 '전환됨'으로 표시되는 건이 그것입니다.
 */
export default async function EngagementsPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  let rows: Engagement[];
  try {
    rows = await apiGet<Engagement[]>('/engagements', { status: searchParams.status });
  } catch (e) {
    if (e instanceof ApiError && (e.status === 401 || e.status === 403)) redirect('/login');
    throw e;
  }

  const active = rows.filter((r) => r.status === 'ACTIVE').length;
  const pending = rows.filter((r) => r.status === 'CONTRACT_PENDING' || r.status === 'DRAFT').length;
  const direct = rows.filter((r) => r.model === 'DIRECT_EMPLOYMENT').length;
  const switched = rows.filter((r) => r.previousEngagementId !== null).length;

  return (
    <Shell>
      <PageHeader
        title="고용 · 계약"
        screenId="SCR-508"
        description="고용 모델은 배치 단위입니다. 컴플라이언스 체크가 전부 통과하기 전에는 ACTIVE로 갈 수 없습니다."
      />
      <div className="cl-body">
        <div style={{ marginTop: 'var(--cl-s6)' }}>
          <KpiRow>
            <KpiChip label="전체 배치" value={rows.length} unit="건" />
            <KpiChip label="진행 중" value={active} unit="건" tone="signal" />
            <KpiChip label="계약·검토 대기" value={pending} unit="건" tone={pending ? 'flag' : 'neutral'} />
            <KpiChip
              label="직접고용"
              value={direct}
              unit="건"
              tone={direct ? 'flag' : 'neutral'}
              hint="급여 계산은 도급/파견 판정과 근로시간 규정 검토(U1·U2·U5) 이후에 열립니다"
            />
            <KpiChip label="모델 전환" value={switched} unit="건" hint="전환은 UPDATE가 아니라 새 행입니다" />
          </KpiRow>
        </div>

        {direct > 0 && (
          <div
            style={{
              marginTop: 'var(--cl-s6)', padding: 'var(--cl-s5)',
              background: 'var(--cl-flag-tint)', border: '1px solid var(--cl-flag-line)',
              borderRadius: 'var(--cl-r-desk)', color: 'var(--cl-flag)', fontSize: 'var(--cl-body)',
            }}
          >
            <strong style={{ display: 'block', marginBottom: 'var(--cl-s2)' }}>
              직접고용 {direct}건 — 급여 계산은 아직 열려 있지 않습니다
            </strong>
            도급/파견 판정(U1), 파견 허용 여부·근로자공급사업 허가(U2), 24시간 간병의 근로시간 규정
            적용 방식(U5) 검토가 끝나기 전에는 계산 로직을 만들지 않습니다. 지금 가정해서 만들면
            판정이 다르게 나왔을 때 정산을 전부 다시 짜야 합니다.
          </div>
        )}

        <Section
          title="배치"
          note="모델별로 달라지는 것은 인력 지급과 계약 서류·세무 처리뿐입니다. 기관 청구는 고용 모델과 무관합니다."
        >
          <DataTable
            columns={[
              { key: 'code', label: '인력', width: 110 },
              { key: 'org', label: '기관' },
              { key: 'track', label: '트랙', width: 140 },
              { key: 'model', label: '고용 모델', width: 130 },
              { key: 'status', label: '상태', width: 120 },
              { key: 'started', label: '시작', width: 110 },
              { key: 'ended', label: '종료', width: 140 },
            ]}
            empty="배치 건이 없습니다"
          >
            {rows.map((e) => (
              <Tr key={e.id} tone={e.status === 'TERMINATED' || e.status === 'SUSPENDED' ? 'alert' : undefined}>
                <Td mono>{e.displayCode ?? '—'}</Td>
                <Td>{e.organizationName ?? '—'}</Td>
                <Td tone="muted">{label(e.trackCode)}</Td>
                <Td>
                  <span style={{ display: 'inline-flex', gap: 'var(--cl-s1)', alignItems: 'center' }}>
                    <StatusPill tone={MODEL_TONE[e.model] ?? 'neutral'} label={label(e.model)} />
                    {e.previousEngagementId && <StatusPill tone="neutral" label="전환됨" />}
                  </span>
                </Td>
                <Td><StatusPill tone={STATUS_TONE[e.status] ?? 'neutral'} label={label(e.status)} /></Td>
                <Td mono tone="muted">{e.startedOn ?? '—'}</Td>
                <Td mono tone="muted">
                  {e.endedOn ?? '—'}
                  {e.endReason && (
                    <span style={{ fontFamily: 'var(--cl-font)', fontSize: 'var(--cl-caption)', marginLeft: 4 }}>
                      ({label(e.endReason)})
                    </span>
                  )}
                </Td>
              </Tr>
            ))}
          </DataTable>
        </Section>
      </div>
    </Shell>
  );
}
