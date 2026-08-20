import * as React from 'react';

export type SignalTone = 'signal' | 'flag' | 'alert' | 'neutral' | 'action';

const TONE_STYLE: Record<SignalTone, React.CSSProperties> = {
  signal:  { color: 'var(--cl-signal)', background: 'var(--cl-signal-tint)', borderColor: 'transparent' },
  flag:    { color: 'var(--cl-flag)',   background: 'var(--cl-flag-tint)',   borderColor: 'var(--cl-flag-line)' },
  alert:   { color: 'var(--cl-alert)',  background: 'var(--cl-alert-tint)',  borderColor: 'var(--cl-alert-line)' },
  action:  { color: 'var(--cl-action-text)', background: 'var(--cl-action-tint)', borderColor: 'transparent' },
  neutral: { color: 'var(--cl-text-sub)', background: 'var(--cl-bg-sub)', borderColor: 'transparent' },
};

/** 상태 아이콘. 색만으로 상태를 전달하지 않기 위해 항상 함께 붙는다 (design/README §Interactions). */
const TONE_GLYPH: Record<SignalTone, string> = {
  signal: '✓', flag: '!', alert: '×', action: '·', neutral: '·',
};

/**
 * 상태 배지.
 *
 * **색 + 아이콘 + 텍스트 3중 표현이 규칙입니다.** 색만으로, 또는 아이콘만으로
 * 상태를 전달하는 구현은 반려 대상입니다 (docs/09 §4.2). 그래서 tone만 받고
 * label을 생략하는 사용법을 열어 두지 않았습니다.
 */
export function StatusPill({
  tone, label, mono = false,
}: {
  tone: SignalTone;
  label: string;
  mono?: boolean;
}) {
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 'var(--cl-s1)',
        padding: '2px var(--cl-s2)', borderRadius: 'var(--cl-r-chip)',
        border: '1px solid', fontSize: 'var(--cl-caption)', fontWeight: 500,
        lineHeight: '18px', whiteSpace: 'nowrap',
        fontFamily: mono ? 'var(--cl-font-mono)' : 'inherit',
        ...TONE_STYLE[tone],
      }}
    >
      <span aria-hidden style={{ fontWeight: 700 }}>{TONE_GLYPH[tone]}</span>
      {label}
    </span>
  );
}
