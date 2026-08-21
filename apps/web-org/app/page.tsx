import Link from 'next/link';
import type { Job, Organization, Paged } from '@carelink/shared-types';
import { DataTable, FunnelTable, KpiChip, KpiRow, PageHeader, Section, StatusPill, Td, Tr, type FunnelRowData } from '@carelink/ui';
import { Shell } from '@/components/Shell';
import { apiGet } from '@/lib/api';
import { label } from '@/lib/labels';
import { currentOrg } from '@/lib/session';

export const dynamic = 'force-dynamic';

interface InterviewRow {
  id: string; jobId: string; status: string;
  scheduledAt: string | null; mode: string | null; interviewer: string | null;
  candidateId?: string; memo?: string | null;
}

interface FunnelRow { trackCode: string; stage: string; count: number }

const JOB_TONE: Record<string, 'signal' | 'flag' | 'alert' | 'neutral'> = {
  OPEN: 'signal', FILLED: 'signal', PAUSED: 'flag', DRAFT: 'neutral',
  CLOSED: 'neutral', EXPIRED: 'alert',
};

/**
 * SCR-201 기관 대시보드.
 *
 * 검증 전(`PENDING`)에는 통계만 보여주고 후보자 카드는 내보내지 않습니다
 * (SCR-201 notes · §6-6). 다만 **비활성화가 아니라 미렌더링**이고, 대신 왜
 * 안 보이는지를 같은 자리에 씁니다 — 회색 처리된 카드는 "값이 있는데 안 준다"는
 * 신호라서 우회 시도를 부릅니다.
 *
 * 간병 요청(care-requests)은 V2입니다. 카드를 미리 깔아 두지 않았습니다 —
 * 빈 카드는 "언제 열리냐"는 문의만 만듭니다.
 */
export default async function OrgDashboard() {
  const org = await currentOrg();
  const verified = org.verificationStatus === 'VERIFIED';

  const [jobs, funnel, interviews] = await Promise.all([
    apiGet<Paged<Job>>('/jobs', { organizationId: org.id, size: 50 }),
    apiGet<FunnelRow[]>('/organizations/me/funnel').catch(() => [] as FunnelRow[]),
    apiGet<InterviewRow[]>('/interviews').catch(() => [] as InterviewRow[]),
  ]);

  const openJobs = jobs.items.filter((j) => j.status === 'OPEN');
  const headcount = openJobs.reduce((s, j) => s + j.headcount, 0);
  const upcoming = interviews
    .filter((i) => i.status === 'REQUESTED' || i.status === 'CONFIRMED')
    .sort((a, b) => (a.scheduledAt ?? '').localeCompare(b.scheduledAt ?? ''));
  const awaitingAccept = interviews.filter((i) => i.status === 'REQUESTED').length;

  const byTrack = new Map<string, number>();
  for (const f of funnel) byTrack.set(f.trackCode, (byTrack.get(f.trackCode) ?? 0) + f.count);

  // 단계 순서는 고정입니다. 데이터에 없는 단계도 0으로 남겨 둡니다 —
  // 빠진 단계를 지우면 '거기서 다 빠졌다'는 사실이 표에서 사라집니다.
  const STAGES: { code: string; label: string }[] = [
    { code: 'APPLIED', label: '지원 접수' },
    { code: 'DOC_REVIEW', label: '서류 심사' },
    { code: 'INTERVIEW', label: '면접' },
    { code: 'OFFER', label: '합격 · 계약' },
    { code: 'PLACED', label: '배치 완료' },
  ];
  const stageCount = new Map<string, number>();
  for (const f of funnel) stageCount.set(f.stage, (stageCount.get(f.stage) ?? 0) + f.count);
  const first = stageCount.get(STAGES[0].code) ?? 0;
  const funnelRows: FunnelRowData[] = first === 0 ? [] : STAGES.map((st) => {
    const count = stageCount.get(st.code) ?? 0;
    return {
      stage: st.code,
      label: st.label,
      count,
      // 첫 단계를 100%로 한 상대 전환입니다 (design/README §4-4).
      conversionPct: Math.round((count / first) * 100),
    };
  });

  return (
    <Shell orgName={org.name} verificationStatus={org.verificationStatus}>
      <PageHeader
        title="대시보드"
        screenId="SCR-201"
        description={`${org.name} · ${label(org.orgType)}${org.region ? ` · ${org.region}` : ''}`}
        actions={<Link href="/jobs/new"><span style={{ fontSize: 'var(--cl-caption)' }}>채용 요청 등록 →</span></Link>}
      />
      <div className="cl-body">
        {!verified && (
          <div
            style={{
              marginTop: 'var(--cl-s6)', padding: 'var(--cl-s5)',
              background: 'var(--cl-flag-tint)', border: '1px solid var(--cl-flag-line)',
              borderRadius: 'var(--cl-r-desk)', color: 'var(--cl-flag)',
            }}
          >
            <strong style={{ display: 'block', marginBottom: 'var(--cl-s2)' }}>
              사업자 검증 대기 중입니다
            </strong>
            검증이 끝나기 전에는 후보자가 익명 ID(<span style={{ fontFamily: 'var(--cl-font-mono)' }}>C-00101</span>)로만
            표시됩니다. 채용 요청 등록과 매칭 결과 확인은 지금도 가능합니다. 실명과 연락처는
            검증 완료 <em>그리고</em> 후보자가 면접 요청을 수락한 뒤에 열립니다.
          </div>
        )}

        <div style={{ marginTop: 'var(--cl-s6)' }}>
          <KpiRow>
            <KpiChip label="모집 중 요청" value={openJobs.length} unit="건" tone={openJobs.length ? 'action' : 'neutral'} />
            <KpiChip label="모집 인원" value={headcount} unit="명" />
            <KpiChip label="예정 면접" value={upcoming.length} unit="건" />
            <KpiChip
              label="수락 대기"
              value={awaitingAccept}
              unit="건"
              tone={awaitingAccept ? 'flag' : 'neutral'}
              hint="후보자가 수락해야 면접이 확정되고 실명이 열립니다"
            />
            <KpiChip label="운영 트랙" value={byTrack.size} unit="종" />
          </KpiRow>
        </div>

        <Section
          title="채용 퍼널"
          note="어느 단계에서 사람이 빠지는지가 이 표의 전부입니다. 합계만 보면 '지원이 적다'로 읽히고, 실제 원인이 서류 심사 지체여도 모릅니다."
        >
          {/*
            시안(SCR-201)의 FunnelTable입니다. 표가 없어서 KPI 숫자만 있었고,
            그러면 '전환이 어디서 끊기는가'를 볼 수 없습니다 — 그게 기관이
            이 화면에서 알고 싶은 유일한 것입니다 (design/README §4-4).

            트랙별로 나눠 집계합니다. 합산만 만들면 어느 트랙이 통했는지
            판별할 수 없습니다 (§5.8).
          */}
          {funnelRows.length === 0 ? (
            <div style={{ padding: 'var(--cl-s6)', color: 'var(--cl-text-muted)', fontSize: 'var(--cl-caption)' }}>
              아직 집계할 지원이 없습니다. 채용 요청을 열고 지원이 들어오면 단계별 전환이 여기 쌓입니다.
            </div>
          ) : (
            <div style={{ padding: '0 var(--cl-s4) var(--cl-s4)' }}>
              <FunnelTable rows={funnelRows} />
            </div>
          )}
        </Section>

        <Section
          title="채용 요청"
          note="상태별로 나뉜 요청입니다. 마감 임박은 채용 요청 화면에서 날짜를 붉게 표시합니다."
          aside={<Link href="/jobs" style={{ fontSize: 'var(--cl-caption)' }}>전체 보기 →</Link>}
        >
          <DataTable
            columns={[
              { key: 'title', label: '요청' },
              { key: 'track', label: '트랙', width: 130 },
              { key: 'region', label: '지역', width: 120 },
              { key: 'head', label: '인원', align: 'right', width: 70 },
              { key: 'start', label: '시작', width: 110 },
              { key: 'status', label: '상태', width: 110 },
            ]}
            empty="등록한 채용 요청이 없습니다"
          >
            {jobs.items.slice(0, 7).map((j) => (
              <Tr key={j.id}>
                <Td>
                  <Link href={`/jobs/${j.id}`}>{j.title ?? '(제목 없음)'}</Link>
                </Td>
                <Td tone="muted">{label(j.trackCode)}</Td>
                <Td>{j.region}</Td>
                <Td mono align="right">{j.headcount}</Td>
                <Td mono tone="muted">{j.startDate ?? '—'}</Td>
                <Td><StatusPill tone={JOB_TONE[j.status] ?? 'neutral'} label={label(j.status)} /></Td>
              </Tr>
            ))}
          </DataTable>
        </Section>

        <Section
          title="예정 면접"
          note="수락 대기는 후보자의 응답을 기다리는 상태입니다. 기관이 대신 확정할 수 없습니다 — 수락이 곧 개인정보 공개 동의이기 때문입니다."
          aside={<Link href="/interviews" style={{ fontSize: 'var(--cl-caption)' }}>면접 관리 →</Link>}
        >
          <DataTable
            columns={[
              { key: 'when', label: '일시', width: 180 },
              { key: 'mode', label: '방식', width: 90 },
              { key: 'who', label: '후보자', width: 130 },
              { key: 'interviewer', label: '면접관' },
              { key: 'status', label: '상태', width: 110 },
            ]}
            empty="예정된 면접이 없습니다"
          >
            {upcoming.slice(0, 6).map((i) => (
              <Tr key={i.id}>
                <Td mono>{i.scheduledAt ? i.scheduledAt.slice(0, 16).replace('T', ' ') : '일시 미정'}</Td>
                <Td tone="muted">{label(i.mode)}</Td>
                <Td mono>{i.candidateId ? `#${i.candidateId.slice(0, 6)}` : '—'}</Td>
                <Td>{i.interviewer ?? '—'}</Td>
                <Td>
                  <StatusPill tone={i.status === 'CONFIRMED' ? 'signal' : 'flag'} label={label(i.status)} />
                </Td>
              </Tr>
            ))}
          </DataTable>
        </Section>

        <p style={{ marginTop: 'var(--cl-s6)', fontSize: 'var(--cl-caption)', color: 'var(--cl-text-muted)' }}>
          간병 서비스 신청 현황은 V2에서 열립니다.
        </p>
      </div>
    </Shell>
  );
}
