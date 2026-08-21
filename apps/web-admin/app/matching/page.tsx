import { redirect } from 'next/navigation';
import type { Job, Paged } from '@carelink/shared-types';
import { DataTable, PageHeader, Section, StatusPill, Td, Tr } from '@carelink/ui';
import { Shell } from '@/components/Shell';
import { ApiError, apiGet } from '@/lib/api';
import { label } from '@/lib/labels';
import { MatchPanel } from './MatchPanel';
import { redirectToLogin } from '@/lib/session';

export const dynamic = 'force-dynamic';

/**
 * SCR-504 매칭 센터.
 *
 * 룰 기반 매칭은 **사람이 최종 판단하는 것을 전제**로 합니다. 운영자의 추천·제외
 * 선택이 전부 로그로 남고, 그것이 나중에 학습 데이터가 됩니다 (§6-7).
 *
 * 체류자격은 점수가 아니라 하드 필터입니다. NOT_ALLOWED는 목록에서 빠지고,
 * PENDING_CONFIRMATION은 별도 구획에 담아 운영자 확인을 강제합니다 —
 * 비자 부적격 인력을 배치하면 불법 취업 알선이 됩니다 (§5.9).
 */
export default async function MatchingPage({
  searchParams,
}: {
  searchParams: { jobId?: string };
}) {
  let jobs: Paged<Job>;
  try {
    jobs = await apiGet<Paged<Job>>('/jobs', { size: 50 });
  } catch (e) {
    if (e instanceof ApiError && (e.status === 401 || e.status === 403)) redirectToLogin(e);
    throw e;
  }

  // job_status는 DRAFT|OPEN|PAUSED|FILLED|CLOSED|EXPIRED다. SCR-504의 states
  // (NEW|SCREENING|…)는 요청의 처리 단계를 말한 것이고 채용 요청 상태와 다르다.
  const open = jobs.items.filter((j) => j.status === 'OPEN');

  return (
    <Shell>
      <PageHeader
        title="매칭 센터"
        screenId="SCR-504"
        description="점수는 근거와 함께만 보여줍니다. 제외된 후보는 사유와 함께 별도 구획에 남습니다."
      />
      <div className="cl-body">
        <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 'var(--cl-s6)', marginTop: 'var(--cl-s6)' }}>
          <div>
            <Section title="채용 요청" note="열린 요청만 표시합니다.">
              <DataTable
                columns={[{ key: 'job', label: '요청' }, { key: 'need', label: '인원', align: 'right', width: 70 }]}
                empty="열린 채용 요청이 없습니다"
              >
                {open.map((j) => (
                  <Tr key={j.id} tone={searchParams.jobId === j.id ? 'selected' : undefined}>
                    <Td>
                      <a href={`/matching?jobId=${j.id}`} style={{ display: 'block' }}>
                        <span style={{ display: 'block', color: 'var(--cl-text)' }}>{j.title ?? '(제목 없음)'}</span>
                        <span style={{ fontSize: 'var(--cl-caption)', color: 'var(--cl-text-muted)' }}>
                          {j.organizationName} · {j.region} · {label(j.trackCode)}
                        </span>
                      </a>
                    </Td>
                    <Td mono align="right">{j.headcount}</Td>
                  </Tr>
                ))}
              </DataTable>
            </Section>
          </div>

          <div>
            {searchParams.jobId
              ? <MatchPanel jobId={searchParams.jobId} />
              : (
                <div
                  style={{
                    marginTop: 'var(--cl-s7)', padding: 'var(--cl-s8)', textAlign: 'center',
                    border: '1px solid var(--cl-line)', borderRadius: 'var(--cl-r-desk)',
                    color: 'var(--cl-text-muted)', fontSize: 'var(--cl-body)',
                  }}
                >
                  왼쪽에서 채용 요청을 선택하면 후보군과 제외 사유를 함께 보여줍니다.
                </div>
              )}
          </div>
        </div>
      </div>
    </Shell>
  );
}
