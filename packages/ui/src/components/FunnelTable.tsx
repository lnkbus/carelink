import * as React from 'react';
import { StatusPill } from './StatusPill';

export interface FunnelRowData {
  stage: string;
  label: string;
  count: number;
  conversionPct: number;
  /** 이 단계 평균 소요일. 기준 초과면 '지체'가 붙는다. */
  avgDays?: number | null;
  daysThreshold?: number | null;
  /** 이 단계에서 차단된 건수. */
  blocked?: number;
}

/**
 * 단계 / 인원 / 전환 바 / 체류일 / 상태 5열 (design/README §신규 컴포넌트 4).
 *
 * 전환 바는 첫 단계를 100%로 한 상대 폭입니다. 마지막 행은 배경을 깔고 signal로 씁니다 —
 * 퍼널의 결론이 어디인지 눈으로 먼저 잡혀야 합니다.
 *
 * 인원은 '그 단계 이상 도달한 누적'입니다. 현재 상태 스냅샷으로 세면 이탈자가
 * 앞 단계에서 사라져, 이탈이 많은 기수일수록 퍼널이 좋아 보이는 역설이 생깁니다.
 */
export function FunnelTable({ rows }: { rows: FunnelRowData[] }) {
  return (
    <table style={{ fontSize: 'var(--cl-body)' }}>
      <thead>
        <tr style={{ background: 'var(--cl-bg-table-head)', textAlign: 'left' }}>
          {['단계', '인원', '전환', '체류일', '상태'].map((h) => (
            <th
              key={h}
              style={{
                padding: 'var(--cl-s3) var(--cl-s4)', fontSize: 'var(--cl-caption)',
                fontWeight: 600, color: 'var(--cl-text-sub)', borderBottom: '1px solid var(--cl-line)',
              }}
            >
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => {
          const isLast = i === rows.length - 1;
          const delayed = r.avgDays != null && r.daysThreshold != null && r.avgDays > r.daysThreshold;
          return (
            <tr
              key={r.stage}
              style={{
                background: isLast ? 'var(--cl-bg-table-head)' : undefined,
                borderBottom: '1px solid var(--cl-line)',
              }}
            >
              <td style={{ padding: 'var(--cl-s3) var(--cl-s4)' }}>{r.label}</td>
              <td
                style={{
                  padding: 'var(--cl-s3) var(--cl-s4)', fontFamily: 'var(--cl-font-mono)',
                  fontWeight: isLast ? 700 : 500, color: isLast ? 'var(--cl-signal)' : 'var(--cl-text)',
                }}
              >
                {r.count}
              </td>
              <td style={{ padding: 'var(--cl-s3) var(--cl-s4)', minWidth: 180 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--cl-s3)' }}>
                  <span
                    style={{
                      flex: 1, height: 6, borderRadius: 'var(--cl-r-pill)',
                      background: 'var(--cl-bg-sub)', overflow: 'hidden',
                    }}
                  >
                    <span
                      style={{
                        display: 'block', height: '100%',
                        width: `${Math.min(100, r.conversionPct)}%`,
                        background: isLast ? 'var(--cl-signal)' : 'var(--cl-action)',
                      }}
                    />
                  </span>
                  <span
                    style={{
                      fontFamily: 'var(--cl-font-mono)', fontSize: 'var(--cl-caption)',
                      color: 'var(--cl-text-muted)', width: 44, textAlign: 'right',
                    }}
                  >
                    {r.conversionPct}%
                  </span>
                </span>
              </td>
              <td
                style={{
                  padding: 'var(--cl-s3) var(--cl-s4)', fontFamily: 'var(--cl-font-mono)',
                  color: 'var(--cl-text-sub)',
                }}
              >
                {r.avgDays == null ? '—' : `${r.avgDays}일`}
              </td>
              <td style={{ padding: 'var(--cl-s3) var(--cl-s4)' }}>
                <span style={{ display: 'inline-flex', gap: 'var(--cl-s1)' }}>
                  {delayed && <StatusPill tone="flag" label="지체" />}
                  {!!r.blocked && <StatusPill tone="alert" label={`차단 ${r.blocked}`} />}
                  {!delayed && !r.blocked && (
                    <span style={{ color: 'var(--cl-text-disabled)', fontSize: 'var(--cl-caption)' }}>—</span>
                  )}
                </span>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
