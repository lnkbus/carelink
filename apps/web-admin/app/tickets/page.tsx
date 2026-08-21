import type { SupportTicket, TicketSummary } from '@carelink/shared-types';
import { DataTable, KpiChip, KpiRow, PageHeader, Section, StatusPill, Td, Tr } from '@carelink/ui';
import { Shell } from '@/components/Shell';
import { ApiError, apiGet } from '@/lib/api';
import { label } from '@/lib/labels';
import { redirectToLogin } from '@/lib/session';

export const dynamic = 'force-dynamic';

/**
 * SCR-506 사건 · 문의 관리.
 *
 * **이 화면이 없어서 `ticket-sla` 잡이 허공에 돌고 있었습니다.** 안전사고·
 * 부당대우·업무범위 초과는 4시간 안에 대응해야 하는데, 넘긴 건이 어디에도
 * 뜨지 않았습니다.
 *
 * 유형을 구조화하는 것이 이 화면의 요점입니다 (SCR-506 notes). '기타'로 다
 * 받으면 어느 유형이 늘고 있는지 알 수 없고 에스컬레이션 경로도 나눌 수
 * 없습니다. 그래서 요약을 **유형별로** 먼저 보여 주고, 그 다음이 목록입니다.
 *
 * SLA를 넘긴 건은 맨 위로 올립니다. 대응 실패가 사업 리스크로 전이되는 것이
 * 이 도메인의 가장 큰 단일 위험이고, 그건 늦게 보는 데서 시작합니다.
 */
export default async function TicketsPage({
  searchParams,
}: {
  searchParams: { status?: string; ticketType?: string };
}) {
  let rows: SupportTicket[];
  let summary: TicketSummary[];
  try {
    [rows, summary] = await Promise.all([
      apiGet<SupportTicket[]>('/admin/support-tickets', {
        status: searchParams.status, ticketType: searchParams.ticketType,
      }),
      apiGet<TicketSummary[]>('/admin/support-tickets/summary'),
    ]);
  } catch (e) {
    if (e instanceof ApiError && (e.status === 401 || e.status === 403)) redirectToLogin(e);
    throw e;
  }

  const open = rows.filter((t) => t.status !== 'CLOSED' && t.status !== 'RESOLVED');
  const overdue = open.filter((t) => (t.slaLeftHours ?? 1) < 0);
  const urgent = open.filter((t) => t.urgent);
  const escalated = rows.filter((t) => t.status === 'ESCALATED');

  // SLA 초과 → 긴급 → 나머지. 이 순서가 이 화면의 전부입니다.
  const ordered = [
    ...overdue,
    ...urgent.filter((t) => !overdue.includes(t)),
    ...open.filter((t) => !overdue.includes(t) && !urgent.includes(t)),
  ];

  return (
    <Shell>
      <PageHeader
        title="사건 · 문의"
        screenId="SCR-506"
        description="SLA를 넘긴 건이 맨 위입니다. 대응 실패는 늦게 보는 데서 시작합니다."
      />
      <div className="cl-body">
        <div style={{ marginTop: 'var(--cl-s6)' }}>
          <KpiRow>
            <KpiChip label="열린 건" value={open.length} unit="건" />
            <KpiChip
              label="SLA 초과"
              value={overdue.length}
              unit="건"
              tone={overdue.length ? 'alert' : 'signal'}
              hint="안전사고·부당대우·업무범위 초과는 4시간입니다"
            />
            <KpiChip label="긴급" value={urgent.length} unit="건" tone={urgent.length ? 'alert' : 'neutral'} />
            <KpiChip label="에스컬레이션" value={escalated.length} unit="건" tone={escalated.length ? 'flag' : 'neutral'} />
          </KpiRow>
        </div>

        <Section
          title="유형별"
          note="'기타'로 다 받으면 어느 유형이 늘고 있는지 알 수 없습니다. 유형이 곧 대응 경로입니다."
        >
          <DataTable
            columns={[
              { key: 'type', label: '유형' },
              { key: 'urgent', label: '긴급', width: 90 },
              { key: 'route', label: '경로', width: 160 },
              { key: 'open', label: '열림', width: 90 },
              { key: 'esc', label: '에스컬', width: 90 },
              { key: 'total', label: '누적', width: 90 },
            ]}
            empty="접수된 사건이 없습니다"
          >
            {summary.map((s) => (
              <Tr key={`${s.ticketType}-${s.route}`} tone={s.urgent && s.open > 0 ? 'alert' : undefined}>
                <Td>{label(s.ticketType)}</Td>
                <Td>{s.urgent ? <StatusPill tone="alert" label="긴급" /> : <span style={{ color: 'var(--cl-text-disabled)' }}>—</span>}</Td>
                <Td tone="muted">{label(s.route)}</Td>
                <Td mono>{s.open}</Td>
                <Td mono>{s.escalated}</Td>
                <Td mono tone="muted">{s.total}</Td>
              </Tr>
            ))}
          </DataTable>
        </Section>

        <Section title="열린 건" note="SLA 초과 → 긴급 → 나머지 순입니다.">
          <DataTable
            columns={[
              { key: 'id', label: '번호', width: 110 },
              { key: 'type', label: '유형' },
              { key: 'sev', label: '심각도', width: 100 },
              { key: 'reporter', label: '신고자', width: 120 },
              { key: 'sla', label: 'SLA', width: 100 },
              { key: 'status', label: '상태', width: 120 },
              { key: 'created', label: '접수', width: 130 },
            ]}
            empty="열린 사건이 없습니다"
          >
            {ordered.map((t) => (
              <Tr key={t.id} tone={(t.slaLeftHours ?? 1) < 0 ? 'alert' : undefined}>
                <Td mono>{t.id.slice(0, 8)}</Td>
                <Td>{label(t.ticketType)}</Td>
                <Td><StatusPill tone={sevTone(t.severity)} label={label(t.severity)} /></Td>
                <Td tone="muted">{t.reporterRole ? label(t.reporterRole) : '—'}</Td>
                {/* 남은 시간을 숫자로 씁니다. '지연'이라고만 쓰면 얼마나 늦었는지
                    모르고, 그러면 무엇부터 볼지 정할 수 없습니다. */}
                <Td mono>
                  {t.slaLeftHours === null || t.slaLeftHours === undefined
                    ? '—'
                    : t.slaLeftHours < 0 ? `-${Math.abs(t.slaLeftHours)}h` : `${t.slaLeftHours}h`}
                </Td>
                <Td><StatusPill tone={statusTone(t.status)} label={label(t.status)} /></Td>
                <Td mono tone="muted">{fmtDate(t.createdAt)}</Td>
              </Tr>
            ))}
          </DataTable>
        </Section>
      </div>
    </Shell>
  );
}

function sevTone(s: string): 'signal' | 'flag' | 'alert' | 'neutral' {
  return s === 'HIGH' ? 'alert' : s === 'MEDIUM' ? 'flag' : 'neutral';
}

function statusTone(s: string): 'signal' | 'flag' | 'alert' | 'neutral' {
  if (s === 'ESCALATED') return 'alert';
  if (s === 'RESOLVED' || s === 'CLOSED') return 'signal';
  return 'flag';
}

/** KST. 화면은 전부 병원 벽시계를 기준으로 합니다. */
function fmtDate(iso: string): string {
  const d = new Date(new Date(iso).getTime() + 9 * 60 * 60 * 1000);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
}
