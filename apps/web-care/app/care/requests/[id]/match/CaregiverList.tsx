'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { CaregiverCard } from '@carelink/shared-types';
import { errorLabel } from '@/lib/labels';

/**
 * 간병사 카드.
 *
 * 보여 주는 것은 **경력 · 자격(검증 통과) · 평점 · 완료 건수**뿐입니다.
 * `CaregiverCard` 타입에 국적도 실명도 없어서 여기서 그릴 수가 없습니다
 * (§6-21). 필드를 추가하고 싶어지면 "보호자가 이걸 보고 무엇을
 * 결정하는가"를 먼저 물어보세요.
 */
export function CaregiverList({
  requestId, candidates,
}: {
  requestId: string;
  candidates: CaregiverCard[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function choose(caregiverId: string) {
    setBusy(caregiverId); setError(null);
    try {
      const res = await fetch(`/api/care-requests/${requestId}/assign`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ caregiverId }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.code ?? null); return; }
      router.refresh();
    } catch { setError('NETWORK'); }
    finally { setBusy(null); }
  }

  if (candidates.length === 0) {
    return (
      <div className="cf-empty">
        지금 배정 가능한 간병사가 없습니다.
        <br />
        <span style={{ fontSize: 'var(--cf-caption)' }}>
          담당자가 계속 찾고 있습니다. 배정되면 바로 알려 드립니다.
        </span>
      </div>
    );
  }

  return (
    <>
      {error && <div className="cf-note cf-note-alert">{errorLabel(error)}</div>}

      {candidates.map((c) => (
        <div key={c.caregiverId} className="cf-card">
          <div className="cf-row">
            <b className="cf-mono" style={{ fontSize: 'var(--cf-subtitle)' }}>{c.displayCode}</b>
            <span style={{ fontSize: 'var(--cf-caption)', color: 'var(--cl-signal)' }}>✓ 검증 완료</span>
          </div>
          <div className="cf-row">
            <span className="cf-label">경력</span>
            <span className="cf-value">{c.experienceYrs}년</span>
          </div>
          <div className="cf-row">
            <span className="cf-label">평점</span>
            <span className="cf-value cf-mono">{c.ratingAvg !== null ? c.ratingAvg.toFixed(1) : '평가 없음'}</span>
          </div>
          <div className="cf-row">
            <span className="cf-label">완료한 간병</span>
            <span className="cf-value cf-mono">{c.completedCount}건</span>
          </div>
          <button
            className="cf-btn" disabled={busy !== null || !c.available}
            onClick={() => choose(c.caregiverId)}
          >
            {busy === c.caregiverId ? '제안하는 중…' : '이 분에게 제안하기'}
          </button>
        </div>
      ))}

      <p style={{ margin: 0, fontSize: 'var(--cf-caption)', color: 'var(--cl-text-muted)', lineHeight: 1.6 }}>
        제안하면 간병사가 수락한 뒤 담당자가 확인합니다. 확인이 끝나야 확정됩니다.
      </p>
    </>
  );
}
