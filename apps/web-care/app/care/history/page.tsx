import Link from 'next/link';
import type { CareAssignment, CareRequest, ServiceLog } from '@carelink/shared-types';
import { Page, Notice, Row } from '@/components/Page';
import { apiGet } from '@/lib/api';
import { currentUser } from '@/lib/session';
import { fmtDateTime, label } from '@/lib/labels';

export const dynamic = 'force-dynamic';

/**
 * SCR-307 이용 내역.
 *
 * ── 정산 금액이 없습니다 ────────────────────────────────────────────────
 * SCREENS는 `GET /assignments/{id}/settlement`과 `GET /invoices/{id}`를
 * 요구하지만 **정산·결제는 V3이고 착수 금지입니다** (CLAUDE.md §2).
 * 막혀 있는 것은 기술이 아니라 사업 결정입니다 — 간병사와의 법적 관계에
 * 따라 청구 구조가 달라지고(§5.7), 기관 청구 단가와 취소·환불 정책이
 * 미확정입니다(§10). 임의 금액을 띄우면 그 숫자를 본 보호자가 나중에
 * 다른 금액을 청구받습니다.
 *
 * ── 그래서 무엇을 보여주는가 ────────────────────────────────────────────
 * **기록된 시작·종료 시각**입니다. SCR-307 notes의 요점이 여기입니다 —
 * 근무시간 이견은 반드시 발생하고, 그때 유일한 근거가 `service_logs`의
 * 원본 기록입니다. 로그는 append-only이고 정정은 별도 행으로 남습니다 (§5.4).
 *
 * 시간을 곱해서 금액을 만들지 않습니다. 금액을 만드는 순간 그것이
 * 청구서가 되고, 그 계산은 아직 확정되지 않았습니다.
 */
export default async function HistoryPage() {
  await currentUser();
  const requests = await apiGet<CareRequest[]>('/care-requests/me/list');
  const done = requests.filter((r) => ['COMPLETED', 'CANCELLED'].includes(r.status));

  // 완료 건마다 배정과 기록을 붙입니다. 건수가 많지 않아 순차로 충분합니다.
  const rows = await Promise.all(
    done.map(async (r) => {
      const assignments = await apiGet<CareAssignment[]>(`/care-requests/${r.id}/assignments`)
        .catch(() => [] as CareAssignment[]);
      const a = assignments.find((x) => ['ASSIGNED', 'IN_SERVICE', 'COMPLETED'].includes(x.status));
      const logs = a
        ? await apiGet<ServiceLog[]>(`/care-assignments/${a.id}/logs`).catch(() => [] as ServiceLog[])
        : [];
      return { request: r, assignment: a ?? null, logs };
    }),
  );

  return (
    <Page title="이용 내역" back="/care">
      {rows.length === 0 && <div className="cf-empty">완료된 간병이 없습니다.</div>}

      {rows.map(({ request, assignment, logs }) => {
        const started = logs.find((l) => l.logType === 'SHIFT_START');
        const ended = logs.find((l) => l.logType === 'SHIFT_END');
        const corrected = logs.some((l) => l.correctionOf !== null);

        return (
          <div key={request.id} className="cf-card">
            <div className="cf-row">
              <b style={{ fontSize: 'var(--cf-subtitle)' }}>{request.hospitalName ?? '병원'}</b>
              <span className="cf-label">{label(request.status)}</span>
            </div>
            <Row label="병실">{request.ward ?? '—'}</Row>
            <Row label="기록된 시작">{started ? fmtDateTime(started.occurredAt) : '기록 없음'}</Row>
            <Row label="기록된 종료">{ended ? fmtDateTime(ended.occurredAt) : '기록 없음'}</Row>
            {assignment && (
              <Row label="간병사"><span className="cf-mono">{assignment.caregiverDisplayCode}</span></Row>
            )}
            {/* 정정이 있었다는 사실을 숨기지 않습니다. 원본이 남아 있다는
                것 자체가 이견이 생겼을 때의 근거입니다 (§5.4). */}
            {corrected && (
              <span style={{ fontSize: 'var(--cf-caption)', color: 'var(--cl-flag)' }}>
                시각이 정정된 기록이 있습니다. 원본도 함께 보관됩니다.
              </span>
            )}
            {assignment && (
              <Link
                href={`/care/assignments/${assignment.id}`}
                style={{ fontSize: 'var(--cf-caption)' }}
              >
                기록 전체 보기
              </Link>
            )}
          </div>
        );
      })}

      <Notice>
        <b>비용은 아직 이 화면에 나오지 않습니다.</b>
        <br />
        간병 비용과 취소 규정이 확정되면 여기에 함께 표시됩니다. 그전까지는
        담당자가 안내해 드립니다.
        <br />
        <br />
        근무 시간에 이견이 있으면 담당자에게 알려 주세요. 위에 보이는
        시작·종료 기록이 근거가 되고, 이 기록은 지워지거나 덮어써지지 않습니다.
      </Notice>
    </Page>
  );
}
