'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@carelink/ui';
import type { Industry } from '@carelink/shared-types';
import { errorLabel } from '@/lib/labels-org';

/**
 * 기관 신청 — 신규 등록과 합류가 한 화면입니다.
 *
 * ── 왜 한 화면인가 ──────────────────────────────────────────────────
 * 신청하는 사람은 자기 병원이 이미 등록돼 있는지 모릅니다. 화면을 둘로
 * 나누면 반드시 한쪽을 골라야 하고, 틀리면 막다른 길입니다.
 *
 * 그래서 **사업자등록번호를 먼저 받고**, 이미 있으면 합류로 넘어갑니다.
 * 서버가 `IAM_ORG_ALREADY_REGISTERED`와 함께 기관 이름을 돌려주므로,
 * '○○병원으로 합류 신청하시겠습니까'까지 말할 수 있습니다. 막기만 하면
 * 신청한 사람은 전화를 겁니다.
 */

const input: React.CSSProperties = {
  width: '100%', height: 52, padding: '0 var(--cl-s4)', boxSizing: 'border-box',
  border: '1px solid var(--cl-line-strong)', borderRadius: 'var(--cl-r-desk)',
  fontSize: 17, fontFamily: 'inherit', background: 'var(--cl-bg)', color: 'var(--cl-text)',
};

const labelStyle: React.CSSProperties = {
  display: 'block', marginBottom: 6, fontSize: 14, fontWeight: 600, color: 'var(--cl-text-sub)',
};

/** 사업자등록번호는 하이픈 유무를 가리지 않습니다 — 사람은 양쪽으로 씁니다. */
function digits(v: string): string {
  return v.replace(/[^0-9]/g, '').slice(0, 10);
}
function formatBiz(v: string): string {
  const d = digits(v);
  if (d.length <= 3) return d;
  if (d.length <= 5) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}`;
}

const ORG_TYPES = [
  { value: 'HOSPITAL', label: '병원 · 종합병원' },
  { value: 'NURSING_HOME', label: '요양원 · 요양시설' },
  { value: 'REHAB', label: '재활병원' },
  { value: 'CLINIC', label: '의원 · 클리닉' },
  { value: 'HOME_CARE', label: '재가 · 방문요양' },
  { value: 'OTHER', label: '그 외' },
];

type Duplicate = { organizationName: string };

export function OrgSignupForm({ industries }: { industries: Industry[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // 중복이 잡히면 신규 등록 폼을 닫고 합류 확인으로 갈아탑니다.
  const [duplicate, setDuplicate] = useState<Duplicate | null>(null);

  const [businessRegNo, setBusinessRegNo] = useState('');
  const [name, setName] = useState('');
  const [industryId, setIndustryId] = useState(industries[0]?.id ?? '');
  const [orgType, setOrgType] = useState(ORG_TYPES[0].value);
  const [region, setRegion] = useState('');
  const [address, setAddress] = useState('');
  const [contactName, setContactName] = useState('');

  const bizOk = digits(businessRegNo).length === 10;

  async function post(path: string, body: unknown) {
    setBusy(true); setError(null);
    try {
      const res = await fetch(path, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.code === 'IAM_ORG_ALREADY_REGISTERED') {
          setDuplicate({ organizationName: data.details?.organizationName ?? '이미 등록된 기관' });
          return;
        }
        setError(data.code ?? 'COMMON_INTERNAL_ERROR');
        return;
      }
      // 신청이 접수됐습니다. 대기 화면이 '무엇을 신청했고 다음에 무슨 일이
      // 일어나는가'를 말합니다.
      router.push('/pending');
      router.refresh();
    } catch {
      setError('NETWORK');
    } finally {
      setBusy(false);
    }
  }

  if (duplicate) {
    return (
      <div>
        <div
          style={{
            padding: 'var(--cl-s5)', borderRadius: 12, background: 'var(--cl-bg-sub)',
            border: '1px solid var(--cl-line-strong)', lineHeight: 1.7, fontSize: 16,
          }}
        >
          <strong>{duplicate.organizationName}</strong>이(가) 이미 등록돼 있습니다.
          <div style={{ marginTop: 8, fontSize: 15, color: 'var(--cl-text-sub)' }}>
            같은 기관을 두 번 등록하면 후보자가 어느 쪽에 지원했는지 갈리고, 검증도 두 번 받아야
            합니다. 이 기관의 담당자로 합류를 신청하세요 — 승인은 그 기관의 관리자가 합니다.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 'var(--cl-s3)', marginTop: 'var(--cl-s5)' }}>
          <Button
            variant="filled" disabled={busy}
            onClick={() => post('/api/signup/organization/join', { businessRegNo })}
          >
            {busy ? '신청하는 중' : '담당자로 합류 신청'}
          </Button>
          <Button variant="ghost" onClick={() => { setDuplicate(null); setError(null); }}>
            다른 번호로
          </Button>
        </div>
        {error && <ErrorLine code={error} />}
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 'var(--cl-s5)' }}>
      <div>
        <label style={labelStyle} htmlFor="biz">사업자등록번호</label>
        <input
          id="biz" style={{ ...input, fontFamily: 'var(--cl-font-mono)' }}
          inputMode="numeric" placeholder="123-45-67890"
          value={businessRegNo} onChange={(e) => setBusinessRegNo(formatBiz(e.target.value))}
        />
        <div style={{ marginTop: 6, fontSize: 13, color: 'var(--cl-text-muted)' }}>
          이미 등록된 기관이면 합류 신청으로 안내합니다. 하이픈은 있어도 없어도 됩니다.
        </div>
      </div>

      <div>
        <label style={labelStyle} htmlFor="name">기관명</label>
        <input
          id="name" style={input} placeholder="사업자등록증에 적힌 이름"
          value={name} onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--cl-s4)' }}>
        <div>
          <label style={labelStyle} htmlFor="industry">산업</label>
          <select id="industry" style={input} value={industryId} onChange={(e) => setIndustryId(e.target.value)}>
            {industries.map((i) => (
              <option key={i.id} value={i.id}>{i.labelKo}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle} htmlFor="orgType">기관 유형</label>
          <select id="orgType" style={input} value={orgType} onChange={(e) => setOrgType(e.target.value)}>
            {ORG_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 'var(--cl-s4)' }}>
        <div>
          <label style={labelStyle} htmlFor="region">지역</label>
          <input id="region" style={input} placeholder="서울 강남구" value={region} onChange={(e) => setRegion(e.target.value)} />
        </div>
        <div>
          <label style={labelStyle} htmlFor="contact">담당자 이름</label>
          <input id="contact" style={input} placeholder="김담당" value={contactName} onChange={(e) => setContactName(e.target.value)} />
        </div>
      </div>

      <div>
        <label style={labelStyle} htmlFor="address">주소 <span style={{ fontWeight: 400, color: 'var(--cl-text-muted)' }}>(선택)</span></label>
        <input id="address" style={input} value={address} onChange={(e) => setAddress(e.target.value)} />
      </div>

      <div style={{ display: 'flex', gap: 'var(--cl-s3)', alignItems: 'center', flexWrap: 'wrap' }}>
        <Button
          variant="filled"
          disabled={busy || !bizOk || name.trim().length < 2 || !industryId}
          onClick={() => post('/api/signup/organization', {
            name: name.trim(),
            industryId,
            orgType,
            businessRegNo,
            region: region.trim() || undefined,
            address: address.trim() || undefined,
            contactName: contactName.trim() || undefined,
          })}
        >
          {busy ? '신청하는 중' : '기관 등록 신청'}
        </Button>
        <Button
          variant="ghost"
          disabled={busy || !bizOk}
          onClick={() => post('/api/signup/organization/join', { businessRegNo })}
        >
          이미 등록된 기관에 합류
        </Button>
      </div>
      {error && <ErrorLine code={error} />}
    </div>
  );
}

function ErrorLine({ code }: { code: string }) {
  return (
    <div style={{ marginTop: 'var(--cl-s4)', color: 'var(--cl-alert)', fontSize: 15, lineHeight: 1.6 }}>
      {errorLabel(code)}
    </div>
  );
}
