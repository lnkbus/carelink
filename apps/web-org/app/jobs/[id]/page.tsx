import Link from 'next/link';
import type { Job } from '@carelink/shared-types';
import { KpiChip, KpiRow, PageHeader, StatusPill } from '@carelink/ui';
import { Shell } from '@/components/Shell';
import { apiGet } from '@/lib/api';
import { label } from '@/lib/labels';
import { currentOrg } from '@/lib/session';
import { JobMatches } from './JobMatches';

export const dynamic = 'force-dynamic';

const won = (n: number) => n.toLocaleString('ko-KR');

/** 채용 요청 상세 + 매칭 결과 (SCR-202 → SCR-203·204 진입점). */
export default async function JobDetailPage({ params }: { params: { id: string } }) {
  const org = await currentOrg();
  const job = await apiGet<Job>(`/jobs/${params.id}`);

  return (
    <Shell orgName={org.name} verificationStatus={org.verificationStatus}>
      <PageHeader
        title={job.title ?? '(제목 없음)'}
        screenId="SCR-202"
        description={`${label(job.trackCode)} · ${job.region} · ${job.headcount}명`}
        actions={<Link href="/jobs" style={{ fontSize: 'var(--cl-caption)' }}>← 채용 요청</Link>}
      />
      <div className="cl-body">
        <div style={{ marginTop: 'var(--cl-s6)' }}>
          <KpiRow>
            <KpiChip label="모집 인원" value={job.headcount} unit="명" />
            <KpiChip label="최소 경력" value={job.minExperienceYrs} unit="년" />
            <KpiChip label="한국어" value={job.languageLevel ?? '요구 없음'} />
            <KpiChip label="기숙사" value={job.dormProvided ? '제공' : '없음'} />
            <KpiChip
              label="급여"
              value={
                job.salaryMin === null && job.salaryMax === null
                  ? label(job.salaryVisibility)
                  : `${won(job.salaryMin ?? 0)}~${won(job.salaryMax ?? 0)}`
              }
              hint="공개 범위에 따라 값 자체가 내려오지 않습니다"
            />
          </KpiRow>
        </div>

        <div style={{ marginTop: 'var(--cl-s5)', display: 'flex', gap: 'var(--cl-s3)', alignItems: 'center' }}>
          <StatusPill tone={job.status === 'OPEN' ? 'signal' : 'neutral'} label={label(job.status)} />
          <span style={{ fontSize: 'var(--cl-caption)', color: 'var(--cl-text-muted)' }}>
            근무 시작 <span style={{ fontFamily: 'var(--cl-font-mono)' }}>{job.startDate ?? '미정'}</span>
            {job.employmentType && ` · ${job.employmentType}`}
            {` · 급여 공개 ${label(job.salaryVisibility)}`}
          </span>
        </div>

        <JobMatches jobId={job.id} />
      </div>
    </Shell>
  );
}
