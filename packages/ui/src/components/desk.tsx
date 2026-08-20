import * as React from 'react';

/** DESK 페이지 헤더. 화면 제목 + 화면 ID + 우측 액션. */
export function PageHeader({
  title, screenId, description, actions,
}: {
  title: string;
  screenId?: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header
      style={{
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        gap: 'var(--cl-s6)', padding: 'var(--cl-s6) var(--cl-s7)',
        borderBottom: '1px solid var(--cl-line)',
      }}
    >
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--cl-s3)' }}>
          <h1 style={{ margin: 0, fontSize: 'var(--cl-display)', fontWeight: 700 }}>{title}</h1>
          {screenId && (
            <span
              style={{
                fontFamily: 'var(--cl-font-mono)', fontSize: 'var(--cl-micro)',
                color: 'var(--cl-text-disabled)', letterSpacing: '.04em',
              }}
            >
              {screenId}
            </span>
          )}
        </div>
        {description && (
          <p style={{ margin: 'var(--cl-s2) 0 0', fontSize: 'var(--cl-caption)', color: 'var(--cl-text-muted)' }}>
            {description}
          </p>
        )}
      </div>
      {actions && <div style={{ display: 'flex', gap: 'var(--cl-s3)' }}>{actions}</div>}
    </header>
  );
}

/** KPI 칩. 값은 mono — 숫자는 이 시스템의 시각적 서명입니다. */
export function KpiChip({
  label, value, unit, tone = 'neutral', hint,
}: {
  label: string;
  value: string | number;
  unit?: string;
  tone?: 'neutral' | 'signal' | 'flag' | 'alert' | 'action';
  hint?: string;
}) {
  const color =
    tone === 'signal' ? 'var(--cl-signal)'
    : tone === 'flag' ? 'var(--cl-flag)'
    : tone === 'alert' ? 'var(--cl-alert)'
    : tone === 'action' ? 'var(--cl-action-text)'
    : 'var(--cl-text)';
  return (
    <div
      style={{
        flex: '1 1 0', minWidth: 132, padding: 'var(--cl-s5)',
        border: '1px solid var(--cl-line)', borderRadius: 'var(--cl-r-desk)',
      }}
      title={hint}
    >
      <div style={{ fontSize: 'var(--cl-caption)', color: 'var(--cl-text-muted)' }}>{label}</div>
      <div style={{ marginTop: 'var(--cl-s2)', display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <span style={{ fontFamily: 'var(--cl-font-mono)', fontSize: 'var(--cl-display)', fontWeight: 700, color }}>
          {value}
        </span>
        {unit && <span style={{ fontSize: 'var(--cl-caption)', color: 'var(--cl-text-muted)' }}>{unit}</span>}
      </div>
    </div>
  );
}

export function KpiRow({ children }: { children: React.ReactNode }) {
  return <div style={{ display: 'flex', gap: 'var(--cl-s3)', flexWrap: 'wrap' }}>{children}</div>;
}

export function Section({
  title, children, aside, note,
}: {
  title: string;
  children: React.ReactNode;
  aside?: React.ReactNode;
  note?: string;
}) {
  return (
    <section style={{ marginTop: 'var(--cl-s7)' }}>
      <div
        style={{
          display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
          marginBottom: 'var(--cl-s4)', gap: 'var(--cl-s5)',
        }}
      >
        <h2 style={{ margin: 0, fontSize: 'var(--cl-title)', fontWeight: 600 }}>{title}</h2>
        {aside}
      </div>
      {note && (
        <p style={{ margin: '0 0 var(--cl-s4)', fontSize: 'var(--cl-caption)', color: 'var(--cl-text-muted)' }}>
          {note}
        </p>
      )}
      <div style={{ border: '1px solid var(--cl-line)', borderRadius: 'var(--cl-r-desk)', overflow: 'hidden' }}>
        {children}
      </div>
    </section>
  );
}

/** DESK 표. 헤더 배경 #F9FAFB, 행 hover #F9FAFB, 1px 라인. */
export function DataTable({
  columns, children, empty,
}: {
  columns: { key: string; label: string; width?: number | string; align?: 'left' | 'right' }[];
  children: React.ReactNode;
  empty?: string;
}) {
  const hasRows = React.Children.count(children) > 0;
  return (
    <table style={{ fontSize: 'var(--cl-body)' }}>
      <thead>
        <tr style={{ background: 'var(--cl-bg-table-head)' }}>
          {columns.map((c) => (
            <th
              key={c.key}
              style={{
                padding: 'var(--cl-s3) var(--cl-s4)', textAlign: c.align ?? 'left',
                width: c.width, fontSize: 'var(--cl-caption)', fontWeight: 600,
                color: 'var(--cl-text-sub)', borderBottom: '1px solid var(--cl-line)',
                whiteSpace: 'nowrap',
              }}
            >
              {c.label}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {hasRows ? children : (
          <tr>
            <td
              colSpan={columns.length}
              style={{
                padding: 'var(--cl-s8) var(--cl-s4)', textAlign: 'center',
                color: 'var(--cl-text-muted)', fontSize: 'var(--cl-caption)',
              }}
            >
              {empty ?? '해당하는 항목이 없습니다'}
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
}

export function Td({
  children, mono = false, align = 'left', tone,
}: {
  children: React.ReactNode;
  mono?: boolean;
  align?: 'left' | 'right';
  tone?: 'alert' | 'flag' | 'muted';
}) {
  const color =
    tone === 'alert' ? 'var(--cl-alert)'
    : tone === 'flag' ? 'var(--cl-flag)'
    : tone === 'muted' ? 'var(--cl-text-muted)'
    : undefined;
  return (
    <td
      style={{
        padding: 'var(--cl-s3) var(--cl-s4)', textAlign: align, color,
        fontFamily: mono ? 'var(--cl-font-mono)' : undefined,
        borderBottom: '1px solid var(--cl-line)', verticalAlign: 'middle',
      }}
    >
      {children}
    </td>
  );
}

export function Tr({ children, tone }: { children: React.ReactNode; tone?: 'alert' | 'selected' }) {
  return (
    <tr
      style={{
        background:
          tone === 'alert' ? 'var(--cl-row-alert)'
          : tone === 'selected' ? 'var(--cl-row-selected)'
          : undefined,
      }}
    >
      {children}
    </tr>
  );
}

export function Button({
  children, variant = 'ghost', onClick, type = 'button', disabled, tone,
}: {
  children: React.ReactNode;
  variant?: 'filled' | 'ghost';
  onClick?: () => void;
  type?: 'button' | 'submit';
  disabled?: boolean;
  tone?: 'alert';
}) {
  const filled = variant === 'filled';
  const accent = tone === 'alert' ? 'var(--cl-alert)' : 'var(--cl-action-strong)';
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        height: 'var(--cl-tap-desk)', padding: '0 var(--cl-s5)',
        borderRadius: 'var(--cl-r-desk)', fontSize: 'var(--cl-body)', fontWeight: 600,
        border: `1px solid ${filled ? accent : 'var(--cl-line-strong)'}`,
        background: filled ? accent : 'var(--cl-bg)',
        color: filled ? '#FFFFFF' : 'var(--cl-text-sub)',
        opacity: disabled ? 0.45 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      {children}
    </button>
  );
}

/**
 * 권한 밖 필드 자리.
 *
 * **비활성화가 아니라 미렌더링이 규칙입니다** (docs/09 §4.1 최소 노출).
 * 회색 처리된 필드는 '값이 있는데 안 보여준다'는 신호라서, 열어 달라는 요청과
 * 우회 시도를 부릅니다. 값 대신 이 안내를 놓으세요.
 */
export function Restricted({ reason }: { reason: string }) {
  return (
    <span style={{ fontSize: 'var(--cl-caption)', color: 'var(--cl-text-disabled)' }}>{reason}</span>
  );
}
