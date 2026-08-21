import type { Job, Paged } from '@carelink/shared-types';
import { DataTable, KpiChip, KpiRow, PageHeader, Section, StatusPill, Td, Tr } from '@carelink/ui';
import { OrgShell } from '@/components/OrgShell';
import { apiGet } from '@/lib/api';
import { label } from '@/lib/labels-org';
import { currentOrg } from '@/lib/session';

export const dynamic = 'force-dynamic';

interface InterviewRow {
  id: string; jobId: string; status: string;
  scheduledAt: string | null; mode: string | null; interviewer: string | null;
  candidateId?: string; memo?: string | null;
}

const TONE: Record<string, 'signal' | 'flag' | 'alert' | 'neutral'> = {
  CONFIRMED: 'signal', COMPLETED: 'signal', REQUESTED: 'flag',
  CANCELLED: 'neutral', NO_SHOW: 'alert',
};

const DAY = ['일', '월', '화', '수', '목', '금', '토'];

/**
 * SCR-205 면접 관리.
 *
 * **NO_SHOW를 취소와 구분해서 남깁니다.** 평균 충원 기간 KPI와 공급 품질에
 * 반영되기 때문입니다 — 단순 취소와 섞으면 어느 쪽이 문제인지 알 수 없습니다.
 *
 * `REQUESTED`(수락 대기)는 기관이 바꿀 수 없습니다. 수락은 후보자 본인만
 * 하고, 그 수락이 곧 실명·연락처 공개 동의이기 때문입니다. 기관이 대신
 * 확정할 수 있으면 게이트가 무의미해집니다.
 */
export default async function InterviewsPage() {
  const org = await currentOrg();
  const [interviews, jobs] = await Promise.all([
    apiGet<InterviewRow[]>('/interviews'),
    apiGet<Paged<Job>>('/jobs', { organizationId: org.id, size: 100 }),
  ]);

  const jobTitle = new Map(jobs.items.map((j) => [j.id, j.title ?? '(제목 없음)']));

  const requested = interviews.filter((i) => i.status === 'REQUESTED');
  const confirmed = interviews.filter((i) => i.status === 'CONFIRMED');
  const noShow = interviews.filter((i) => i.status === 'NO_SHOW');
  const done = interviews.filter((i) => i.status === 'COMPLETED');

  // 주간 그리드 5일 (design/README §Organization Web SCR-205)
  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  const week = Array.from({ length: 5 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
  const byDay = new Map<string, InterviewRow[]>();
  for (const i of interviews) {
    if (!i.scheduledAt) continue;
    const key = i.scheduledAt.slice(0, 10);
    byDay.set(key, [...(byDay.get(key) ?? []), i]);
  }

  const unscheduled = interviews.filter((i) => !i.scheduledAt);

  return (
    <OrgShell orgName={org.name} verificationStatus={org.verificationStatus}>
      <PageHeader
        title="면접 관리"
        screenId="SCR-205"
        description="수락 대기는 후보자의 응답을 기다리는 상태입니다. 기관이 대신 확정할 수 없습니다."
      />
      <div className="cl-body">
        <div style={{ marginTop: 'var(--cl-s6)' }}>
          <KpiRow>
            <KpiChip label="전체 면접" value={interviews.length} unit="건" />
            <KpiChip label="수락 대기" value={requested.length} unit="건" tone={requested.length ? 'flag' : 'neutral'} />
            <KpiChip label="확정" value={confirmed.length} unit="건" tone={confirmed.length ? 'signal' : 'neutral'} />
            <KpiChip label="완료" value={done.length} unit="건" />
            <KpiChip
              label="불참"
              value={noShow.length}
              unit="건"
              tone={noShow.length ? 'alert' : 'neutral'}
              hint="취소와 구분해 남깁니다 — 평균 충원 기간과 공급 품질에 반영됩니다"
            />
          </KpiRow>
        </div>

        <Section title="이번 주" note="일시가 정해진 면접만 그리드에 올라갑니다.">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)' }}>
            {week.map((d) => {
              const key = d.toISOString().slice(0, 10);
              const items = byDay.get(key) ?? [];
              const isToday = key === today.toISOString().slice(0, 10);
              return (
                <div
                  key={key}
                  style={{
                    borderRight: '1px solid var(--cl-line)', minHeight: 160,
                    background: isToday ? 'var(--cl-row-selected)' : undefined,
                  }}
                >
                  <div
                    style={{
                      padding: 'var(--cl-s3) var(--cl-s4)', borderBottom: '1px solid var(--cl-line)',
                      background: 'var(--cl-bg-table-head)', fontSize: 'var(--cl-caption)',
                      color: isToday ? 'var(--cl-action-text)' : 'var(--cl-text-sub)',
                      fontWeight: isToday ? 700 : 500,
                    }}
                  >
                    <span style={{ fontFamily: 'var(--cl-font-mono)' }}>{key.slice(5)}</span>
                    <span style={{ marginLeft: 6 }}>{DAY[d.getDay()]}</span>
                  </div>
                  <div style={{ padding: 'var(--cl-s3)' }}>
                    {items.length === 0 && (
                      <span style={{ fontSize: 'var(--cl-micro)', color: 'var(--cl-text-disabled)' }}>—</span>
                    )}
                    {items.map((i) => (
                      <div
                        key={i.id}
                        style={{
                          marginBottom: 'var(--cl-s2)', padding: 'var(--cl-s3)',
                          borderRadius: 'var(--cl-r-chip)', border: '1px solid var(--cl-line)',
                          fontSize: 'var(--cl-caption)',
                        }}
                      >
                        <div style={{ fontFamily: 'var(--cl-font-mono)', fontWeight: 600 }}>
                          {i.scheduledAt?.slice(11, 16)}
                        </div>
                        <div style={{ color: 'var(--cl-text-muted)', marginBottom: 4 }}>
                          {jobTitle.get(i.jobId) ?? '—'}
                        </div>
                        <StatusPill tone={TONE[i.status] ?? 'neutral'} label={label(i.status)} />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </Section>

        <Section
          title="전체 면접"
          note="후보자 실명은 면접이 확정된 뒤에 열립니다. 목록에서는 익명 식별자로 표시합니다."
        >
          <DataTable
            columns={[
              { key: 'when', label: '일시', width: 170 },
              { key: 'job', label: '채용 요청' },
              { key: 'mode', label: '방식', width: 90 },
              { key: 'interviewer', label: '면접관', width: 130 },
              { key: 'status', label: '상태', width: 120 },
              { key: 'memo', label: '메모' },
            ]}
            empty="면접 기록이 없습니다"
          >
            {interviews.map((i) => (
              <Tr key={i.id} tone={i.status === 'NO_SHOW' ? 'alert' : undefined}>
                <Td mono tone={i.scheduledAt ? undefined : 'flag'}>
                  {i.scheduledAt ? i.scheduledAt.slice(0, 16).replace('T', ' ') : '일시 미정'}
                </Td>
                <Td>{jobTitle.get(i.jobId) ?? '—'}</Td>
                <Td tone="muted">{label(i.mode)}</Td>
                <Td>{i.interviewer ?? '—'}</Td>
                <Td><StatusPill tone={TONE[i.status] ?? 'neutral'} label={label(i.status)} /></Td>
                <Td tone="muted">{i.memo ?? '—'}</Td>
              </Tr>
            ))}
          </DataTable>
        </Section>

        {unscheduled.length > 0 && (
          <p style={{ marginTop: 'var(--cl-s5)', fontSize: 'var(--cl-caption)', color: 'var(--cl-flag)' }}>
            일시가 정해지지 않은 면접 {unscheduled.length}건이 있습니다. 후보자가 수락하기 전에
            일정을 제안해 두면 응답률이 올라갑니다.
          </p>
        )}
      </div>
    </OrgShell>
  );
}
