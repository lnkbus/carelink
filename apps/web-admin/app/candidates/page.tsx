import { redirect } from 'next/navigation';
import type { Candidate, Paged } from '@carelink/shared-types';
import {
  DataTable, ExpiryCountdown, KpiChip, KpiRow, PageHeader, Section, StatusPill, Td, Tr,
} from '@carelink/ui';
import { Shell } from '@/components/Shell';
import { ApiError, apiGet } from '@/lib/api';
import { label } from '@/lib/labels';
import { StatusFilter } from './StatusFilter';

export const dynamic = 'force-dynamic';

const STATUSES = ['DRAFT', 'DOC_REVIEW', 'TRAINING', 'READY', 'MATCHED', 'PLACED'] as const;

const STATUS_TONE: Record<string, 'signal' | 'flag' | 'alert' | 'action' | 'neutral'> = {
  READY: 'signal', PLACED: 'signal', MATCHED: 'action',
  DOC_REVIEW: 'flag', TRAINING: 'flag',
  SUSPENDED: 'alert', INACTIVE: 'neutral', DRAFT: 'neutral',
};

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
    if (e instanceof ApiError && (e.status === 401 || e.status === 403)) redirect('/login');
    throw e;
  }

  const visaSoon = data.items.filter(
    (c) => c.visaExpiresInDays !== null && c.visaExpiresInDays !== undefined && c.visaExpiresInDays <= 60,
  );
  const ready = data.items.filter((c) => c.status === 'READY').length;
  const inReview = data.items.filter((c) => c.status === 'DOC_REVIEW').length;

  return (
    <Shell>
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
          <DataTable
            columns={[
              { key: 'code', label: 'ID', width: 110 },
              { key: 'name', label: '이름', width: 120 },
              { key: 'track', label: '트랙' },
              { key: 'status', label: '상태', width: 110 },
              { key: 'location', label: '지역', width: 120 },
              { key: 'nationality', label: '국적', width: 90 },
              { key: 'visa', label: '체류자격', width: 160 },
              { key: 'available', label: '근무 가능', width: 110 },
            ]}
            empty="조건에 맞는 후보자가 없습니다"
          >
            {data.items.map((c) => {
              const days = c.visaExpiresInDays ?? null;
              const urgent = days !== null && days <= 30;
              return (
                <Tr key={c.id} tone={urgent ? 'alert' : undefined}>
                  <Td mono>{c.displayCode}</Td>
                  <Td>{c.name ?? '—'}</Td>
                  <Td>
                    {c.tracks.length === 0
                      ? <span style={{ color: 'var(--cl-text-disabled)' }}>미선택</span>
                      : c.tracks.map((t) => t.labelKo).join(' · ')}
                  </Td>
                  <Td>
                    <StatusPill tone={STATUS_TONE[c.status] ?? 'neutral'} label={label(c.status)} />
                  </Td>
                  <Td>{c.currentLocation ?? '—'}</Td>
                  <Td tone="muted">{c.nationality ?? '—'}</Td>
                  <Td>
                    {c.visaStatusCode
                      ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--cl-s2)' }}>
                          <span style={{ fontFamily: 'var(--cl-font-mono)' }}>{c.visaStatusCode}</span>
                          <ExpiryCountdown days={days} date={c.visaExpiresOn ?? null} compact />
                        </span>
                      )
                      : <span style={{ color: 'var(--cl-text-disabled)' }}>미확인</span>}
                  </Td>
                  <Td mono tone="muted">{c.availableFrom ?? '—'}</Td>
                </Tr>
              );
            })}
          </DataTable>
        </Section>

        <p style={{ marginTop: 'var(--cl-s5)', fontSize: 'var(--cl-caption)', color: 'var(--cl-text-muted)' }}>
          {data.total}명 중 {data.items.length}명 · {data.page}페이지
        </p>
      </div>
    </Shell>
  );
}
