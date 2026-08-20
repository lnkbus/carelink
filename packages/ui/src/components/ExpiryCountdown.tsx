import * as React from 'react';
import type { SignalTone } from './StatusPill';

/**
 * 임계값 (design/README §신규 컴포넌트 1).
 * D-90 이상 signal · D-89~D-31 flag · D-30 이하 alert.
 */
export function expiryTone(days: number | null | undefined): SignalTone {
  if (days === null || days === undefined) return 'neutral';
  if (days <= 30) return 'alert';
  if (days <= 89) return 'flag';
  return 'signal';
}

const TONE_BG: Record<SignalTone, string> = {
  signal: 'var(--cl-signal-tint)', flag: 'var(--cl-flag-tint)', alert: 'var(--cl-alert-tint)',
  action: 'var(--cl-action-tint)', neutral: 'var(--cl-bg-sub)',
};
const TONE_FG: Record<SignalTone, string> = {
  signal: 'var(--cl-signal)', flag: 'var(--cl-flag)', alert: 'var(--cl-alert)',
  action: 'var(--cl-action-text)', neutral: 'var(--cl-text-muted)',
};

/**
 * `D-42` 형태의 만료 카운트다운.
 *
 * **만료는 날짜만 노출하지 않습니다.** 사람은 `2026-09-10`을 보고 남은 날을
 * 계산하지 않습니다 — 특히 체류자격 만료는 계산을 놓치면 불법 취업이 됩니다 (§5.9).
 * 날짜 원문은 title 속성(툴팁)과 상세 화면에만 둡니다.
 */
export function ExpiryCountdown({
  days, label, date, compact = false,
}: {
  days: number | null;
  label?: string;
  date?: string | null;
  compact?: boolean;
}) {
  const tone = expiryTone(days);
  const text = days === null ? '만료일 없음' : days < 0 ? `D+${Math.abs(days)}` : `D-${days}`;

  return (
    <span
      title={date ?? undefined}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 'var(--cl-s2)',
        padding: compact ? '2px var(--cl-s2)' : 'var(--cl-s2) var(--cl-s4)',
        borderRadius: 'var(--cl-r-chip)', background: TONE_BG[tone], color: TONE_FG[tone],
      }}
    >
      {label && <span style={{ fontSize: 'var(--cl-caption)' }}>{label}</span>}
      <span
        style={{
          fontFamily: 'var(--cl-font-mono)', fontWeight: 700,
          fontSize: compact ? 'var(--cl-body)' : '17px',
        }}
      >
        {text}
      </span>
      {days !== null && days < 0 && (
        <span style={{ fontSize: 'var(--cl-caption)', fontWeight: 600 }}>만료됨</span>
      )}
    </span>
  );
}
