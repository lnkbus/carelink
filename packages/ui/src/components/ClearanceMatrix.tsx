import * as React from 'react';

/**
 * 표시 순서는 고정입니다 (design/README §신규 컴포넌트 2).
 * 여권 · 자격증 · 범죄경력 · 건강검진 · 체류자격.
 *
 * 화면마다 순서가 다르면 운영자가 위치로 읽지 못하고 매번 라벨을 읽어야 합니다.
 */
export const MATRIX_ORDER = [
  { key: 'PASSPORT',              label: '여권' },
  { key: 'CERTIFICATE',           label: '자격증' },
  { key: 'CRIMINAL_RECORD_CLEAR', label: '범죄경력' },
  { key: 'HEALTH_CHECK',          label: '건강검진' },
  { key: 'VISA_ELIGIBLE',         label: '체류자격' },
] as const;

export type MatrixState = 'VERIFIED' | 'REVIEW' | 'BLOCKED' | 'NOT_APPLICABLE';

const STATE_COLOR: Record<MatrixState, string> = {
  VERIFIED:       '#00703A',
  REVIEW:         '#C77700',
  BLOCKED:        '#C7302A',
  NOT_APPLICABLE: '#8B95A1',
};
const STATE_LABEL: Record<MatrixState, string> = {
  VERIFIED: '승인', REVIEW: '검토', BLOCKED: '만료·미제출', NOT_APPLICABLE: '미해당',
};

/**
 * DESK 형태 — 16×16 사각형 5개.
 *
 * 색만으로 상태를 구분하므로 **범례를 표 하단에 항상 노출해야 합니다.**
 * `<ClearanceLegend />`를 같은 화면에 반드시 함께 두세요. 각 칸에는 title을 달아
 * 마우스로도 확인할 수 있게 합니다.
 */
export function ClearanceMatrix({ states }: { states: Partial<Record<string, MatrixState>> }) {
  return (
    <span style={{ display: 'inline-flex', gap: 'var(--cl-s1)' }}>
      {MATRIX_ORDER.map(({ key, label }) => {
        const state = states[key] ?? 'BLOCKED';
        return (
          <span
            key={key}
            title={`${label} — ${STATE_LABEL[state]}`}
            aria-label={`${label} ${STATE_LABEL[state]}`}
            style={{
              width: 16, height: 16, borderRadius: 'var(--cl-r-chip)',
              background: STATE_COLOR[state], display: 'inline-block',
            }}
          />
        );
      })}
    </span>
  );
}

/** 범례. ClearanceMatrix를 쓰는 화면에는 이것이 반드시 함께 있어야 합니다. */
export function ClearanceLegend() {
  return (
    <div
      style={{
        display: 'flex', gap: 'var(--cl-s5)', flexWrap: 'wrap',
        fontSize: 'var(--cl-caption)', color: 'var(--cl-text-muted)',
        padding: 'var(--cl-s3) 0',
      }}
    >
      <span style={{ color: 'var(--cl-text-sub)' }}>
        순서: {MATRIX_ORDER.map((m) => m.label).join(' · ')}
      </span>
      {(Object.keys(STATE_COLOR) as MatrixState[]).map((state) => (
        <span key={state} style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--cl-s1)' }}>
          <span style={{ width: 10, height: 10, borderRadius: 2, background: STATE_COLOR[state] }} />
          {STATE_LABEL[state]}
        </span>
      ))}
    </div>
  );
}
