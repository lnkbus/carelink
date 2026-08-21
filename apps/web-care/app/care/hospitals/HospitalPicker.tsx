'use client';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import type { CareHospital } from '@carelink/shared-types';

export function HospitalPicker({ hospitals }: { hospitals: CareHospital[] }) {
  const router = useRouter();
  const [q, setQ] = useState('');

  const shown = useMemo(() => {
    const t = q.trim();
    if (!t) return hospitals;
    return hospitals.filter((h) => h.name.includes(t) || (h.region ?? '').includes(t));
  }, [q, hospitals]);

  return (
    <>
      {/* 검색은 라벨 없이 64px 한 줄입니다 — 위의 질문 문장이 이미 라벨입니다. */}
      <input
        aria-label="병원 이름 또는 지역"
        className="cf-input"
        style={{ minHeight: 'var(--cf-action)', fontSize: 'var(--cf-subtitle)', fontWeight: 600 }}
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="병원 이름 또는 지역"
        autoComplete="off"
      />

      {shown.length === 0 && (
        <div className="cf-empty">
          &lsquo;{q}&rsquo;에 해당하는 병원이 없습니다.
          <br />
          <span style={{ fontSize: 'var(--cf-caption)' }}>지금은 제휴 병원만 신청할 수 있습니다.</span>
        </div>
      )}

      {shown.map((h) => (
        <button
          key={h.id}
          type="button"
          className="cf-pick"
          onClick={() => router.push(`/care/requests/new?hospitalId=${h.id}&name=${encodeURIComponent(h.name)}`)}
        >
          <span className="cf-pick-tile" aria-hidden="true">🏥</span>
          <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
            <span className="cf-pick-name">{h.name}</span>
            {/* 색이 아니라 문장으로 씁니다. 숫자만 있으면 무슨 뜻인지 모릅니다. */}
            <span className="cf-pick-sub">
              {h.region ? `${h.region} · ` : ''}배정 가능한 간병사 {h.activeCaregivers}명
            </span>
          </span>
          <span aria-hidden="true" style={{ color: 'var(--cl-text-muted)', fontSize: 22 }}>›</span>
        </button>
      ))}
    </>
  );
}
