import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Cohort } from '@carelink/shared-types';
import { DataTable, KpiChip, KpiRow, PageHeader, Section, StatusPill, Td, Tr } from '@carelink/ui';
import { Shell } from '@/components/Shell';
import { ApiError, apiGet } from '@/lib/api';
import { label } from '@/lib/labels';

export const dynamic = 'force-dynamic';

const STATUS_TONE: Record<string, 'signal' | 'flag' | 'action' | 'neutral'> = {
  PLACEMENT: 'signal', IN_TRAINING: 'action', EXAM: 'action',
  RECRUITING: 'flag', PLANNED: 'neutral', CLOSED: 'neutral',
};

/** SCR-511 코호트 목록. 상세(퍼널·이탈 시점)는 개별 코호트 화면에 있습니다. */
export default async function CohortsPage() {
  let cohorts: Cohort[];
  try {
    cohorts = await apiGet<Cohort[]>('/admin/recruiting/cohorts');
  } catch (e) {
    if (e instanceof ApiError && (e.status === 401 || e.status === 403)) redirect('/login');
    throw e;
  }

  const running = cohorts.filter((c) => !['PLANNED', 'CLOSED'].includes(c.status)).length;
  const target = cohorts.reduce((s, c) => s + (c.targetSize ?? 0), 0);

  return (
    <Shell>
      <PageHeader
        title="코호트"
        screenId="SCR-511"
        description="첫 기수의 목표는 규모가 아니라 E-7-2 발급 실적입니다. 15명이면 성공이고, 그 15명이 다음 기수 모집 사례가 됩니다."
      />
      <div className="cl-body">
        <div style={{ marginTop: 'var(--cl-s6)' }}>
          <KpiRow>
            <KpiChip label="전체 기수" value={cohorts.length} unit="기" />
            <KpiChip label="진행 중" value={running} unit="기" tone={running ? 'action' : 'neutral'} />
            <KpiChip label="목표 인원 합계" value={target} unit="명" />
          </KpiRow>
        </div>

        <Section title="기수" note="기수를 클릭하면 퍼널과 이탈 시점 분석을 봅니다.">
          <DataTable
            columns={[
              { key: 'code', label: '코드', width: 160 },
              { key: 'name', label: '이름' },
              { key: 'channel', label: '채널', width: 200 },
              { key: 'status', label: '상태', width: 120 },
              { key: 'target', label: '목표', align: 'right', width: 90 },
              { key: 'start', label: '시작', width: 120 },
              { key: 'place', label: '배치 예정', width: 120 },
            ]}
            empty="등록된 기수가 없습니다"
          >
            {cohorts.map((c) => (
              <Tr key={c.id}>
                <Td mono>
                  <Link href={`/cohorts/${c.id}`} style={{ fontFamily: 'var(--cl-font-mono)' }}>{c.code}</Link>
                </Td>
                <Td>{c.name}</Td>
                <Td tone="muted">{c.channelCode}</Td>
                <Td><StatusPill tone={STATUS_TONE[c.status] ?? 'neutral'} label={label(c.status)} /></Td>
                <Td mono align="right">{c.targetSize ?? '—'}</Td>
                <Td mono tone="muted">{c.startsOn ?? '—'}</Td>
                <Td mono tone="muted">{c.expectedPlacementOn ?? '—'}</Td>
              </Tr>
            ))}
          </DataTable>
        </Section>
      </div>
    </Shell>
  );
}
