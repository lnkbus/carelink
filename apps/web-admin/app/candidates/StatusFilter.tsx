'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { label } from '@/lib/labels';

/**
 * 상태 칩 필터.
 *
 * 검색어는 display_code와 이름에만 걸립니다 — 전화번호 부분 일치 검색을 열면
 * 연락처를 역으로 훑는 경로가 됩니다 (docs/11 §5).
 */
export function StatusFilter({
  statuses, current, q,
}: {
  statuses: string[];
  current?: string;
  q?: string;
}) {
  const router = useRouter();
  const params = useSearchParams();

  function go(next: Record<string, string | undefined>) {
    const sp = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v === undefined || v === '') sp.delete(k);
      else sp.set(k, v);
    }
    sp.delete('page');
    router.push(`/candidates?${sp.toString()}`);
  }

  const chip = (active: boolean): React.CSSProperties => ({
    height: 'var(--cl-tap-desk)', padding: '0 var(--cl-s4)', borderRadius: 'var(--cl-r-pill)',
    border: `1px solid ${active ? 'var(--cl-action)' : 'var(--cl-line)'}`,
    background: active ? 'var(--cl-action-tint)' : 'var(--cl-bg)',
    color: active ? 'var(--cl-action-text)' : 'var(--cl-text-sub)',
    fontSize: 'var(--cl-caption)', fontWeight: active ? 600 : 400,
  });

  return (
    <div style={{ display: 'flex', gap: 'var(--cl-s2)', alignItems: 'center', flexWrap: 'wrap' }}>
      <input
        defaultValue={q ?? ''}
        placeholder="ID 또는 이름"
        onKeyDown={(e) => { if (e.key === 'Enter') go({ q: (e.target as HTMLInputElement).value }); }}
        style={{
          height: 'var(--cl-tap-desk)', width: 180, padding: '0 var(--cl-s4)',
          border: '1px solid var(--cl-line-strong)', borderRadius: 'var(--cl-r-desk)',
          fontSize: 'var(--cl-caption)',
        }}
      />
      <button style={chip(!current)} onClick={() => go({ status: undefined })}>전체</button>
      {statuses.map((s) => (
        <button key={s} style={chip(current === s)} onClick={() => go({ status: s })}>
          {label(s)}
        </button>
      ))}
    </div>
  );
}
