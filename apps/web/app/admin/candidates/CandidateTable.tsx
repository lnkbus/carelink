'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { BulkResult, Candidate } from '@carelink/shared-types';
import { DataTable, ExpiryCountdown, StatusPill, Td, Tr } from '@carelink/ui';
import { label } from '@/lib/labels-admin';

const STATUS_TONE: Record<string, 'signal' | 'flag' | 'alert' | 'neutral'> = {
  READY: 'signal', PLACED: 'signal', MATCHED: 'signal',
  DOC_REVIEW: 'flag', TRAINING: 'flag',
  SUSPENDED: 'alert', INACTIVE: 'neutral', DRAFT: 'neutral',
};

/**
 * SCR-502 후보자 표 + **일괄 처리 바**.
 *
 * 일괄 처리가 이 화면의 핵심입니다 (SCR-502 notes). 100명 단위로 파이프라인을
 * 밀지 못하면 실무에서 쓰이지 않습니다 — 한 명씩 상태를 바꾸는 콘솔은
 * 운영자가 엑셀을 따로 쓰게 만들고, 그 순간 시스템 밖에 진실이 하나 더
 * 생깁니다.
 *
 * `POST /admin/candidates/bulk`는 처음부터 있었는데 **화면에 선택 수단이
 * 없어서 부를 방법이 없었습니다.**
 *
 * 표를 클라이언트 컴포넌트로 내린 이유: 체크박스와 일괄 바가 같은 선택
 * 상태를 봐야 합니다. 서버에서 표를 그리고 바만 클라이언트로 두면 둘을
 * 잇는 길이 없습니다.
 */
export function CandidateTable({ items }: { items: Candidate[] }) {
  const router = useRouter();
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<BulkResult | null>(null);

  const allPicked = items.length > 0 && picked.size === items.length;

  function toggle(id: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function run(operation: 'STATUS' | 'TAG', payload: Record<string, string>) {
    setBusy(true); setResult(null);
    try {
      const res = await fetch('/api/admin/bulk', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ candidateIds: [...picked], operation, ...payload }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult(data as BulkResult);
        setPicked(new Set());
        router.refresh();
      } else {
        setResult({ requested: picked.size, succeeded: 0, failures: [{ candidateId: '', code: data.code ?? 'COMMON_INTERNAL_ERROR' }] });
      }
    } catch {
      setResult({ requested: picked.size, succeeded: 0, failures: [{ candidateId: '', code: 'NETWORK' }] });
    } finally { setBusy(false); }
  }

  return (
    <>
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 'var(--cl-s4)',
          padding: 'var(--cl-s3) var(--cl-s4)', minHeight: 48,
          background: picked.size > 0 ? 'var(--cl-action-tint)' : 'transparent',
          borderBottom: '1px solid var(--cl-line)',
        }}
      >
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--cl-caption)', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={allPicked}
            onChange={() => setPicked(allPicked ? new Set() : new Set(items.map((c) => c.id)))}
            style={{ width: 16, height: 16 }}
          />
          전체
        </label>

        {picked.size === 0 ? (
          <span style={{ fontSize: 'var(--cl-caption)', color: 'var(--cl-text-muted)' }}>
            행을 선택하면 일괄 작업이 열립니다
          </span>
        ) : (
          <>
            <b style={{ fontSize: 'var(--cl-caption)', color: 'var(--cl-action-text)' }}>{picked.size}명 선택</b>
            <span style={{ flex: 1 }} />
            {/*
              상태 변경과 태그만 엽니다. 시안에는 '서류 요청 발송'·'코호트
              이동'·'차단 해제 요청'도 있는데:
                · 앞의 둘은 알림 발송·코호트 이동 API가 아직 없습니다
                · 마지막은 **만들면 안 되는 경로**입니다. 클리어런스는
                  운영자가 예외 처리할 수 없습니다 (§5.11) — 예외 버튼을
                  만들면 그 경로가 곧 기본값이 됩니다
              docs/17에 결정 대기로 남겼습니다.
            */}
            <Bulk busy={busy} onClick={() => run('STATUS', { status: 'READY' })}>배치 준비로</Bulk>
            <Bulk busy={busy} onClick={() => run('STATUS', { status: 'DOC_REVIEW' })}>서류 검토로</Bulk>
            <Bulk busy={busy} onClick={() => run('TAG', { tag: 'FOLLOW_UP' })}>후속 확인 표시</Bulk>
          </>
        )}
      </div>

      {result && (
        <div
          style={{
            padding: 'var(--cl-s4) var(--cl-s5)',
            background: result.failures.length ? 'var(--cl-alert-tint)' : 'var(--cl-signal-tint)',
            color: result.failures.length ? 'var(--cl-alert)' : 'var(--cl-signal)',
            fontSize: 'var(--cl-caption)', lineHeight: 1.7,
          }}
        >
          <b>{result.requested}건 중 {result.succeeded}건 처리</b>
          {/* 실패를 건별로 보여 줍니다. "3건 실패"라고만 하면 어느 3건인지
              찾으러 표를 다시 훑어야 합니다. */}
          {result.failures.length > 0 && (
            <ul style={{ margin: 'var(--cl-s2) 0 0', paddingLeft: 'var(--cl-s6)' }}>
              {result.failures.map((f, i) => (
                <li key={`${f.candidateId}-${i}`}>
                  <span style={{ fontFamily: 'var(--cl-font-mono)' }}>{f.candidateId.slice(0, 8) || '—'}</span>
                  {' · '}{label(f.code)}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <DataTable
        columns={[
          { key: 'pick', label: '', width: 40 },
          { key: 'code', label: 'ID', width: 110 },
          { key: 'name', label: '이름', width: 120 },
          { key: 'track', label: '트랙' },
          { key: 'status', label: '상태', width: 110 },
          { key: 'location', label: '지역', width: 120 },
          { key: 'nationality', label: '국적', width: 90 },
          { key: 'visa', label: '체류자격', width: 160 },
          { key: 'available', label: '근무 가능', width: 110 },
        ]}
        empty="조건에 맞는 후보자가 없습니다"
      >
        {items.map((c) => {
          const days = c.visaExpiresInDays ?? null;
          const urgent = days !== null && days <= 30;
          return (
            <Tr key={c.id} tone={urgent ? 'alert' : undefined}>
              <Td>
                <input
                  type="checkbox"
                  aria-label={`${c.displayCode} 선택`}
                  checked={picked.has(c.id)}
                  onChange={() => toggle(c.id)}
                  style={{ width: 16, height: 16 }}
                />
              </Td>
              <Td mono>{c.displayCode}</Td>
              <Td>{c.name ?? '—'}</Td>
              <Td>
                {c.tracks.length === 0
                  ? <span style={{ color: 'var(--cl-text-disabled)' }}>미선택</span>
                  : c.tracks.map((t) => t.labelKo).join(' · ')}
              </Td>
              <Td><StatusPill tone={STATUS_TONE[c.status] ?? 'neutral'} label={label(c.status)} /></Td>
              <Td>{c.currentLocation ?? '—'}</Td>
              {/*
                국적은 **운영자에게만** 나갑니다. 행정·통계 목적이고,
                기관 화면에는 어느 단계에서도 나오지 않습니다 (§5.10 · §6-13).
                시안에는 국적 **필터**도 있지만 넣지 않았습니다 — 필터는
                선별 도구이고, 국적으로 거르는 순간 그것이 배정 관행이 됩니다.
                docs/17 D-1에 결정 대기로 남겼습니다.
              */}
              <Td tone="muted">{c.nationality ?? '—'}</Td>
              <Td>
                {c.visaStatusCode
                  ? (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--cl-s2)' }}>
                      <span style={{ fontFamily: 'var(--cl-font-mono)' }}>{c.visaStatusCode}</span>
                      <ExpiryCountdown days={days} date={c.visaExpiresOn ?? null} compact />
                    </span>
                  )
                  : <span style={{ color: 'var(--cl-text-disabled)' }}>미확인</span>}
              </Td>
              <Td mono tone="muted">{c.availableFrom ?? '—'}</Td>
            </Tr>
          );
        })}
      </DataTable>
    </>
  );
}

function Bulk({ busy, onClick, children }: { busy: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      disabled={busy}
      onClick={onClick}
      style={{
        minHeight: 32, padding: '0 12px', borderRadius: 'var(--cl-r-desk)',
        border: '1px solid var(--cl-action)', background: 'var(--cl-bg)',
        color: 'var(--cl-action-text)', fontSize: 'var(--cl-caption)',
        fontWeight: 600, cursor: busy ? 'default' : 'pointer',
      }}
    >
      {children}
    </button>
  );
}
