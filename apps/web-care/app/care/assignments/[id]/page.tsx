import type { CareAssignment, ServiceLog } from '@carelink/shared-types';
import { Page, Row } from '@/components/Page';
import { guardedGet } from '@/lib/api';
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
    guardedGet<CareAssignment>(`/care-assignments/${params.id}`),
    guardedGet<ServiceLog[]>(`/care-assignments/${params.id}/logs`),
  ]);

  // 시작/종료가 짝을 이루는지 보여줍니다 — 종료 기록이 없으면 근무 중입니다.
  const started = logs.find((l) => l.logType === 'SHIFT_START');
  const ended = logs.find((l) => l.logType === 'SHIFT_END');

  return (
    <Page title="진행 중 간병" back="/care">
      {/*
        시안(SCR-306)의 상단 카드 — 파란 2px 테두리 · 상태 pill · 64px 아바타 ·
        전화/메시지 64px. 보호자가 이 화면에서 가장 많이 하는 행동은
        "잘 있나 확인"이고, 그다음이 "연락"입니다.

        시안의 실명(`응우옌 티 흐엉`) 자리에는 표시 코드가 들어갑니다 —
        간병사 실명·국적은 보호자에게 나가지 않습니다 (§6-21).
      */}
      <div
        className="cf-card"
        style={{ border: '2px solid var(--cl-action)', borderRadius: 18 }}
      >
        <div className="cf-row">
          <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--cl-action-text)' }}>
            진행 중 간병
          </span>
          <span
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: started && !ended ? 'var(--cl-signal-tint)' : 'var(--cl-bg-sub)',
              borderRadius: 999, padding: '7px 12px',
              fontSize: 15, fontWeight: 700,
              color: started && !ended ? 'var(--cl-signal)' : 'var(--cl-text-sub)',
            }}
          >
            <span
              style={{
                width: 9, height: 9, borderRadius: 999,
                background: started && !ended ? 'var(--cl-signal)' : 'var(--cl-text-disabled)',
              }}
            />
            {ended ? '근무 종료' : started ? '근무 중' : '시작 전'}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span
            aria-hidden="true"
            style={{
              width: 60, height: 60, borderRadius: 999, flex: 'none',
              background: 'var(--cl-action-tint)', color: 'var(--cl-action)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28,
            }}
          >
            ☺
          </span>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
            <b className="cf-mono" style={{ fontSize: 20 }}>{assignment.caregiverDisplayCode}</b>
            <span style={{ fontSize: 16, color: 'var(--cl-text-muted)' }}>
              {started ? `시작 ${fmtDateTime(started.occurredAt)}` : '아직 시작 전'}
            </span>
          </div>
        </div>

        {/*
          시안의 전화·메시지 64px. 간병사 연락처는 보호자에게 직접 나가지
          않습니다 — 플랫폼을 우회한 직거래가 생기면 사고 시 책임 주체가
          사라집니다. 담당자를 거칩니다.
        */}
        <div style={{ display: 'flex', gap: 'var(--cl-s3)' }}>
          <a className="cf-btn cf-btn-ghost" href="tel:1533-0000" style={{ minHeight: 64 }}>
            전화 상담
          </a>
        </div>
      </div>

      <div className="cf-card">
        <h2>오늘 기록</h2>
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

      {/*
        시안 하단의 '간병 중단 요청'. alert 텍스트로만 둡니다 — 버튼으로
        만들면 누르기 쉬워지고, 중단은 되돌리기 어려운 동작입니다.
        접수는 담당자를 거칩니다 (안전·부당대우 신고 4시간 SLA와 같은 경로).
      */}
      <p style={{ margin: 0, fontSize: 'var(--cf-caption)', color: 'var(--cl-text-muted)', lineHeight: 1.6 }}>
        불편한 점이 있으면 담당자에게 알려 주세요. 안전·부당대우·업무범위와
        관련된 신고는 4시간 안에 1차 답변을 드립니다.
      </p>
      <a
        href="tel:1533-0000"
        style={{ fontSize: 'var(--cf-body)', color: 'var(--cl-alert)', fontWeight: 600 }}
      >
        간병 중단 요청
      </a>
    </Page>
  );
}
