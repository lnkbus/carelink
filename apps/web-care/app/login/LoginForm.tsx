'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { errorLabel } from '@/lib/labels';

export function LoginForm() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:3000/api/v1';

  // 네트워크 실패까지 잡습니다. ApiException만 잡으면 CORS 차단·연결 실패가
  // 그대로 올라가 화면이 백지가 됩니다 (F-09와 같은 사고).
  async function guard(fn: () => Promise<void>) {
    setBusy(true); setError(null);
    try { await fn(); }
    catch { setError('NETWORK'); }
    finally { setBusy(false); }
  }

  const send = () => guard(async () => {
    const res = await fetch(`${base}/auth/otp/send`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ phone }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.code ?? null); return; }
    setSent(true);
    // 개발 환경에서만 내려옵니다. 운영에서는 null이라 아무것도 뜨지 않습니다.
    setDevCode(data.devCode ?? null);
  });

  const verify = () => guard(async () => {
    const res = await fetch('/api/session', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        phone, code,
        consents: [
          { code: 'TOS', version: 'v1', agreed: true },
          { code: 'PRIVACY', version: 'v1', agreed: true },
        ],
      }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.code ?? null); return; }
    router.push('/care');
    router.refresh();
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--cl-s5)' }}>
      <div className="cf-field">
        <label htmlFor="phone">휴대폰 번호</label>
        <input
          id="phone" className="cf-input cf-mono" inputMode="numeric" autoComplete="tel"
          placeholder="01012345678" value={phone}
          onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
          disabled={sent}
        />
      </div>

      {sent && (
        <div className="cf-field">
          <label htmlFor="code">인증번호</label>
          <input
            id="code" className="cf-input cf-mono" inputMode="numeric" autoComplete="one-time-code"
            placeholder="6자리" value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
          />
          {devCode && (
            <span style={{ fontSize: 'var(--cf-caption)', color: 'var(--cl-text-muted)' }}>
              개발 환경 인증번호: <b className="cf-mono">{devCode}</b>
            </span>
          )}
        </div>
      )}

      {error && <div className="cf-note cf-note-alert">{errorLabel(error)}</div>}

      <button className="cf-btn" onClick={sent ? verify : send} disabled={busy || (sent ? code.length < 4 : phone.length < 10)}>
        {busy ? '잠시만요…' : sent ? '확인' : '인증번호 받기'}
      </button>

      {sent && (
        <button className="cf-btn cf-btn-ghost" onClick={() => { setSent(false); setCode(''); setError(null); }}>
          번호 다시 입력
        </button>
      )}
    </div>
  );
}
