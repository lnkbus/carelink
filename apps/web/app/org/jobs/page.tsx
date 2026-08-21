import Link from 'next/link';
import type { Job, Paged } from '@carelink/shared-types';
import { DataTable, KpiChip, KpiRow, PageHeader, Section, StatusPill, Td, Tr } from '@carelink/ui';
import { OrgShell } from '@/components/OrgShell';
import { apiGet } from '@/lib/api';
import { label } from '@/lib/labels-org';
import { currentOrg } from '@/lib/session';

export const dynamic = 'force-dynamic';

const JOB_TONE: Record<string, 'signal' | 'flag' | 'alert' | 'neutral'> = {
  OPEN: 'signal', FILLED: 'signal', PAUSED: 'flag', DRAFT: 'neutral',
  CLOSED: 'neutral', EXPIRED: 'alert',
};

const won = (n: number) => n.toLocaleString('ko-KR');

/** SCR-202 채용 요청 목록. 마감 임박 날짜는 alert로 씁니다. */
export default async function JobsPage() {
  const org = await currentOrg();
  const jobs = await apiGet<Paged<Job>>('/jobs', { organizationId: org.id, size: 100 });

  const today = new Date().toISOString().slice(0, 10);
  const soon = new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10);

  const open = jobs.items.filter((j) => j.status === 'OPEN');
  const urgent = open.filter((j) => j.startDate && j.startDate <= soon);

  return (
    <OrgShell orgName={org.name} verificationStatus={org.verificationStatus}>
      <PageHeader
        title="채용 요청"
        screenId="SCR-202"
        description="급여 공개 범위가 지원 전환율에 직접 영향을 줍니다. 요청마다 따로 정합니다."
        actions={<Link href="/org/jobs/new"><span style={{ fontSize: 'var(--cl-caption)' }}>새 요청 등록 →</span></Link>}
      />
      <div className="cl-body">
        <div style={{ marginTop: 'var(--cl-s6)' }}>
          <KpiRow>
            <KpiChip label="전체 요청" value={jobs.total} unit="건" />
            <KpiChip label="모집 중" value={open.length} unit="건" tone={open.length ? 'signal' : 'neutral'} />
            <KpiChip
              label="시작 14일 이내"
              value={urgent.length}
              unit="건"
              tone={urgent.length ? 'alert' : 'neutral'}
              hint="근무 시작일이 가까운데 아직 충원되지 않은 요청입니다"
            />
            <KpiChip label="모집 인원" value={open.reduce((s, j) => s + j.headcount, 0)} unit="명" />
          </KpiRow>
        </div>

        <Section title="요청 목록" note="요청을 클릭하면 매칭 결과와 근거를 봅니다.">
          <DataTable
            columns={[
              { key: 'title', label: '요청' },
              { key: 'track', label: '트랙', width: 130 },
              { key: 'region', label: '지역', width: 110 },
              { key: 'fill', label: '충원 진행', width: 110 },
              { key: 'head', label: '인원', align: 'right', width: 70 },
              { key: 'salary', label: '급여', width: 190 },
              { key: 'start', label: '시작', width: 110 },
              { key: 'status', label: '상태', width: 110 },
            ]}
            empty="등록한 채용 요청이 없습니다"
          >
            {jobs.items.map((j) => {
              const urgentRow = j.status === 'OPEN' && j.startDate !== null && j.startDate <= soon;
              return (
                <Tr key={j.id} tone={urgentRow ? 'alert' : undefined}>
                  <Td><Link href={`/org/jobs/${j.id}`}>{j.title ?? '(제목 없음)'}</Link></Td>
                  <Td tone="muted">{label(j.trackCode)}</Td>
                  <Td>{j.region}</Td>
                  {/*
                    시안(SCR-202)의 `2/4` 열. 기관이 이 화면에서 가장 알고 싶은
                    것은 '얼마나 찼나'입니다 — 상태(모집 중/마감)만으로는
                    4명 중 0명인지 3명인지 알 수 없습니다.
                    채워진 만큼 막대로도 보여 줍니다. 숫자만 있으면 표를
                    훑을 때 비교가 안 됩니다.
                  */}
                  <Td>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--cl-s3)' }}>
                      <span style={{ fontFamily: 'var(--cl-font-mono)', minWidth: 34 }}>
                        {j.filledCount ?? 0}/{j.headcount}
                      </span>
                      <span
                        aria-hidden="true"
                        style={{
                          flex: 1, height: 6, borderRadius: 999,
                          background: 'var(--cl-line)', overflow: 'hidden',
                        }}
                      >
                        <span
                          style={{
                            display: 'block', height: '100%',
                            width: `${Math.min(100, Math.round(((j.filledCount ?? 0) / Math.max(1, j.headcount)) * 100))}%`,
                            background: (j.filledCount ?? 0) >= j.headcount ? 'var(--cl-signal)' : 'var(--cl-action)',
                          }}
                        />
                      </span>
                    </span>
                  </Td>
                  <Td mono align="right">{j.headcount}</Td>
                  <Td>
                    {j.salaryMin === null && j.salaryMax === null
                      ? (
                        <span style={{ color: 'var(--cl-text-muted)', fontSize: 'var(--cl-caption)' }}>
                          {label(j.salaryVisibility)}
                        </span>
                      )
                      : (
                        <span>
                          <span style={{ fontFamily: 'var(--cl-font-mono)' }}>
                            {won(j.salaryMin ?? 0)}~{won(j.salaryMax ?? 0)}
                          </span>
                          <span style={{ fontSize: 'var(--cl-micro)', color: 'var(--cl-text-muted)', marginLeft: 6 }}>
                            {label(j.salaryVisibility)}
                          </span>
                        </span>
                      )}
                  </Td>
                  <Td mono tone={urgentRow ? 'alert' : 'muted'}>
                    {j.startDate ?? '—'}
                    {urgentRow && <span style={{ marginLeft: 4 }}>임박</span>}
                  </Td>
                  <Td><StatusPill tone={JOB_TONE[j.status] ?? 'neutral'} label={label(j.status)} /></Td>
                </Tr>
              );
            })}
          </DataTable>
        </Section>
      </div>
    </OrgShell>
  );
}
