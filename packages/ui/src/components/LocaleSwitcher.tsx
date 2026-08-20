'use client';
import * as React from 'react';

export type Locale = 'ko' | 'vi' | 'ru' | 'en';

export const LOCALES: { code: Locale; short: string; label: string }[] = [
  { code: 'ko', short: 'KO', label: '한국어' },
  { code: 'vi', short: 'VI', label: 'Việt' },
  { code: 'ru', short: 'RU', label: 'Рус' },
  { code: 'en', short: 'EN', label: 'Eng' },
];

/**
 * 로케일 전환 (design/README §신규 컴포넌트 5).
 *
 * FIELD는 4개 전부, **DESK는 ko 전용**입니다. 그래서 DESK에서는 현재 로케일만
 * 표시하고 선택지를 열지 않습니다 — 운영자·기관 담당자는 한국어로만 쓰기 때문에
 * 선택지를 노출하면 실수로 바꾸고 되돌리지 못합니다.
 */
export function LocaleSwitcher({
  locale, onChange, variant = 'field',
}: {
  locale: Locale;
  onChange?: (next: Locale) => void;
  variant?: 'field' | 'desk';
}) {
  const current = LOCALES.find((l) => l.code === locale) ?? LOCALES[0];

  if (variant === 'desk') {
    return (
      <span
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 'var(--cl-s2)',
          height: 'var(--cl-tap-desk)', padding: '0 var(--cl-s4)',
          borderRadius: 'var(--cl-r-pill)', background: 'var(--cl-bg-sub)',
          color: 'var(--cl-text-sub)', fontSize: 'var(--cl-caption)',
        }}
      >
        <span aria-hidden>🌐</span>
        <span style={{ fontFamily: 'var(--cl-font-mono)', fontWeight: 600 }}>{current.short}</span>
      </span>
    );
  }

  return (
    <div style={{ display: 'flex', gap: 'var(--cl-s2)' }}>
      {LOCALES.map((l) => {
        const active = l.code === locale;
        return (
          <button
            key={l.code}
            type="button"
            onClick={() => onChange?.(l.code)}
            style={{
              height: 52, flex: 1, borderRadius: 'var(--cl-r-desk)',
              border: `1px solid ${active ? 'var(--cl-action)' : 'var(--cl-line-strong)'}`,
              background: active ? 'var(--cl-action-tint)' : 'var(--cl-bg)',
              color: active ? 'var(--cl-action-text)' : 'var(--cl-text-sub)',
              fontSize: 16, fontWeight: active ? 700 : 400,
            }}
          >
            {l.label}
          </button>
        );
      })}
    </div>
  );
}
