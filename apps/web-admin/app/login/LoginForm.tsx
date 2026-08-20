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

  async function send() {
    setBusy(true); setError(null);
    try {
      const res = await fetch(`${base}/auth/otp/send`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.code ?? 'COMMON_INTERNAL_ERROR'); return; }
      setSent(true);
      // 개발 환경에서만 내려오는 값. 운영에서는 null이라 화면에 아무것도 뜨지 않는다.
      setDevCode(data.devCode ?? null);
    } finally { setBusy(false); }
  }

  async function verify() {
    setBusy(true); setError(null);
    try {
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
      if (!res.ok) { setError(data.code ?? 'COMMON_INTERNAL_ERROR'); return; }
      router.push('/');
      router.refresh();
    } finally { setBusy(false); }
  }

  const field: React.CSSProperties = {
    width: '100%', height: 64, padding: '0 var(--cl-s5)',
    border: '1px solid var(--cl-line-strong)', borderRadius: 'var(--cl-r-desk)',
    fontSize: 16, fontFamily: 'var(--cl-font-mono)',
  };
  const button = (primary: boolean): React.CSSProperties => ({
    width: '100%', height: 64, marginTop: 'var(--cl-s5)', borderRadius: 'var(--cl-r-desk)',
    border: primary ? 'none' : '1px solid var(--cl-line-strong)',
    background: primary ? 'var(--cl-action-strong)' : 'var(--cl-bg)',
    color: primary ? '#fff' : 'var(--cl-text-sub)', fontSize: 16, fontWeight: 700,
  });

  return (
    <div>
      <label style={{ display: 'block', fontSize: 'var(--cl-caption)', color: 'var(--cl-text-sub)', marginBottom: 'var(--cl-s2)' }}>
        휴대전화 번호
      </label>
      <input
        style={field}
        inputMode="numeric"
        placeholder="01012345678"
        value={phone}
        onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, ''))}
        disabled={sent}
      />

      {sent && (
        <>
          <label style={{ display: 'block', fontSize: 'var(--cl-caption)', color: 'var(--cl-text-sub)', margin: 'var(--cl-s5) 0 var(--cl-s2)' }}>
            인증번호
          </label>
          <input
            style={field}
            inputMode="numeric"
            placeholder="000000"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, ''))}
          />
          {devCode && (
            <p style={{ margin: 'var(--cl-s2) 0 0', fontSize: 'var(--cl-caption)', color: 'var(--cl-flag)' }}>
              개발 환경 인증번호: <span style={{ fontFamily: 'var(--cl-font-mono)' }}>{devCode}</span>
            </p>
          )}
        </>
      )}

      {error && (
        <p style={{ margin: 'var(--cl-s4) 0 0', fontSize: 'var(--cl-caption)', color: 'var(--cl-alert)' }}>
          {errorLabel(error)}
        </p>
      )}

      <button
        style={button(true)}
        disabled={busy || (sent ? code.length < 4 : phone.length < 9)}
        onClick={sent ? verify : send}
      >
        {sent ? '로그인' : '인증번호 받기'}
      </button>

      {sent && (
        <button style={button(false)} onClick={() => { setSent(false); setCode(''); setDevCode(null); }}>
          번호 다시 입력
        </button>
      )}
    </div>
  );
}
