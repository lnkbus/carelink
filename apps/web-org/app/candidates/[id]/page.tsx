import Link from 'next/link';
import type { Candidate } from '@carelink/shared-types';
import {
  ClearanceLegend, ClearanceMatrix, DataTable, PageHeader, Restricted,
  Section, StatusPill, Td, Tr, type MatrixState,
} from '@carelink/ui';
import { Shell } from '@/components/Shell';
import { ApiError, apiGet } from '@/lib/api';
import { label } from '@/lib/labels';
import { currentOrg } from '@/lib/session';
import { ErrorNotice } from '@/components/ErrorNotice';

export const dynamic = 'force-dynamic';

/**
 * SCR-204 후보자 상세.
 *
 * **권한 밖 필드는 회색 처리가 아니라 렌더링하지 않고 안내 문구로 대체합니다**
 * (design/README §Organization Web SCR-204 · docs/09 §4.1 최소 노출).
 *
 * 서버가 name·phone·birthDate 키 자체를 빼고 보냅니다. 화면은 '없는 것'을
 * 확인하고 왜 없는지를 씁니다 — 값을 받아서 가리는 구현이면 API를 직접 보는
 * 순간 뚫립니다.
 *
 * 국적·체류자격 코드는 운영자 전용이라 여기서 다루지 않습니다. 기관이 알아야
 * 하는 것은 '이 트랙에서 취업할 수 있는가'뿐입니다 (§6-12).
 */
export default async function CandidateDetailPage({ params }: { params: { id: string } }) {
  const org = await currentOrg();

  let c: Candidate;
  try {
    c = await apiGet<Candidate>(`/candidates/${params.id}`);
  } catch (e) {
    if (e instanceof ApiError) {
      return (
        <Shell orgName={org.name} verificationStatus={org.verificationStatus}>
          <PageHeader title="후보자 상세" screenId="SCR-204" />
          <div className="cl-body" style={{ marginTop: 'var(--cl-s6)' }}>
            <ErrorNotice code={e.body.code} details={e.body.details} />
          </div>
        </Shell>
      );
    }
    throw e;
  }

  // 실명이 열렸는가. 검증 완료 + 면접 수락 두 조건이 모두 참일 때만 서버가 보낸다.
  const unlocked = c.name !== undefined;
  const orgVerified = org.verificationStatus === 'VERIFIED';

  // 차단 사유는 실제 원인을 말해야 한다. 검증 대기 중인 기관에게
  // "면접을 수락하면 열립니다"라고 쓰면 후보자를 재촉하게 만들고,
  // 정작 막고 있는 것(사업자 검증)은 손도 대지 않는다.
  const lockReason = orgVerified
    ? '면접 수락 후 열립니다'
    : '기관 검증 후 열립니다';

  return (
    <Shell orgName={org.name} verificationStatus={org.verificationStatus}>
      <PageHeader
        title={c.displayCode}
        screenId="SCR-204"
        description={
          unlocked ? '면접 수락으로 연락처가 열린 후보자입니다.'
          : orgVerified ? '익명 상태입니다. 후보자가 면접 요청을 수락하면 실명과 연락처가 열립니다.'
          : '익명 상태입니다. 사업자 검증이 끝나야 후보자 정보가 열립니다.'
        }
        actions={<Link href="/candidates" style={{ fontSize: 'var(--cl-caption)' }}>← 검색으로</Link>}
      />
      <div className="cl-body">
        <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 'var(--cl-s6)', marginTop: 'var(--cl-s6)' }}>
          <aside style={{ border: '1px solid var(--cl-line)', borderRadius: 'var(--cl-r-desk)', padding: 'var(--cl-s5)' }}>
            <div
              style={{
                width: 64, height: 64, borderRadius: 'var(--cl-r-desk)',
                background: 'var(--cl-action-tint)', color: 'var(--cl-action-text)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: 'var(--cl-font-mono)', fontWeight: 700, fontSize: 15,
                marginBottom: 'var(--cl-s5)',
              }}
            >
              {c.displayCode.replace(/^C-0*/, '#')}
            </div>

            <Row label="식별자" value={<span style={{ fontFamily: 'var(--cl-font-mono)' }}>{c.displayCode}</span>} />
            <Row
              label="이름"
              value={unlocked ? (c.name ?? '—') : <Restricted reason={lockReason} />}
            />
            <Row
              label="연락처"
              value={unlocked ? (c.phone ?? '—') : <Restricted reason={lockReason} />}
            />
            <Row
              label="생년월일"
              value={unlocked ? (c.birthDate ?? '—') : <Restricted reason={lockReason} />}
            />
            <Row label="성별" value={c.gender ?? '—'} />
            <Row label="현재 지역" value={c.currentLocation ?? '—'} />
            <Row label="희망 지역" value={c.preferredRegions?.join(' · ') ?? '—'} />
            <Row label="고용 형태" value={c.employmentTypes?.join(' · ') ?? '—'} />
            <Row label="기숙사" value={c.dormRequired ? '필요' : '불필요'} />
            <Row label="근무 가능일" value={<span style={{ fontFamily: 'var(--cl-font-mono)' }}>{c.availableFrom ?? '—'}</span>} />

            {!unlocked && (
              <p
                style={{
                  margin: 'var(--cl-s5) 0 0', padding: 'var(--cl-s4)',
                  background: 'var(--cl-bg-sub)', borderRadius: 'var(--cl-r-desk)',
                  fontSize: 'var(--cl-caption)', color: 'var(--cl-text-sub)', lineHeight: 1.7,
                }}
              >
                실명·연락처·생년월일은 서버가 아예 내려보내지 않습니다.
                {orgVerified
                  ? ' 이 후보자가 면접 요청을 수락하면 그때 열립니다.'
                  : ' 지금 막고 있는 것은 사업자 검증입니다 — 검증이 끝나야 면접 수락으로 열 수 있습니다.'}
              </p>
            )}
          </aside>

          <div>
            <Section
              title="취업 가능 여부"
              note="체류자격 원본 코드는 운영자만 봅니다. 기관에는 이 트랙에서 취업할 수 있는지만 제공됩니다."
            >
              <div style={{ padding: 'var(--cl-s5)', display: 'flex', gap: 'var(--cl-s5)', alignItems: 'center' }}>
                {/* '확인 중'과 '불가'는 다릅니다. 합치면 판정 전인 후보자가
                    취업할 수 없는 사람으로 보입니다. */}
                {c.employable === null || c.employable === undefined
                  ? <StatusPill tone="flag" label="확인 전" />
                  : c.employable === 'ALLOWED'
                    ? <StatusPill tone="signal" label="이 트랙에서 취업 가능" />
                    : c.employable === 'NOT_ALLOWED'
                      ? <StatusPill tone="alert" label="이 트랙에서는 취업 불가" />
                      : <StatusPill tone="flag" label="확인 중 — 판정 전입니다" />}
                {c.employabilityReasonKey && (
                  <span style={{ fontSize: 'var(--cl-caption)', color: 'var(--cl-text-muted)' }}>
                    {reasonText(c.employabilityReasonKey)}
                  </span>
                )}
              </div>
            </Section>

            <Section
              title="검증 상태"
              note="항목별 반려 사유는 후보자와 운영자 사이의 정보입니다. 기관에는 배치 가능 여부만 제공됩니다."
            >
              <DataTable columns={[{ key: 'item', label: '항목' }, { key: 'state', label: '상태', width: 140 }]}>
                <Tr>
                  <Td>전체 검증</Td>
                  <Td>
                    <ClearanceMatrix states={matrixFor(c)} />
                  </Td>
                </Tr>
              </DataTable>
              <div style={{ padding: '0 var(--cl-s4)' }}>
                <ClearanceLegend />
              </div>
            </Section>

            <Section title="트랙">
              <DataTable
                columns={[
                  { key: 'track', label: '트랙' },
                  { key: 'primary', label: '주 트랙', width: 100 },
                  { key: 'state', label: '자격 상태', width: 140 },
                ]}
                empty="선택한 트랙이 없습니다"
              >
                {c.tracks.map((t) => (
                  <Tr key={t.trackId}>
                    <Td>{t.labelKo}</Td>
                    <Td tone="muted">{t.isPrimary ? '주' : '—'}</Td>
                    <Td>{label(t.qualificationState)}</Td>
                  </Tr>
                ))}
              </DataTable>
            </Section>

            <p style={{ marginTop: 'var(--cl-s6)', fontSize: 'var(--cl-caption)', color: 'var(--cl-text-muted)' }}>
              매칭 점수와 근거는 채용 요청별로 계산됩니다 — 채용 요청 화면에서 확인하세요.
              점수만 단독으로 보여주지 않는 것이 규칙입니다.
            </p>
          </div>
        </div>
      </div>
    </Shell>
  );
}

function Row({ label: l, value }: { label: string; value: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'flex', justifyContent: 'space-between', gap: 'var(--cl-s4)',
        padding: 'var(--cl-s3) 0', borderBottom: '1px solid var(--cl-line)',
        fontSize: 'var(--cl-body)', minHeight: 40, alignItems: 'center',
      }}
    >
      <span style={{ color: 'var(--cl-text-muted)', fontSize: 'var(--cl-caption)' }}>{l}</span>
      <span style={{ textAlign: 'right' }}>{value}</span>
    </div>
  );
}

function reasonText(key: string): string {
  const map: Record<string, string> = {
    'visa.eligibility.ALLOWED': '취업 가능한 체류자격입니다',
    'visa.eligibility.NOT_ALLOWED': '이 트랙에서 취업이 허용되지 않습니다',
    'visa.eligibility.REQUIRES_CONVERSION': '배치 전 체류자격 변경이 필요합니다',
    'visa.eligibility.REQUIRES_QUALIFICATION': '자격 보유 여부 확인이 필요합니다',
    'visa.eligibility.PENDING_CONFIRMATION': '운영자 확인 대기 중입니다',
    'visa.check.unknownStatus': '체류자격이 아직 확인되지 않았습니다',
    'visa.check.combinationNotDefined': '운영자 판정 대기 중입니다',
  };
  return map[key] ?? '';
}

function matrixFor(c: Candidate): Record<string, MatrixState> {
  const docsDone = c.status === 'READY' || c.status === 'MATCHED' || c.status === 'PLACED';
  const docState: MatrixState = docsDone ? 'VERIFIED' : c.status === 'DOC_REVIEW' ? 'REVIEW' : 'BLOCKED';
  const visaState: MatrixState =
    c.employable === 'ALLOWED' ? 'VERIFIED'
      : c.employable === 'NOT_ALLOWED' ? 'BLOCKED'
        : 'REVIEW';
  return {
    PASSPORT: docState,
    CERTIFICATE: docsDone ? 'VERIFIED' : 'REVIEW',
    CRIMINAL_RECORD_CLEAR: docState,
    HEALTH_CHECK: docState,
    VISA_ELIGIBLE: visaState,
  };
}
