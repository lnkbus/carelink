import { redirect } from 'next/navigation';
import type { OpsDashboard } from '@carelink/shared-types';
import { DataTable, KpiChip, KpiRow, PageHeader, Section, StatusPill, Td, Tr } from '@carelink/ui';
import { Shell } from '@/components/Shell';
import { ApiError, apiGet } from '@/lib/api';
import { label } from '@/lib/labels';
import { redirectToLogin } from '@/lib/session';

export const dynamic = 'force-dynamic';

/**
 * SCR-501 운영 대시보드.
 *
 * **모든 지표를 트랙별로 분리합니다** (§5.8). 합산 지표만 보면 어느 트랙이 통했는지
 * 판별할 수 없고, 그러면 다음 기수에 어디로 예산을 넣을지 정할 수 없습니다.
 * 그래서 이 화면에는 '전체 후보자 N명' 같은 단일 숫자가 없습니다.
 */
export default async function DashboardPage() {
  let data: OpsDashboard;
  try {
    data = await apiGet<OpsDashboard>('/admin/metrics');
  } catch (e) {
    if (e instanceof ApiError && (e.status === 401 || e.status === 403)) redirectToLogin(e);
    throw e;
  }

  const overdue = data.todayQueue.filter((q) => q.slaHoursLeft !== null && q.slaHoursLeft < 0);
  const totalPlaced = data.byTrack.reduce((s, t) => s + t.placed, 0);
  const totalReady = data.byTrack.reduce((s, t) => s + t.ready, 0);
  const totalOpen = data.byTrack.reduce((s, t) => s + t.openJobs, 0);

  return (
    <Shell>
      <PageHeader
        title="운영 대시보드"
        screenId="SCR-501"
        description="지표는 트랙별로 나뉘어 있습니다. 합산만 보면 어느 트랙이 통했는지 알 수 없습니다."
      />
      <div className="cl-body">
        <div style={{ marginTop: 'var(--cl-s6)' }}>
          <KpiRow>
            <KpiChip label="배치 완료" value={totalPlaced} unit="명" tone="signal" />
            <KpiChip label="배치 준비" value={totalReady} unit="명" />
            <KpiChip label="열린 채용 요청" value={totalOpen} unit="건" />
            <KpiChip label="오늘 처리 큐" value={data.todayQueue.length} unit="건" tone={data.todayQueue.length ? 'action' : 'neutral'} />
            <KpiChip label="SLA 초과" value={overdue.length} unit="건" tone={overdue.length ? 'alert' : 'neutral'} hint="음수 시간은 이미 넘긴 건입니다" />
            <KpiChip
              label="추천 유입"
              value={data.referral.referred}
              unit="명"
              hint="기존 인력 추천 — 실측상 전환율이 가장 높은 경로라 따로 봅니다"
            />
          </KpiRow>
        </div>

        <Section
          title="트랙별 파이프라인"
          note="avg_days_to_fill 하나만 본다면 이 값입니다 (docs/01 §11). 트랙 간 비교가 목적이므로 합계 행을 두지 않았습니다."
        >
          <DataTable
            columns={[
              { key: 'track', label: '트랙' },
              { key: 'candidates', label: '후보자', align: 'right' },
              { key: 'ready', label: '배치 준비', align: 'right' },
              { key: 'matched', label: '매칭', align: 'right' },
              { key: 'placed', label: '배치', align: 'right' },
              { key: 'jobs', label: '열린 요청', align: 'right' },
              { key: 'apps', label: '지원', align: 'right' },
              { key: 'fill', label: '평균 충원일', align: 'right' },
            ]}
            empty="아직 트랙별 데이터가 없습니다"
          >
            {data.byTrack.map((t) => (
              <Tr key={t.trackCode}>
                <Td>{t.trackLabel}</Td>
                <Td mono align="right">{t.candidates}</Td>
                <Td mono align="right">{t.ready}</Td>
                <Td mono align="right">{t.matched}</Td>
                <Td mono align="right">{t.placed}</Td>
                <Td mono align="right">{t.openJobs}</Td>
                <Td mono align="right">{t.applications}</Td>
                <Td mono align="right" tone={t.avgDaysToFill === null ? 'muted' : undefined}>
                  {t.avgDaysToFill === null ? '—' : `${t.avgDaysToFill}일`}
                </Td>
              </Tr>
            ))}
          </DataTable>
        </Section>

        <Section
          title="오늘 처리 큐"
          note="SLA 초과는 음수로 표기합니다 — 남은 시간과 넘긴 시간을 같은 열에서 읽을 수 있어야 합니다."
          aside={overdue.length > 0 ? <StatusPill tone="alert" label={`초과 ${overdue.length}건`} /> : undefined}
        >
          <DataTable
            columns={[
              { key: 'kind', label: '유형', width: 180 },
              { key: 'label', label: '대상' },
              { key: 'sla', label: 'SLA', width: 120, align: 'right' },
            ]}
            empty="처리할 항목이 없습니다"
          >
            {data.todayQueue.map((q) => {
              const over = q.slaHoursLeft !== null && q.slaHoursLeft < 0;
              return (
                <Tr key={`${q.kind}-${q.targetId}`} tone={over ? 'alert' : undefined}>
                  <Td>{label(q.kind)}</Td>
                  <Td>{q.label}</Td>
                  <Td mono align="right" tone={over ? 'alert' : undefined}>
                    {q.slaHoursLeft === null ? '—' : `${q.slaHoursLeft > 0 ? '+' : ''}${q.slaHoursLeft}h`}
                  </Td>
                </Tr>
              );
            })}
          </DataTable>
        </Section>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--cl-s6)' }}>
          <Section title="공급 파이프라인">
            <DataTable
              columns={[{ key: 'step', label: '단계' }, { key: 'count', label: '인원', align: 'right' }]}
              empty="아직 코호트 데이터가 없습니다"
            >
              {data.supplyPipeline.map((s) => (
                <Tr key={s.step}>
                  <Td>{label(s.step)}</Td>
                  <Td mono align="right">{s.count}</Td>
                </Tr>
              ))}
            </DataTable>
          </Section>

          <Section
            title="채널별 유입"
            note="비용 대비 성과(CAC)는 파트너 · 채널 화면에서 봅니다."
          >
            <DataTable
              columns={[
                { key: 'ch', label: '채널' },
                { key: 'in', label: '유입', align: 'right' },
                { key: 'placed', label: '배치', align: 'right' },
              ]}
              empty="유입 기록이 없습니다"
            >
              {data.channelInflow.map((c) => (
                <Tr key={c.channelCode}>
                  <Td>{c.labelKo}</Td>
                  <Td mono align="right">{c.candidates}</Td>
                  <Td mono align="right">{c.placed}</Td>
                </Tr>
              ))}
              {data.referral.referred > 0 && (
                <Tr key="__referral" tone="selected">
                  <Td>기존 인력 추천</Td>
                  <Td mono align="right">{data.referral.referred}</Td>
                  <Td mono align="right">{data.referral.placed}</Td>
                </Tr>
              )}
            </DataTable>
          </Section>
        </div>

        {data.exclusionBreakdown.length > 0 && (
          <Section
            title="매칭 제외 사유"
            note="제외된 후보가 왜 빠졌는지 집계합니다. 숫자만 보면 '후보가 없다'로 읽히지만, 대부분은 검증이 안 끝난 것입니다."
          >
            <DataTable
              columns={[{ key: 'reason', label: '사유' }, { key: 'count', label: '건수', align: 'right' }]}
            >
              {data.exclusionBreakdown.map((e) => (
                <Tr key={e.reason}>
                  <Td>{label(e.reason)}</Td>
                  <Td mono align="right">{e.count}</Td>
                </Tr>
              ))}
            </DataTable>
          </Section>
        )}
      </div>
    </Shell>
  );
}
