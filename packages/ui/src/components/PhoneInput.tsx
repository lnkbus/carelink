'use client';
import { useState } from 'react';

/**
 * SCR-002의 번호 입력칸 (웹).
 *
 * 시안 그대로입니다: 국가번호 `+82`가 왼쪽에 고정되고, 세로 구분선, 그
 * 오른쪽에 `010 4821 8821`처럼 **세 덩어리로 띄어 쓴** 번호, 맨 끝에 지우기.
 *
 * 국가번호를 밖으로 뺀 이유가 둘 있습니다.
 *   · 사용자는 자기 번호를 `010…`으로 압니다. `+8210…`을 통째로 치라고 하면
 *     매번 틀립니다.
 *   · 해외 거주 후보자는 국가번호를 **바꿔야** 합니다 (docs/08 E·F 세그먼트).
 *     칸 안에 섞여 있으면 어디까지가 국가번호인지 알 수 없습니다.
 *
 * 띄어쓰기는 표시용입니다. `onChange`는 국가번호를 붙인 값을 그대로 주고,
 * 최종 정규화는 서버가 E.164로 합니다.
 */
const DIAL_CODES = [
  { code: '+82', name: '대한민국' },
  { code: '+84', name: 'Việt Nam' },
  { code: '+998', name: "O'zbekiston" },
  { code: '+7', name: 'Россия · Қазақстан' },
  { code: '+95', name: 'Myanmar' },
  { code: '+855', name: 'កម្ពុជា' },
];

/** `01048218821` → `010 4821 8821`. 붙여 쓰면 읽으면서 확인할 수 없습니다. */
function group(digits: string): string {
  const d = digits.replace(/\D/g, '');
  const parts = [d.slice(0, 3), d.slice(3, 7), d.slice(7, 11)].filter(Boolean);
  return parts.join(' ');
}

export function PhoneInput({
  value, onChange, disabled = false, label,
}: {
  /** 숫자만. 국가번호는 포함하지 않습니다. */
  value: string;
  /** (숫자, 국가번호) — 호출부가 합쳐서 서버로 보냅니다. */
  onChange: (digits: string, dial: string) => void;
  disabled?: boolean;
  label: string;
}) {
  const [dial, setDial] = useState('+82');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--cl-s3)' }}>
      <label
        htmlFor="cl-phone"
        style={{ fontSize: 16, fontWeight: 600, color: 'var(--cl-text-sub)' }}
      >
        {label}
      </label>
      <div
        style={{
          minHeight: 64, display: 'flex', alignItems: 'center', gap: 10,
          padding: '0 16px', borderRadius: 12,
          border: `${disabled ? 1 : 2}px solid ${disabled ? 'var(--cl-line-strong)' : 'var(--cl-action)'}`,
          background: disabled ? 'var(--cl-bg-sub)' : 'var(--cl-bg)',
        }}
      >
        {/* 국가번호는 48px 타깃입니다 — 해외 후보자가 여기서 바꿉니다. */}
        <select
          aria-label="국가번호"
          value={dial}
          disabled={disabled}
          onChange={(e) => { setDial(e.target.value); onChange(value, e.target.value); }}
          style={{
            height: 48, border: 'none', background: 'transparent',
            fontFamily: 'var(--cl-font-mono)', fontSize: 19, fontWeight: 600,
            color: 'var(--cl-text-sub)', cursor: disabled ? 'default' : 'pointer',
          }}
        >
          {DIAL_CODES.map((d) => (
            <option key={d.code} value={d.code}>{d.code}</option>
          ))}
        </select>
        <span style={{ width: 1, height: 26, background: 'var(--cl-line)' }} />
        <input
          id="cl-phone"
          inputMode="numeric"
          autoComplete="tel-national"
          placeholder="010 0000 0000"
          disabled={disabled}
          value={group(value)}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 15), dial)}
          style={{
            flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent',
            fontFamily: 'var(--cl-font-mono)', fontSize: 19, fontWeight: 700,
            color: 'var(--cl-text)',
          }}
        />
        {!disabled && value.length > 0 && (
          <button
            type="button"
            aria-label="지우기"
            onClick={() => onChange('', dial)}
            style={{
              width: 28, height: 28, borderRadius: 999, border: 'none',
              background: 'var(--cl-bg-sub)', color: 'var(--cl-text-sub)',
              cursor: 'pointer', lineHeight: 1, fontSize: 15,
            }}
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}
