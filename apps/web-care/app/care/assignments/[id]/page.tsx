import type { CareAssignment, ServiceLog } from '@carelink/shared-types';
import { Page, Row } from '@/components/Page';
import { apiGet } from '@/lib/api';
import { currentUser } from '@/lib/session';
import { fmtDateTime, label } from '@/lib/labels';

export const dynamic = 'force-dynamic';

/**
 * SCR-306 진행 중 서비스.
 *
 * ── 이 화면이 문의를 줄입니다 ──────────────────────────────────────────
 * 보호자가 가장 많이 하는 행동은 "잘 있나 확인"입니다 (SCR-306 notes).
 * 근무 시작·종료 기록만 실시간으로 보여줘도 전화가 크게 줍니다.
 *
 * ── 환자 상태를 기록하지 않습니다 ──────────────────────────────────────
 * 서술형 메모는 여기 나오지 않습니다 — API의 scope가 잘라 냅니다. 서술형
 * 기록을 보호자에게 보여주면 의료기록과 혼동되고, 그 순간 간병사가 쓴 문장이
 * 진료 판단의 근거처럼 읽힙니다. 정형 항목만 씁니다.
 */
export default async function AssignmentPage({ params }: { params: { id: string } }) {
  await currentUser();
  const [assignment, logs] = await Promise.all([
    apiGet<CareAssignment>(`/care-assignments/${params.id}`),
    apiGet<ServiceLog[]>(`/care-assignments/${params.id}/logs`),
  ]);

  // 시작/종료가 짝을 이루는지 보여줍니다 — 종료 기록이 없으면 근무 중입니다.
  const started = logs.find((l) => l.logType === 'SHIFT_START');
  const ended = logs.find((l) => l.logType === 'SHIFT_END');

  return (
    <Page title="진행 상황" back="/care">
      <div className="cf-card">
        <h2>오늘 근무</h2>
        <Row label="시작">{started ? fmtDateTime(started.occurredAt) : '아직 시작 전'}</Row>
        <Row label="종료">{ended ? fmtDateTime(ended.occurredAt) : started ? '근무 중' : '—'}</Row>
        <Row label="간병사"><span className="cf-mono">{assignment.caregiverDisplayCode}</span></Row>
      </div>

      <div className="cf-card">
        <h2>기록</h2>
        {logs.length === 0 ? (
          <div className="cf-empty" style={{ padding: 'var(--cl-s6) 0' }}>아직 기록이 없습니다.</div>
        ) : (
          logs.map((l) => (
            <div key={l.id} className="cf-log">
              <span className="cf-log-time">{fmtDateTime(l.occurredAt)}</span>
              <span>
                {label(l.logType)}
                {l.itemCode && <span style={{ color: 'var(--cl-text-muted)' }}> · {l.itemCode}</span>}
                {/* 정정된 기록은 표시합니다. 원본이 남아 있다는 사실 자체가
                    분쟁에서 근거가 됩니다 (§5.4). */}
                {l.corrected && (
                  <span style={{ color: 'var(--cl-text-muted)', fontSize: 'var(--cf-caption)' }}> (수정됨)</span>
                )}
              </span>
            </div>
          ))
        )}
      </div>

      <p style={{ margin: 0, fontSize: 'var(--cf-caption)', color: 'var(--cl-text-muted)', lineHeight: 1.6 }}>
        불편한 점이 있으면 담당자에게 알려 주세요. 안전·부당대우·업무범위와
        관련된 신고는 4시간 안에 1차 답변을 드립니다.
      </p>
    </Page>
  );
}
