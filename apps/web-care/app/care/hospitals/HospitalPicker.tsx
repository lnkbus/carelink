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
      <div className="cf-field">
        <label htmlFor="q">병원 이름 또는 지역</label>
        <input
          id="q" className="cf-input" value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="예: 서울, ○○병원" autoComplete="off"
        />
      </div>

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
          className="cf-card"
          style={{ textAlign: 'left', background: 'var(--cl-bg)', cursor: 'pointer', minHeight: 'var(--cf-tap)' }}
          onClick={() => router.push(`/care/requests/new?hospitalId=${h.id}&name=${encodeURIComponent(h.name)}`)}
        >
          <div className="cf-row">
            <b style={{ fontSize: 'var(--cf-subtitle)' }}>{h.name}</b>
            <span style={{ color: 'var(--cl-text-muted)', fontSize: 'var(--cf-caption)' }}>{h.region ?? ''}</span>
          </div>
          {/* 색이 아니라 문장으로 씁니다. 숫자만 있으면 무슨 뜻인지 모릅니다. */}
          <span style={{ fontSize: 'var(--cf-caption)', color: 'var(--cl-text-sub)' }}>
            배정 가능한 간병사 {h.activeCaregivers}명
          </span>
        </button>
      ))}
    </>
  );
}
