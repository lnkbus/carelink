'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@carelink/ui';
import type { Industry } from '@carelink/shared-types';
import { errorLabel } from '@/lib/labels-admin';

/**
 * 산업·트랙 생성.
 *
 * 둘 다 **비활성으로** 만들어집니다. 만드는 것과 여는 것은 다른 결정입니다 —
 * 요건이 갖춰지기 전에 열면 후보자가 아무것도 할 수 없는 트랙에 지원합니다.
 */
function useCreate(path: string) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(body: unknown): Promise<boolean> {
    setBusy(true); setError(null);
    try {
      const res = await fetch(path, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.code ?? null); return false; }
      router.refresh();
      return true;
    } catch { setError('NETWORK'); return false; }
    finally { setBusy(false); }
  }
  return { send, busy, error };
}

const input: React.CSSProperties = {
  height: 'var(--cl-tap-desk)', padding: '0 var(--cl-s4)',
  border: '1px solid var(--cl-line-strong)', borderRadius: 'var(--cl-r-desk)',
  fontSize: 'var(--cl-body)', fontFamily: 'inherit',
};

export function NewIndustry() {
  const { send, busy, error } = useCreate('/api/tracks/industries');
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [labelKo, setLabelKo] = useState('');

  if (!open) return <Button onClick={() => setOpen(true)}>산업 추가</Button>;

  return (
    <div style={{ display: 'flex', gap: 'var(--cl-s3)', alignItems: 'center' }}>
      <input
        style={{ ...input, width: 140, fontFamily: 'var(--cl-font-mono)' }}
        placeholder="AGRICULTURE" value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''))}
      />
      <input
        style={{ ...input, width: 140 }} placeholder="농업"
        value={labelKo} onChange={(e) => setLabelKo(e.target.value)}
      />
      <Button
        disabled={busy || code.length < 2 || !labelKo}
        onClick={async () => {
          if (await send({ code, labelKo })) { setOpen(false); setCode(''); setLabelKo(''); }
        }}
      >
        {busy ? '만드는 중' : '만들기'}
      </Button>
      <Button variant="ghost" onClick={() => setOpen(false)}>취소</Button>
      {error && <span style={{ color: 'var(--cl-alert)', fontSize: 'var(--cl-caption)' }}>{errorLabel(error)}</span>}
    </div>
  );
}

const QUALIFICATIONS = [
  { value: 'NONE', label: '무자격 진입 가능' },
  { value: 'TRAINING_REQUIRED', label: '교육 이수 필요' },
  { value: 'NATIONAL_LICENSE', label: '국가자격 · 면허 필요' },
];

export function NewTrack({ industries }: { industries: Industry[] }) {
  const { send, busy, error } = useCreate('/api/tracks');
  const [open, setOpen] = useState(false);
  const [industryId, setIndustryId] = useState(industries[0]?.id ?? '');
  const [code, setCode] = useState('');
  const [labelKo, setLabelKo] = useState('');
  const [qualificationType, setQualificationType] = useState('TRAINING_REQUIRED');

  if (!open) {
    return <Button disabled={industries.length === 0} onClick={() => setOpen(true)}>트랙 추가</Button>;
  }

  return (
    <div style={{ display: 'flex', gap: 'var(--cl-s3)', alignItems: 'center', flexWrap: 'wrap' }}>
      <select style={{ ...input, width: 160 }} value={industryId} onChange={(e) => setIndustryId(e.target.value)}>
        {industries.map((i) => <option key={i.id} value={i.id}>{i.labelKo}</option>)}
      </select>
      <input
        style={{ ...input, width: 180, fontFamily: 'var(--cl-font-mono)' }}
        placeholder="FARM_WORKER" value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, ''))}
      />
      <input
        style={{ ...input, width: 140 }} placeholder="농작업"
        value={labelKo} onChange={(e) => setLabelKo(e.target.value)}
      />
      <select
        style={{ ...input, width: 180 }} value={qualificationType}
        onChange={(e) => setQualificationType(e.target.value)}
      >
        {QUALIFICATIONS.map((q) => <option key={q.value} value={q.value}>{q.label}</option>)}
      </select>
      <Button
        disabled={busy || !industryId || code.length < 2 || !labelKo}
        onClick={async () => {
          if (await send({ industryId, code, labelKo, qualificationType })) {
            setOpen(false); setCode(''); setLabelKo('');
          }
        }}
      >
        {busy ? '만드는 중' : '만들기'}
      </Button>
      <Button variant="ghost" onClick={() => setOpen(false)}>취소</Button>
      {error && <span style={{ color: 'var(--cl-alert)', fontSize: 'var(--cl-caption)' }}>{errorLabel(error)}</span>}
    </div>
  );
}
