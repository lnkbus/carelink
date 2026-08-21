'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { PhoneInput } from '@carelink/ui';
import { errorLabel } from '@/lib/labels-admin';

export function LoginForm() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  // 국가번호. 해외 거주 후보자가 여기를 바꿉니다 (docs/08 E·F 세그먼트).
  const [dial, setDial] = useState('+82');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const base = process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:3000/api/v1';

  /**
   * 국가번호 + 숫자. 국내 번호의 앞 0은 뗍니다 —
   * `+82 010…`은 존재하지 않는 번호입니다. 최종 정규화는 서버가 합니다.
   */
  const e164 = () => `${dial}${phone.replace(/^0/, '')}`;

  async function send() {
    setBusy(true); setError(null);
    try {
      const res = await fetch(`${base}/auth/otp/send`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ phone: e164() }),
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
          phone: e164(), code,
          consents: [
            { code: 'TOS', version: 'v1', agreed: true },
            { code: 'PRIVACY', version: 'v1', agreed: true },
          ],
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.code ?? 'COMMON_INTERNAL_ERROR'); return; }
      // 역할이 랜딩을 정합니다 — 서버가 세션을 만들면서 같이 알려줍니다.
      // 클라이언트가 판정하면 역할 목록을 브라우저로 내려야 하고, 그러면
      // 승인되지 않은 소속까지 노출됩니다.
      router.push(typeof data.landing === 'string' ? data.landing : '/');
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
      <PhoneInput
        label="휴대폰 번호"
        value={phone}
        disabled={sent}
        onChange={(digits, d) => { setPhone(digits); setDial(d); }}
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
            maxLength={6}
            value={code}
            // 6자리를 넘겨 받으면 서버가 형식 오류를 돌려주는데, 화면에는
            // '입력값을 다시 확인하세요'만 뜹니다. 무엇이 틀렸는지 알 수 없으므로
            // 애초에 7자리가 들어가지 않게 막습니다.
            onChange={(e) => setCode(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
          />
          {devCode ? (
            <p style={{ margin: 'var(--cl-s2) 0 0', fontSize: 'var(--cl-caption)', color: 'var(--cl-flag)' }}>
              데모 인증번호: <span style={{ fontFamily: 'var(--cl-font-mono)' }}>{devCode}</span>
            </p>
          ) : (
            // 번호를 못 받는 상황에서 화면이 아무 말도 하지 않으면 사용자는
            // 000000을 찍어 보다 포기합니다. 왜 안 보이는지를 씁니다.
            <p style={{ margin: 'var(--cl-s2) 0 0', fontSize: 'var(--cl-caption)', color: 'var(--cl-text-muted)', lineHeight: 1.7 }}>
              인증번호가 표시되지 않습니다. 이 스택에는 SMS 발송이 붙어 있지 않아
              데모에서는 화면 표시가 유일한 전달 경로입니다 —
              API를 <span style={{ fontFamily: 'var(--cl-font-mono)' }}>AUTH_EXPOSE_OTP_CODE=true</span>로
              띄웠는지 확인하세요.
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
        disabled={busy || (sent ? code.length < 6 : phone.length < 9)}
        onClick={sent ? verify : send}
      >
        {sent ? '로그인' : '인증 문자 받기'}
      </button>

      {sent && (
        <button style={button(false)} onClick={() => { setSent(false); setCode(''); setDevCode(null); }}>
          번호 다시 입력
        </button>
      )}
    </div>
  );
}
