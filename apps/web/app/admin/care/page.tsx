import type { CareRequest } from '@carelink/shared-types';
import { DataTable, KpiChip, KpiRow, PageHeader, Section, StatusPill, Td, Tr } from '@carelink/ui';
import { AdminShell } from '@/components/AdminShell';
import { ApiError, apiGet } from '@/lib/api';
import { label } from '@/lib/labels-admin';
import { redirectToLogin } from '@/lib/session';

export const dynamic = 'force-dynamic';

/**
 * SCR-505 간병 운영.
 *
 * **이 화면이 없어서 SLA 잡이 만든 `ISSUE`를 아무도 보지 못했습니다.**
 * `care-assignment-sla`가 4시간 미배정 건을 매 10분 잡아내는데, 그 결과가
 * 닿는 화면이 없었습니다. 잡은 도는데 사람이 안 보면 없는 것과 같습니다.
 *
 * ── 시안과 다른 곳 ──────────────────────────────────────────────────────
 * 시안(design/CareLink Admin Console - 운영)의 표에는 `김영수 · 82세`와
 * 필요 조건 `투약 확인`이 있습니다. 둘 다 넣지 않았습니다.
 *   · `care_requests`에 환자 이름·나이 컬럼이 **없습니다.** 스키마 설계
 *     단계에서 뺐습니다 (docs/11 §3.2). 병원·병실로 식별합니다.
 *   · 투약은 의료행위라 서비스 카탈로그에 항목 자체가 없습니다 (§6-2).
 *     자유 입력에서 감지되면 `restrictedFlags`로 올라오고, 그건 아래
 *     '업무범위 확인' 열에 따로 표시합니다 — 요구가 있었다는 사실은
 *     운영자가 알아야 하고, 그게 이 열의 존재 이유입니다.
 */
export default async function CareOpsPage({ searchParams }: { searchParams: { status?: string } }) {
  let rows: CareRequest[];
  try {
    rows = await apiGet<CareRequest[]>('/admin/care-requests', { status: searchParams.status });
  } catch (e) {
    if (e instanceof ApiError && (e.status === 401 || e.status === 403)) redirectToLogin(e);
    throw e;
  }

  const live = rows.filter((r) => ['MATCHING', 'OFFER_SENT', 'ASSIGNED', 'IN_SERVICE'].includes(r.status));
  const waiting = rows.filter((r) => ['SUBMITTED', 'MATCHING'].includes(r.status));
  const issues = rows.filter((r) => r.status === 'ISSUE');
  const review = rows.filter((r) => r.status === 'OPS_REVIEW');
  const overdue = waiting.filter((r) => r.slaDueAt !== null && r.slaDueAt !== undefined && new Date(r.slaDueAt) < new Date());

  return (
    <AdminShell>
      <PageHeader
        title="간병 운영"
        screenId="SCR-505"
        description="배정이 늦어지는 건과 업무범위 검토 건을 먼저 봅니다. 나머지는 흐르고 있습니다."
      />
      <div className="cl-body">
        <div style={{ marginTop: 'var(--cl-s6)' }}>
          <KpiRow>
            <KpiChip label="진행 중" value={live.length} unit="건" />
            <KpiChip
              label="배정 대기"
              value={waiting.length}
              unit="건"
              tone={waiting.length ? 'flag' : 'neutral'}
            />
            <KpiChip
              label="SLA 초과"
              value={overdue.length}
              unit="건"
              tone={overdue.length ? 'alert' : 'signal'}
              hint="요청 후 4시간 안에 배정되지 않은 건입니다. 보호자는 밤새 기다립니다"
            />
            <KpiChip
              label="업무범위 검토"
              value={review.length}
              unit="건"
              tone={review.length ? 'flag' : 'neutral'}
              hint="자동 거절하지 않습니다 — 사람이 설명해야 표현을 바꿔 우회하지 않습니다"
            />
            <KpiChip label="문제 발생" value={issues.length} unit="건" tone={issues.length ? 'alert' : 'neutral'} />
          </KpiRow>
        </div>

        <Section
          title="배정 대기 · 검토"
          note="SLA를 넘긴 건과 업무범위 검토 건이 위로 옵니다. 이 순서가 이 화면의 전부입니다."
        >
          <DataTable
            columns={[
              { key: 'id', label: '신청', width: 110 },
              { key: 'where', label: '병원 · 병실' },
              { key: 'when', label: '기간 · 교대' },
              { key: 'need', label: '필요한 지원' },
              { key: 'scope', label: '업무범위', width: 110 },
              { key: 'sla', label: 'SLA', width: 100 },
              { key: 'status', label: '상태', width: 120 },
            ]}
            empty="배정을 기다리는 신청이 없습니다"
          >
            {[...review, ...overdue, ...waiting.filter((r) => !overdue.includes(r)), ...issues].map((r) => (
              <Tr key={r.id} tone={r.status === 'ISSUE' || overdue.includes(r) ? 'alert' : undefined}>
                <Td mono>{r.id.slice(0, 8)}</Td>
                <Td>
                  {r.hospitalName ?? '병원 미지정'}
                  <span style={{ color: 'var(--cl-text-muted)' }}> · {r.ward ?? '병실 미지정'}</span>
                </Td>
                <Td mono tone="muted">
                  {fmtDate(r.startAt)}
                  {r.endAt ? ` ~ ${fmtDate(r.endAt)}` : ''} · {label(r.shiftPatternCode ?? '')}
                </Td>
                <Td>{(r.supportItems ?? []).map((c) => label(c)).join(' · ') || '—'}</Td>
                <Td>
                  {/* 감지 이력은 감추는 것이 아니라 **띄웁니다.** 같은 요구가 현장에서
                      다시 나올 수 있고, 그때 간병사가 거절할 근거가 됩니다. */}
                  {(r.restrictedFlags ?? []).length > 0
                    ? <StatusPill tone="flag" label={`검토 ${r.restrictedFlags!.length}`} />
                    : <span style={{ color: 'var(--cl-text-disabled)' }}>—</span>}
                </Td>
                <Td mono tone={overdue.includes(r) ? undefined : 'muted'}>
                  {r.slaDueAt ? slaLabel(r.slaDueAt) : '—'}
                </Td>
                <Td><StatusPill tone={statusTone(r.status)} label={label(r.status)} /></Td>
              </Tr>
            ))}
          </DataTable>
        </Section>

        <Section title="진행 중" note="흐르고 있는 건입니다. 여기서 할 일은 없습니다 — 확인용입니다.">
          <DataTable
            columns={[
              { key: 'where', label: '병원 · 병실' },
              { key: 'when', label: '시작', width: 180 },
              { key: 'status', label: '상태', width: 120 },
            ]}
            empty="진행 중인 간병이 없습니다"
          >
            {live.map((r) => (
              <Tr key={r.id}>
                <Td>{r.hospitalName ?? '—'} · {r.ward ?? '—'}</Td>
                <Td mono tone="muted">{fmtDate(r.startAt)}</Td>
                <Td><StatusPill tone={statusTone(r.status)} label={label(r.status)} /></Td>
              </Tr>
            ))}
          </DataTable>
        </Section>
      </div>
    </AdminShell>
  );
}

function statusTone(s: string): 'signal' | 'flag' | 'alert' | 'neutral' {
  if (s === 'ISSUE') return 'alert';
  if (s === 'OPS_REVIEW' || s === 'SUBMITTED' || s === 'MATCHING') return 'flag';
  if (s === 'IN_SERVICE' || s === 'ASSIGNED') return 'signal';
  return 'neutral';
}

/** KST로 씁니다. 화면은 전부 병원 벽시계를 기준으로 합니다. */
function fmtDate(iso: string): string {
  const d = new Date(new Date(iso).getTime() + 9 * 60 * 60 * 1000);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}

/** 남은 시간. 음수는 `-2h`로 씁니다 — 넘긴 건은 넘긴 만큼 보여야 합니다. */
function slaLabel(iso: string): string {
  const h = Math.round((new Date(iso).getTime() - Date.now()) / 3_600_000);
  return h < 0 ? `-${Math.abs(h)}h` : `${h}h`;
}
