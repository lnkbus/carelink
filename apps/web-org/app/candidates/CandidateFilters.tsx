'use client';
import { useRouter, useSearchParams } from 'next/navigation';

interface Track { id: string; code: string; labelKo: string }

/**
 * 좌측 필터 패널 260px (design/README §Organization Web SCR-203).
 *
 * 국적 필터가 없습니다. 거르는 것은 국적이 아니라 검증되지 않은 인력입니다 (§5.10).
 * 한국어 수준은 간병 업무의 본질이 의사소통이므로 정당한 기준이지만,
 * 후보자별 어학 등급은 상세에서 보고 목록 필터로는 두지 않았습니다 —
 * 목록 단계에서 걸러 버리면 근거를 보지 않고 배제하게 됩니다.
 */
export function CandidateFilters({
  tracks, current, total,
}: {
  tracks: Track[];
  current: { trackId?: string; region?: string; status?: string };
  total: number;
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

  const box: React.CSSProperties = {
    border: '1px solid var(--cl-line)', borderRadius: 'var(--cl-r-desk)',
    padding: 'var(--cl-s5)',
  };
  const lbl: React.CSSProperties = {
    display: 'block', fontSize: 'var(--cl-caption)', color: 'var(--cl-text-sub)',
    marginBottom: 'var(--cl-s2)',
  };
  const field: React.CSSProperties = {
    width: '100%', height: 'var(--cl-tap-desk)', padding: '0 var(--cl-s3)',
    border: '1px solid var(--cl-line-strong)', borderRadius: 'var(--cl-r-desk)',
    fontSize: 'var(--cl-body)', fontFamily: 'inherit',
  };

  return (
    <aside style={box}>
      <div style={{ fontSize: 'var(--cl-caption)', color: 'var(--cl-text-muted)', marginBottom: 'var(--cl-s5)' }}>
        조건에 맞는 후보 <span style={{ fontFamily: 'var(--cl-font-mono)', color: 'var(--cl-text)' }}>{total}</span>명
      </div>

      <div style={{ marginBottom: 'var(--cl-s5)' }}>
        <label style={lbl}>트랙</label>
        <select style={field} value={current.trackId ?? ''} onChange={(e) => go({ trackId: e.target.value })}>
          <option value="">전체</option>
          {tracks.map((t) => <option key={t.id} value={t.id}>{t.labelKo}</option>)}
        </select>
      </div>

      <div style={{ marginBottom: 'var(--cl-s5)' }}>
        <label style={lbl}>희망 지역</label>
        <input
          style={field}
          defaultValue={current.region ?? ''}
          placeholder="경기 안산시"
          onKeyDown={(e) => { if (e.key === 'Enter') go({ region: (e.target as HTMLInputElement).value }); }}
        />
      </div>

      <div style={{ marginBottom: 'var(--cl-s5)' }}>
        <label style={lbl}>후보자 상태</label>
        <select style={field} value={current.status ?? ''} onChange={(e) => go({ status: e.target.value })}>
          <option value="">전체</option>
          <option value="READY">배치 준비</option>
          <option value="TRAINING">교육 중</option>
          <option value="DOC_REVIEW">서류 검토</option>
        </select>
      </div>

      <button
        onClick={() => router.push('/candidates')}
        style={{
          width: '100%', height: 'var(--cl-tap-desk)', borderRadius: 'var(--cl-r-desk)',
          border: '1px solid var(--cl-line-strong)', background: 'var(--cl-bg)',
          color: 'var(--cl-text-sub)', fontSize: 'var(--cl-caption)',
        }}
      >
        조건 초기화
      </button>

      <p
        style={{
          margin: 'var(--cl-s5) 0 0', fontSize: 'var(--cl-micro)',
          color: 'var(--cl-text-muted)', lineHeight: 1.7,
        }}
      >
        국적으로는 거를 수 없습니다. 검증 상태와 한국어 수준이 판단 기준입니다.
      </p>
    </aside>
  );
}
