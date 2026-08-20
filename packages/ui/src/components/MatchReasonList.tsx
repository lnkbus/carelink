import * as React from 'react';

export interface MatchReasonItem {
  ruleCode: string;
  label: string;
  points: number;
  maxPoints: number;
}

/**
 * 매칭 근거 목록.
 *
 * **점수 단독 노출은 금지입니다** (§5.6 · design/README §신규 컴포넌트 3).
 * 항목마다 아이콘 + 사유 + 가중치(`+30`)를 함께 보여줍니다. 점수만 주는 매칭은
 * 기관도 후보자도 신뢰하지 않고, 운영자가 왜 이 사람이 위에 있는지 설명할 수 없습니다.
 *
 * 차단은 점수 항목과 섞지 않고 카드 하단에 alert 블록으로 **분리**합니다.
 * 차단 사유 문장이 없는 차단 표시는 만들지 마세요.
 */
export function MatchReasonList({
  score, reasons, missing, blockedReason,
}: {
  score: number;
  reasons: MatchReasonItem[];
  missing: string[];
  blockedReason?: string | null;
}) {
  return (
    <div style={{ border: '1px solid var(--cl-line)', borderRadius: 'var(--cl-r-desk)' }}>
      <div
        style={{
          display: 'flex', alignItems: 'baseline', gap: 'var(--cl-s3)',
          padding: 'var(--cl-s5)', borderBottom: '1px solid var(--cl-line)',
        }}
      >
        <span style={{ fontFamily: 'var(--cl-font-mono)', fontSize: 'var(--cl-display)', fontWeight: 700 }}>
          {score}
        </span>
        <span style={{ fontSize: 'var(--cl-caption)', color: 'var(--cl-text-muted)' }}>
          점수는 근거와 함께만 의미가 있습니다
        </span>
      </div>

      <ul style={{ listStyle: 'none', margin: 0, padding: 'var(--cl-s3) 0' }}>
        {reasons.map((r) => {
          const met = r.points > 0;
          return (
            <li
              key={r.ruleCode}
              style={{
                display: 'flex', alignItems: 'center', gap: 'var(--cl-s3)',
                padding: 'var(--cl-s2) var(--cl-s5)', fontSize: 'var(--cl-body)',
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700,
                  background: met ? 'var(--cl-signal-tint)' : 'var(--cl-flag-tint)',
                  color: met ? 'var(--cl-signal)' : 'var(--cl-flag)',
                }}
              >
                {met ? '✓' : '◷'}
              </span>
              <span style={{ flex: 1, color: met ? 'var(--cl-text)' : 'var(--cl-text-sub)' }}>{r.label}</span>
              <span
                style={{
                  fontFamily: 'var(--cl-font-mono)', fontWeight: 600,
                  color: met ? 'var(--cl-signal)' : 'var(--cl-text-muted)',
                }}
              >
                {met ? `+${r.points}` : `0 / ${r.maxPoints}`}
              </span>
            </li>
          );
        })}
      </ul>

      {missing.length > 0 && (
        <div
          style={{
            padding: 'var(--cl-s4) var(--cl-s5)', borderTop: '1px solid var(--cl-line)',
            background: 'var(--cl-flag-tint)', color: 'var(--cl-flag)',
            fontSize: 'var(--cl-caption)',
          }}
        >
          부족한 요건 — {missing.join(' · ')}
        </div>
      )}

      {blockedReason && (
        <div
          style={{
            padding: 'var(--cl-s4) var(--cl-s5)', borderTop: '1px solid var(--cl-alert-line)',
            background: 'var(--cl-alert-tint)', color: 'var(--cl-alert)', fontSize: 'var(--cl-caption)',
          }}
        >
          <strong style={{ display: 'block', marginBottom: 2 }}>배정 차단</strong>
          {blockedReason}
        </div>
      )}
    </div>
  );
}
