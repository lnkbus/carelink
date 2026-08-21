'use client';
import { useState } from 'react';
import type { ScopeScanResult } from '@carelink/shared-types';
import { Button, StatusPill } from '@carelink/ui';
import { label } from '@/lib/labels-admin';

/**
 * 자유 입력 스캔 미리보기.
 *
 * 결과에 '차단' 버튼이 없는 것이 의도입니다 — 감지되면 OPS_REVIEW로 보내
 * 사람이 보호자에게 "그건 의료행위라 할 수 없습니다"를 설명하게 합니다 (§6-15).
 */
export function ScopeScanBox() {
  const [text, setText] = useState('');
  const [result, setResult] = useState<ScopeScanResult | null>(null);
  const [busy, setBusy] = useState(false);

  async function scan() {
    setBusy(true);
    try {
      const res = await fetch('/api/scope-scan', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      setResult(await res.json());
    } finally { setBusy(false); }
  }

  return (
    <div>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="보호자가 적은 요청 문구를 붙여 넣어 확인합니다"
        rows={3}
        style={{
          width: '100%', padding: 'var(--cl-s4)', fontFamily: 'inherit', fontSize: 'var(--cl-body)',
          border: '1px solid var(--cl-line-strong)', borderRadius: 'var(--cl-r-desk)', resize: 'vertical',
        }}
      />
      <div style={{ marginTop: 'var(--cl-s3)', display: 'flex', gap: 'var(--cl-s3)', alignItems: 'center' }}>
        <Button variant="filled" onClick={scan} disabled={busy || text.trim().length === 0}>검사</Button>
        {result && (
          <StatusPill
            tone={result.clean ? 'signal' : 'flag'}
            label={result.clean ? '통과' : '운영자 검토 필요 (OPS_REVIEW)'}
          />
        )}
      </div>

      {result && !result.clean && (
        <div
          style={{
            marginTop: 'var(--cl-s4)', padding: 'var(--cl-s4)',
            background: 'var(--cl-flag-tint)', border: '1px solid var(--cl-flag-line)',
            borderRadius: 'var(--cl-r-desk)', color: 'var(--cl-flag)', fontSize: 'var(--cl-caption)',
          }}
        >
          <strong style={{ display: 'block', marginBottom: 'var(--cl-s2)' }}>
            감지 {result.hits.length}건 — 자동 거절하지 않고 검토 큐로 보냅니다
          </strong>
          <ul style={{ margin: 0, paddingLeft: 'var(--cl-s6)' }}>
            {result.hits.map((h, i) => (
              <li key={`${h.keyword}-${i}`}>
                <span style={{ fontFamily: 'var(--cl-font-mono)' }}>{h.keyword}</span> — {label(h.category)}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
