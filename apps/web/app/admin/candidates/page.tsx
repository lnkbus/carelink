import { redirect } from 'next/navigation';
import type { Candidate, Paged } from '@carelink/shared-types';
import { KpiChip, KpiRow, PageHeader, Section } from '@carelink/ui';
import { AdminShell } from '@/components/AdminShell';
import { ApiError, apiGet } from '@/lib/api';
import { CandidateTable } from './CandidateTable';
import { StatusFilter } from './StatusFilter';
import { redirectToLogin } from '@/lib/session';

export const dynamic = 'force-dynamic';

const STATUSES = ['DRAFT', 'DOC_REVIEW', 'TRAINING', 'READY', 'MATCHED', 'PLACED'] as const;

/**
 * SCR-502 후보자 관리.
 *
 * 필터에 국적이 없습니다. SCREENS는 `nationality=`를 적고 있지만, 국적으로 사람을
 * 거르는 조회 경로가 생기면 그것이 운영 관행이 됩니다 (§5.10 · §6-13 · README §4 C5).
 * 거르는 기준은 클리어런스와 한국어 수준입니다. 국적은 운영자에게 표시만 됩니다.
 */
export default async function CandidatesPage({
  searchParams,
}: {
  searchParams: { status?: string; q?: string; page?: string };
}) {
  let data: Paged<Candidate>;
  try {
    data = await apiGet<Paged<Candidate>>('/admin/candidates', {
      status: searchParams.status,
      q: searchParams.q,
      page: searchParams.page ?? 1,
      size: 20,
    });
  } catch (e) {
    if (e instanceof ApiError && (e.status === 401 || e.status === 403)) redirectToLogin(e);
    throw e;
  }

  const visaSoon = data.items.filter(
    (c) => c.visaExpiresInDays !== null && c.visaExpiresInDays !== undefined && c.visaExpiresInDays <= 60,
  );
  const ready = data.items.filter((c) => c.status === 'READY').length;
  const inReview = data.items.filter((c) => c.status === 'DOC_REVIEW').length;

  return (
    <AdminShell>
      <PageHeader
        title="후보자 관리"
        screenId="SCR-502"
        description="일괄 처리가 이 화면의 핵심입니다. 100명 단위로 파이프라인을 밀지 못하면 실무에서 쓰이지 않습니다."
      />
      <div className="cl-body">
        <div style={{ marginTop: 'var(--cl-s6)' }}>
          <KpiRow>
            <KpiChip label="조회 결과" value={data.total} unit="명" />
            <KpiChip label="배치 준비" value={ready} unit="명" tone="signal" />
            <KpiChip label="서류 검토 중" value={inReview} unit="명" tone={inReview ? 'flag' : 'neutral'} />
            <KpiChip
              label="체류자격 60일 이내"
              value={visaSoon.length}
              unit="명"
              tone={visaSoon.length ? 'alert' : 'neutral'}
              hint="체류자격이 만료되면 자격 무효가 아니라 불법 취업이 됩니다"
            />
          </KpiRow>
        </div>

        <Section
          title="후보자"
          aside={<StatusFilter statuses={[...STATUSES]} current={searchParams.status} q={searchParams.q} />}
          note="체류자격 만료는 날짜가 아니라 남은 일수로 봅니다 — 날짜만 보면 계산을 놓치고, 놓치면 불법 취업이 됩니다."
        >
          <CandidateTable items={data.items} />
        </Section>

        <p style={{ marginTop: 'var(--cl-s5)', fontSize: 'var(--cl-caption)', color: 'var(--cl-text-muted)' }}>
          {data.total}명 중 {data.items.length}명 · {data.page}페이지
        </p>
      </div>
    </AdminShell>
  );
}
