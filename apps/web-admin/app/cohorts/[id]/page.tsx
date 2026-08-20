import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { CohortDetail } from '@carelink/shared-types';
import {
  DataTable, FunnelTable, KpiChip, KpiRow, PageHeader, Section, StatusPill, Td, Tr,
} from '@carelink/ui';
import { Shell } from '@/components/Shell';
import { ApiError, apiGet } from '@/lib/api';
import { label } from '@/lib/labels';

export const dynamic = 'force-dynamic';

const STAGE_TONE: Record<string, 'signal' | 'flag' | 'alert' | 'action' | 'neutral'> = {
  PLACED: 'signal', EXAM_PASSED: 'signal', COMPLETED: 'action',
  IN_TRAINING: 'action', SELECTED: 'flag', APPLIED: 'neutral', DROPPED: 'alert',
};

/**
 * SCR-511 코호트 상세 — 퍼널 + 이탈 시점.
 *
 * **이탈 '시점'을 기록하는 것이 이 화면의 존재 이유입니다.**
 * "이탈률 20%"는 정보가 아니고 "교육 6주차 집중 이탈"이 대응 가능한 정보입니다.
 * 그래서 이탈률 KPI 하나로 요약하지 않고, 어느 단계에서 몇 명이 왜 빠졌는지를
 * 퍼널 바로 아래에 둡니다.
 *
 * 퍼널 인원은 '그 단계 이상 도달한 누적'입니다. 이탈자도 도달한 단계까지는
 * 세야 합니다 — 현재 상태로만 세면 이탈이 많은 기수일수록 퍼널이 좋아 보입니다.
 */
export default async function CohortDetailPage({ params }: { params: { id: string } }) {
  let data: CohortDetail;
  try {
    data = await apiGet<CohortDetail>(`/admin/recruiting/cohorts/${params.id}`);
  } catch (e) {
    if (e instanceof ApiError && (e.status === 401 || e.status === 403)) redirect('/login');
    throw e;
  }

  const dropped = data.members.filter((m) => m.stage === 'DROPPED').length;
  const placed = data.members.filter((m) => m.stage === 'PLACED').length;
  const applied = data.funnel[0]?.count ?? 0;
  const undocumented = data.dropAnalysis.filter((d) => !d.dropReason).reduce((s, d) => s + d.count, 0);

  return (
    <Shell>
      <PageHeader
        title={data.cohort.name}
        screenId="SCR-511"
        description={`${data.cohort.code} · ${data.cohort.channelCode}`}
        actions={<Link href="/cohorts" style={{ fontSize: 'var(--cl-caption)' }}>← 기수 목록</Link>}
      />
      <div className="cl-body">
        <div style={{ marginTop: 'var(--cl-s6)' }}>
          <KpiRow>
            <KpiChip label="지원" value={applied} unit="명" />
            <KpiChip label="목표" value={data.cohort.targetSize ?? '—'} unit="명" />
            <KpiChip label="배치 완료" value={placed} unit="명" tone={placed ? 'signal' : 'neutral'} />
            <KpiChip label="이탈" value={dropped} unit="명" tone={dropped ? 'flag' : 'neutral'} />
            <KpiChip label="상태" value={label(data.cohort.status)} />
          </KpiRow>
        </div>

        <Section
          title="퍼널"
          note="인원은 그 단계 이상 도달한 누적입니다. 교육 중 이탈한 사람도 지원·선발·교육은 지나왔으므로 앞 단계에 포함됩니다."
        >
          <FunnelTable
            rows={data.funnel.map((f) => ({
              stage: f.stage,
              label: label(f.stage),
              count: f.count,
              conversionPct: f.conversionPct,
              blocked: data.dropAnalysis
                .filter((d) => d.droppedStage === f.stage)
                .reduce((s, d) => s + d.count, 0),
            }))}
          />
        </Section>

        <Section
          title="이탈 시점"
          note='"이탈률 20%"는 대응할 수 없고 "교육 6주차 집중 이탈"은 대응할 수 있습니다. 이 표가 recruiting 모듈의 존재 이유입니다.'
          aside={
            undocumented > 0
              ? <StatusPill tone="alert" label={`사유 미기록 ${undocumented}건`} />
              : undefined
          }
        >
          <DataTable
            columns={[
              { key: 'stage', label: '이탈 단계', width: 160 },
              { key: 'reason', label: '사유' },
              { key: 'count', label: '인원', align: 'right', width: 90 },
            ]}
            empty="이탈이 없습니다"
          >
            {data.dropAnalysis.map((d, i) => (
              <Tr key={`${d.droppedStage}-${i}`} tone={!d.dropReason ? 'alert' : undefined}>
                <Td>{label(d.droppedStage)}</Td>
                <Td tone={d.dropReason ? undefined : 'alert'}>
                  {d.dropReason ?? '사유가 기록되지 않았습니다 — 이 건은 개선에 쓸 수 없습니다'}
                </Td>
                <Td mono align="right">{d.count}</Td>
              </Tr>
            ))}
          </DataTable>
        </Section>

        <Section title="구성원">
          <DataTable
            columns={[
              { key: 'code', label: 'ID', width: 120 },
              { key: 'stage', label: '현재 단계', width: 140 },
              { key: 'dropped', label: '이탈 단계', width: 140 },
              { key: 'reason', label: '이탈 사유' },
              { key: 'joined', label: '편입', width: 120 },
            ]}
            empty="구성원이 없습니다"
          >
            {data.members.map((m) => (
              <Tr key={m.id} tone={m.stage === 'DROPPED' ? 'alert' : undefined}>
                <Td mono>{m.displayCode}</Td>
                <Td><StatusPill tone={STAGE_TONE[m.stage] ?? 'neutral'} label={label(m.stage)} /></Td>
                <Td tone="muted">{m.droppedStage ? label(m.droppedStage) : '—'}</Td>
                <Td tone="muted">{m.dropReason ?? '—'}</Td>
                <Td mono tone="muted">{m.joinedAt.slice(0, 10)}</Td>
              </Tr>
            ))}
          </DataTable>
        </Section>
      </div>
    </Shell>
  );
}
