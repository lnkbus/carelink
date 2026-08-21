import Link from 'next/link';
import type { Candidate, Paged } from '@carelink/shared-types';
import {
  ClearanceLegend, ClearanceMatrix, DataTable, KpiChip, KpiRow, PageHeader,
  Restricted, Section, StatusPill, Td, Tr, type MatrixState,
} from '@carelink/ui';
import { OrgShell } from '@/components/OrgShell';
import { apiGet } from '@/lib/api';
import { label } from '@/lib/labels-org';
import { currentOrg } from '@/lib/session';
import { CandidateFilters } from './CandidateFilters';

export const dynamic = 'force-dynamic';

interface Track { id: string; code: string; labelKo: string }

/**
 * SCR-203 후보자 검색.
 *
 * **기관에 나가는 카드는 익명 ID + 매칭 근거뿐입니다.** 실명·연락처는 검증 완료
 * *그리고* 후보자가 면접 요청을 수락한 뒤에 열립니다 (§5.2 · SCR-203 notes).
 * 이 게이트가 없으면 플랫폼을 우회한 직거래가 발생하고 수익모델이 무너집니다.
 *
 * 화면이 게이트를 만드는 것이 아닙니다 — 서버가 애초에 필드를 보내지 않습니다.
 * 여기서는 '없는 값'을 안내 문구로 대체할 뿐입니다.
 *
 * 국적·체류자격 코드는 어느 단계에서도 나오지 않습니다. 기관에는 '취업 가능
 * 여부'로 치환돼 옵니다 (§6-12 · §6-13).
 */
export default async function CandidateSearchPage({
  searchParams,
}: {
  searchParams: { trackId?: string; region?: string; status?: string; page?: string };
}) {
  const org = await currentOrg();
  const [data, tracks] = await Promise.all([
    apiGet<Paged<Candidate>>('/candidates', {
      trackId: searchParams.trackId, region: searchParams.region,
      status: searchParams.status, page: searchParams.page ?? 1, size: 20,
    }),
    apiGet<Track[]>('/tracks'),
  ]);

  const employable = data.items.filter((c) => c.employable === 'ALLOWED').length;
  const ready = data.items.filter((c) => c.status === 'READY').length;

  return (
    <OrgShell orgName={org.name} verificationStatus={org.verificationStatus}>
      <PageHeader
        title="후보자 검색"
        screenId="SCR-203"
        description="후보자는 익명 ID로 표시됩니다. 실명은 면접 요청을 수락한 뒤에 열립니다."
      />
      <div className="cl-body">
        <div style={{ marginTop: 'var(--cl-s6)' }}>
          <KpiRow>
            <KpiChip label="조회 결과" value={data.total} unit="명" />
            <KpiChip label="배치 준비" value={ready} unit="명" tone={ready ? 'signal' : 'neutral'} />
            <KpiChip
              label="취업 가능"
              value={employable}
              unit="명"
              tone={employable ? 'signal' : 'neutral'}
              hint="확인이 끝난 인원입니다. '확인 중'은 불가가 아니라 아직 판정 전입니다"
            />
          </KpiRow>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 'var(--cl-s6)', marginTop: 'var(--cl-s6)' }}>
          <CandidateFilters
            tracks={tracks}
            current={{ trackId: searchParams.trackId, region: searchParams.region, status: searchParams.status }}
            total={data.total}
          />

          <div>
            <Section
              title="후보자"
              note="검증 상태는 5칸으로 요약합니다. 순서는 고정이고 범례가 표 아래에 있습니다."
            >
              <DataTable
                columns={[
                  { key: 'code', label: 'ID', width: 110 },
                  { key: 'track', label: '트랙' },
                  { key: 'region', label: '희망 지역' },
                  { key: 'status', label: '상태', width: 110 },
                  { key: 'employable', label: '취업 가능', width: 110 },
                  { key: 'clearance', label: '검증', width: 120 },
                  { key: 'available', label: '근무 가능', width: 110 },
                ]}
                empty="조건에 맞는 후보자가 없습니다"
              >
                {data.items.map((c) => (
                  <Tr key={c.id}>
                    <Td mono>
                      <Link href={`/org/candidates/${c.id}`} style={{ fontFamily: 'var(--cl-font-mono)' }}>
                        {c.displayCode}
                      </Link>
                    </Td>
                    <Td>
                      {c.tracks.length === 0
                        ? <span style={{ color: 'var(--cl-text-disabled)' }}>미선택</span>
                        : c.tracks.map((t) => t.labelKo).join(' · ')}
                    </Td>
                    <Td tone="muted">{c.preferredRegions?.join(' · ') ?? c.currentLocation ?? '—'}</Td>
                    <Td><StatusPill tone={c.status === 'READY' ? 'signal' : 'neutral'} label={label(c.status)} /></Td>
                    <Td>
                      {/* 세 상태를 둘로 뭉개지 않습니다. '확인 중'을 '불가'로
                          보여주면 기관이 그 후보자를 거르고, 후보자는 확인이
                          안 됐다는 이유로 일자리를 잃습니다. */}
                      {c.employable === null || c.employable === undefined
                        ? <Restricted reason="확인 전" />
                        : c.employable === 'ALLOWED'
                          ? <StatusPill tone="signal" label="가능" />
                          : c.employable === 'NOT_ALLOWED'
                            ? <StatusPill tone="alert" label="불가" />
                            : <StatusPill tone="flag" label="확인 중" />}
                    </Td>
                    <Td><ClearanceMatrix states={matrixFor(c)} /></Td>
                    <Td mono tone="muted">{c.availableFrom ?? '—'}</Td>
                  </Tr>
                ))}
              </DataTable>
              <div style={{ padding: '0 var(--cl-s4)' }}>
                <ClearanceLegend />
              </div>
            </Section>

            <p style={{ marginTop: 'var(--cl-s5)', fontSize: 'var(--cl-caption)', color: 'var(--cl-text-muted)' }}>
              {data.total}명 중 {data.items.length}명 · {data.page}페이지
            </p>
          </div>
        </div>
      </div>
    </OrgShell>
  );
}

/**
 * 검증 상태 5칸.
 *
 * 기관에는 항목별 원본 상태가 나가지 않습니다 — 어느 서류가 왜 반려됐는지는
 * 후보자와 운영자 사이의 정보입니다. 기관이 알아야 하는 것은 '이 사람을
 * 배치할 수 있는가'뿐이라, 취업 가능 여부와 후보자 상태에서 유도합니다.
 */
function matrixFor(c: Candidate): Record<string, MatrixState> {
  const verified: MatrixState = 'VERIFIED';
  const review: MatrixState = 'REVIEW';
  const blocked: MatrixState = 'BLOCKED';

  const docsDone = c.status === 'READY' || c.status === 'MATCHED' || c.status === 'PLACED';
  const docState = docsDone ? verified : c.status === 'DOC_REVIEW' ? review : blocked;
  const visaState =
    c.employable === 'ALLOWED' ? verified
      : c.employable === 'NOT_ALLOWED' ? blocked
        : review;

  return {
    PASSPORT: docState,
    CERTIFICATE: docsDone ? verified : review,
    CRIMINAL_RECORD_CLEAR: docState,
    HEALTH_CHECK: docState,
    VISA_ELIGIBLE: visaState,
  };
}
