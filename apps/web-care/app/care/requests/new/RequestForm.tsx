'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { CareRequest, CareServiceItem } from '@carelink/shared-types';
import { errorLabel } from '@/lib/labels';

/**
 * 교대 패턴.
 *
 * **기본값은 3교대입니다** (§5.12). 24시간 상주는 고를 수는 있지만 담당자
 * 승인 대상이고, 화면에서도 그렇게 적습니다 — 고르고 나서 "왜 진행이 안
 * 되냐"는 문의가 나오지 않게 하려면 고르는 시점에 말해야 합니다.
 */
const SHIFTS = [
  { code: 'H8_3SHIFT', label: '8시간 3교대', note: '권장' },
  { code: 'H12_2SHIFT', label: '12시간 2교대', note: '' },
  { code: 'H24_LIVE_IN', label: '24시간 상주', note: '담당자 확인 후 진행' },
];

const MOBILITY = [
  { code: 'INDEPENDENT', label: '스스로 가능' },
  { code: 'PARTIAL_ASSIST', label: '부분 도움' },
  { code: 'FULL_ASSIST', label: '전적인 도움' },
];

/**
 * `datetime-local`이 주는 값에는 시간대가 없습니다.
 *
 * `new Date('2026-09-12T09:00')`은 **브라우저의 시간대**로 해석합니다. 화면은
 * 항상 KST로 그리는데 입력만 기기 시간대로 읽으면, 시차가 있는 기기에서
 * 09:00을 넣고 18:00으로 확인받게 됩니다. 실제로 그렇게 나왔습니다.
 *
 * 보호자가 입력하는 시각은 언제나 **병원 벽시계**입니다. 그래서 KST로
 * 못 박습니다 — 기기 설정에 맡기지 않습니다.
 */
function kstToIso(local: string): string {
  return new Date(`${local}:00+09:00`).toISOString();
}

export function RequestForm({
  catalog, hospitalId, hospitalName,
}: {
  catalog: CareServiceItem[];
  hospitalId: string;
  hospitalName: string;
}) {
  const router = useRouter();
  const [ward, setWard] = useState('');
  const [startAt, setStartAt] = useState('');
  const [shift, setShift] = useState('H8_3SHIFT');
  const [mobility, setMobility] = useState('PARTIAL_ASSIST');
  const [items, setItems] = useState<string[]>([]);
  const [cautions, setCautions] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const toggle = (code: string) =>
    setItems((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));

  async function submit() {
    setBusy(true); setError(null);
    try {
      const res = await fetch('/api/care-requests', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          hospitalId, ward: ward || null,
          serviceType: shift === 'H24_LIVE_IN' ? 'H24' : 'DAY',
          shiftPatternCode: shift,
          startAt: kstToIso(startAt),
          supportItems: items,
          mobilityLevel: mobility,
          cautions: cautions || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.code ?? null); return; }
      const created = data as CareRequest;
      // 업무범위 검토로 넘어간 요청은 매칭 화면으로 보내지 않습니다 —
      // 고를 수 있는 것이 없는 화면을 여는 셈입니다.
      router.push(
        created.status === 'OPS_REVIEW'
          ? `/care/requests/${created.id}/confirm`
          : `/care/requests/${created.id}/match`,
      );
    } catch { setError('NETWORK'); }
    finally { setBusy(false); }
  }

  const ready = hospitalId && startAt;

  return (
    <>
      <div className="cf-card">
        <h2>{hospitalName || '선택한 병원'}</h2>
        <div className="cf-field">
          <label htmlFor="ward">병실</label>
          <input id="ward" className="cf-input" value={ward} onChange={(e) => setWard(e.target.value)} placeholder="예: 703호" />
        </div>
        <div className="cf-field">
          <label htmlFor="start">간병 시작</label>
          <input id="start" className="cf-input cf-mono" type="datetime-local" value={startAt} onChange={(e) => setStartAt(e.target.value)} />
        </div>
      </div>

      <div className="cf-card">
        <h2>교대 방식</h2>
        {SHIFTS.map((s) => (
          <button
            key={s.code} className="cf-tile" aria-pressed={shift === s.code}
            style={{ width: '100%' }} onClick={() => setShift(s.code)}
          >
            <span>{s.label}</span>
            {s.note && (
              <span style={{ marginLeft: 'auto', fontSize: 'var(--cf-caption)', color: 'var(--cl-text-muted)' }}>
                {s.note}
              </span>
            )}
          </button>
        ))}
        {shift === 'H24_LIVE_IN' && (
          <div className="cf-note">
            24시간 상주는 담당자가 확인한 뒤 진행됩니다. 간병사가 잠을 자지 못하는
            근무라 기본으로 권하지 않습니다 — 3교대로도 같은 시간을 채울 수 있습니다.
          </div>
        )}
      </div>

      <div className="cf-card">
        <h2>거동 정도</h2>
        <div className="cf-tiles">
          {MOBILITY.map((m) => (
            <button key={m.code} className="cf-tile" aria-pressed={mobility === m.code} onClick={() => setMobility(m.code)}>
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="cf-card">
        <h2>필요한 도움</h2>
        {/* 목록은 서버 카탈로그입니다. 화면에 상수 배열을 두면 그 배열이
            곧 카탈로그가 되고, 의료행위가 거기로 들어옵니다 (§6-2). */}
        <div className="cf-tiles">
          {catalog.map((c) => (
            <button key={c.code} className="cf-tile" aria-pressed={items.includes(c.code)} onClick={() => toggle(c.code)}>
              {c.labelKo}
            </button>
          ))}
        </div>
      </div>

      <div className="cf-card">
        <h2>특이사항</h2>
        <div className="cf-field">
          <textarea
            className="cf-textarea" value={cautions} onChange={(e) => setCautions(e.target.value)}
            placeholder="간병사가 알아야 할 내용을 적어 주세요."
          />
        </div>
        <span style={{ fontSize: 'var(--cf-caption)', color: 'var(--cl-text-muted)', lineHeight: 1.5 }}>
          투약·주사·상처 처치 같은 의료행위는 간병사가 할 수 없습니다.
          간호사에게 요청해 주세요.
        </span>
      </div>

      {error && <div className="cf-note cf-note-alert">{errorLabel(error)}</div>}

      <button className="cf-btn" onClick={submit} disabled={busy || !ready}>
        {busy ? '접수하는 중…' : '신청하기'}
      </button>
    </>
  );
}
