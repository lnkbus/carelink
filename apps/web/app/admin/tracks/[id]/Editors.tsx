'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@carelink/ui';
import type { TrackRequirement } from '@carelink/shared-types';
import { errorLabel } from '@/lib/labels-admin';

const KINDS = [
  { value: 'DOCUMENT', label: '서류' },
  { value: 'TRAINING', label: '교육' },
  { value: 'LICENSE', label: '자격 · 면허' },
  { value: 'HEALTH_CHECK', label: '건강진단' },
  { value: 'AGE', label: '연령' },
];

const cell: React.CSSProperties = {
  height: 'var(--cl-tap-desk)', padding: '0 var(--cl-s4)',
  border: '1px solid var(--cl-line-strong)', borderRadius: 'var(--cl-r-desk)',
  fontSize: 'var(--cl-body)', fontFamily: 'inherit',
};

function useSave(path: string) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function save(body: unknown) {
    setBusy(true); setError(null); setSaved(false);
    try {
      const res = await fetch(path, {
        method: 'PUT', headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.code ?? null); return; }
      setSaved(true);
      router.refresh();
    } catch { setError('NETWORK'); }
    finally { setBusy(false); }
  }
  return { save, busy, error, saved };
}

/**
 * 요건 편집.
 *
 * 한 건씩 추가·삭제하는 API 대신 **목록 전체를 저장**합니다. 운영자가 화면에서
 * 보는 것은 '이 트랙의 요건 목록'이고, 부분 API를 두면 화면 상태와 서버
 * 상태가 어긋나는 경로가 생깁니다.
 */
export function RequirementEditor({
  trackId, initial,
}: {
  trackId: string;
  initial: TrackRequirement[];
}) {
  const { save, busy, error, saved } = useSave(`/api/tracks/${trackId}/requirements`);
  const [rows, setRows] = useState<TrackRequirement[]>(initial);

  const patch = (i: number, next: Partial<TrackRequirement>) =>
    setRows((r) => r.map((row, j) => (j === i ? { ...row, ...next } : row)));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--cl-s3)' }}>
      {rows.length === 0 && (
        <p style={{ margin: 0, color: 'var(--cl-flag)', fontSize: 'var(--cl-body)' }}>
          요건이 없습니다. 이 상태로는 트랙을 열 수 없습니다.
        </p>
      )}

      {rows.map((r, i) => (
        <div key={i} style={{ display: 'flex', gap: 'var(--cl-s3)', alignItems: 'center' }}>
          <select style={{ ...cell, width: 140 }} value={r.kind} onChange={(e) => patch(i, { kind: e.target.value })}>
            {KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
          </select>
          <input
            style={{ ...cell, width: 200, fontFamily: 'var(--cl-font-mono)' }}
            placeholder="IDENTITY · CARE_BASIC …"
            value={r.refCode ?? ''}
            onChange={(e) => patch(i, { refCode: e.target.value || null })}
          />
          <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--cl-s2)', fontSize: 'var(--cl-body)' }}>
            <input
              type="checkbox" checked={r.mandatory}
              onChange={(e) => patch(i, { mandatory: e.target.checked })}
            />
            필수
          </label>
          <input
            style={{ ...cell, flex: 1, minWidth: 160 }}
            placeholder="메모"
            value={r.note ?? ''}
            onChange={(e) => patch(i, { note: e.target.value || null })}
          />
          <Button tone="alert" onClick={() => setRows((rr) => rr.filter((_, j) => j !== i))}>삭제</Button>
        </div>
      ))}

      <div style={{ display: 'flex', gap: 'var(--cl-s3)', alignItems: 'center' }}>
        <Button
          onClick={() => setRows((r) => [...r, { kind: 'DOCUMENT', refCode: null, mandatory: true, note: null }])}
        >
          요건 추가
        </Button>
        <Button variant="filled" disabled={busy} onClick={() => save({ requirements: rows })}>
          {busy ? '저장 중' : '저장'}
        </Button>
        {saved && <span style={{ color: 'var(--cl-signal)', fontSize: 'var(--cl-caption)' }}>저장됨</span>}
        {error && <span style={{ color: 'var(--cl-alert)', fontSize: 'var(--cl-caption)' }}>{errorLabel(error)}</span>}
      </div>
    </div>
  );
}

export function WeightEditor({
  trackId, initial,
}: {
  trackId: string;
  initial: Record<string, number>;
}) {
  const { save, busy, error, saved } = useSave(`/api/tracks/${trackId}/weights`);
  const [rows, setRows] = useState(Object.entries(initial).map(([ruleCode, maxPoints]) => ({ ruleCode, maxPoints })));

  const total = rows.reduce((n, r) => n + (Number.isFinite(r.maxPoints) ? r.maxPoints : 0), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--cl-s3)' }}>
      {rows.map((r, i) => (
        <div key={i} style={{ display: 'flex', gap: 'var(--cl-s3)', alignItems: 'center' }}>
          <input
            style={{ ...cell, width: 220, fontFamily: 'var(--cl-font-mono)' }}
            placeholder="REGION · EXPERIENCE …"
            value={r.ruleCode}
            onChange={(e) => setRows((rr) => rr.map((row, j) => (j === i ? { ...row, ruleCode: e.target.value.toUpperCase() } : row)))}
          />
          <input
            style={{ ...cell, width: 90, fontFamily: 'var(--cl-font-mono)' }}
            type="number" min={0} max={100} value={r.maxPoints}
            onChange={(e) => setRows((rr) => rr.map((row, j) => (j === i ? { ...row, maxPoints: Number(e.target.value) } : row)))}
          />
          <Button tone="alert" onClick={() => setRows((rr) => rr.filter((_, j) => j !== i))}>삭제</Button>
        </div>
      ))}

      <div style={{ display: 'flex', gap: 'var(--cl-s3)', alignItems: 'center' }}>
        <Button onClick={() => setRows((r) => [...r, { ruleCode: '', maxPoints: 10 }])}>룰 추가</Button>
        <Button
          variant="filled" disabled={busy || rows.some((r) => !r.ruleCode)}
          onClick={() => save({ weights: rows })}
        >
          {busy ? '저장 중' : '저장'}
        </Button>
        {/* 합계를 보여줍니다. 100을 넘어도 막지는 않습니다 — 정규화 방식은
            매칭 엔진이 정하고, 운영자는 상대 비중을 조정합니다. */}
        <span style={{ fontSize: 'var(--cl-caption)', color: 'var(--cl-text-muted)', fontFamily: 'var(--cl-font-mono)' }}>
          합계 {total}
        </span>
        {saved && <span style={{ color: 'var(--cl-signal)', fontSize: 'var(--cl-caption)' }}>저장됨</span>}
        {error && <span style={{ color: 'var(--cl-alert)', fontSize: 'var(--cl-caption)' }}>{errorLabel(error)}</span>}
      </div>
    </div>
  );
}

export function ActiveToggle({
  trackId, isActive, requirementCount,
}: {
  trackId: string;
  isActive: boolean;
  requirementCount: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/tracks/${trackId}/active`, {
        method: 'PATCH', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ isActive: !isActive }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { setError(data.code ?? null); return; }
      router.refresh();
    } catch { setError('NETWORK'); }
    finally { setBusy(false); }
  }

  return (
    <div style={{ display: 'flex', gap: 'var(--cl-s4)', alignItems: 'center' }}>
      <Button variant="filled" disabled={busy} onClick={toggle}>
        {isActive ? '비공개로 돌리기' : '트랙 열기'}
      </Button>
      {!isActive && requirementCount === 0 && (
        <span style={{ color: 'var(--cl-flag)', fontSize: 'var(--cl-caption)' }}>
          요건을 먼저 정의해야 열 수 있습니다.
        </span>
      )}
      {error && <span style={{ color: 'var(--cl-alert)', fontSize: 'var(--cl-caption)' }}>{errorLabel(error)}</span>}
    </div>
  );
}
