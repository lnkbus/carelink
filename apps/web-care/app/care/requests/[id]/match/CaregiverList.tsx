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

      <p style={{ margin: 0, fontSize: 'var(--cf-subtitle)', color: 'var(--cl-text-muted)' }}>
        조건에 맞는 간병사{' '}
        <b className="cf-mono" style={{ color: 'var(--cl-text)' }}>{candidates.length}명</b>
      </p>

      {candidates.map((c) => (
        <div
          key={c.caregiverId}
          className="cf-card"
          style={{ borderRadius: 18, gap: 'var(--cl-s5)' }}
        >
          {/* 시안의 상단 행: 64px 원형 아바타 · 이름 · 평점 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <span
              aria-hidden="true"
              style={{
                width: 64, height: 64, borderRadius: 999, flex: 'none',
                background: 'var(--cl-action-tint)', color: 'var(--cl-action)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30,
              }}
            >
              ☺
            </span>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {/*
                시안에는 실명(`응우옌 티 흐엉`)과 국적(`베트남`)이 있습니다.
                **둘 다 넣지 않습니다** (§6-21 · §5.10, 2026-08-21 확정).
                `CaregiverCard` 타입에 필드 자체가 없어 그리려 하면 컴파일이
                실패합니다 — 게이트를 세 겹으로 둔 것은 화면이 늘어나면 어느
                한 겹은 뚫리기 때문입니다.

                보호자가 국적으로 고르기 시작하면 그것이 배정 관행이 되고,
                검증을 통과한 인력이 국적 때문에 선택받지 못합니다.
              */}
              <b className="cf-mono" style={{ fontSize: 20, fontWeight: 700 }}>{c.displayCode}</b>
              <span style={{ fontSize: 16, color: 'var(--cl-text-muted)' }}>
                경력 {c.experienceYrs}년 · 완료 {c.completedCount}건
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
              <span className="cf-mono" style={{ fontSize: 20, fontWeight: 700 }}>
                {c.ratingAvg !== null ? c.ratingAvg.toFixed(1) : '—'}
              </span>
              <span style={{ fontSize: 15, color: 'var(--cl-text-muted)' }}>
                {c.ratingAvg !== null ? `평가 ${c.completedCount}` : '평가 없음'}
              </span>
            </div>
          </div>

          {/* 자격 칩. 초록은 '검증 통과', 회색은 사실 정보입니다. */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            <Chip tone="signal">신원 확인</Chip>
            {c.experienceYrs >= 3 && <Chip tone="signal">경력 3년 이상</Chip>}
            {!c.available && <Chip tone="muted">해당 기간 일정 없음</Chip>}
          </div>

          {/*
            시안에는 `₩128,000 / 일`이 있습니다. **금액을 계산하지 않습니다.**
            4대보험·퇴직금을 반영한 청구 단가(U6)가 확정되기 전에 숫자를 띄우면
            그 숫자가 곧 약속이 됩니다 (§6-8). 자리는 두고 무엇을 기다리는지
            씁니다 — 자리를 지우면 나중에 넣을 때 레이아웃이 다시 바뀝니다.
          */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--cl-s4)' }}>
            <span style={{ fontSize: 16, color: 'var(--cl-text-muted)' }}>
              비용은 담당자가 안내합니다
            </span>
            <button
              className="cf-btn"
              style={{ width: 'auto', minHeight: 56, padding: '0 22px' }}
              disabled={busy !== null || !c.available}
              onClick={() => choose(c.caregiverId)}
            >
              {busy === c.caregiverId ? '제안하는 중…' : '선택'}
            </button>
          </div>
        </div>
      ))}

      <p style={{ margin: 0, fontSize: 'var(--cf-caption)', color: 'var(--cl-text-muted)', lineHeight: 1.6 }}>
        제안하면 간병사가 수락한 뒤 담당자가 확인합니다. 확인이 끝나야 확정됩니다.
      </p>
    </>
  );
}

/** 자격 칩 (시안: radius 8 · 16px/600 · signal tint 또는 회색). */
function Chip({ tone, children }: { tone: 'signal' | 'muted'; children: React.ReactNode }) {
  const signal = tone === 'signal';
  return (
    <span
      style={{
        background: signal ? 'var(--cl-signal-tint)' : 'var(--cl-bg-sub)',
        color: signal ? 'var(--cl-signal)' : 'var(--cl-text-sub)',
        borderRadius: 8, padding: '8px 12px', fontSize: 16, fontWeight: 600,
      }}
    >
      {children}
    </span>
  );
}
