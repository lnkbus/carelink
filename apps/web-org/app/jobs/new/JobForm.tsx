'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@carelink/ui';
import { ErrorNotice } from '@/components/ErrorNotice';

interface Track { id: string; code: string; labelKo: string }

const VISIBILITY = [
  { value: 'PUBLIC', label: '공개', hint: '목록·상세에 금액이 그대로 보입니다. 지원 전환율이 가장 높습니다.' },
  { value: 'AFTER_MATCH', label: '매칭 후 공개', hint: '매칭된 후보자에게만 열립니다.' },
  { value: 'NEGOTIABLE', label: '협의', hint: '금액을 넣지 않습니다. 후보자는 조건을 비교할 수 없습니다.' },
] as const;

/**
 * 채용 요청 폼.
 *
 * 급여 공개 범위를 요청 단위로 둡니다 (SCR-202 notes). 기관은 공개를 꺼리고
 * 후보자는 요구합니다 — 이 값이 지원 전환율에 직접 영향을 주므로 전역 설정으로
 * 두면 A/B 측정 자체가 불가능해집니다.
 *
 * 마스킹이 아니라 미포함입니다. AFTER_MATCH·NEGOTIABLE이면 서버가 금액을 null로
 * 채워 보냅니다 — 값을 내려보내고 화면에서 가리면 API를 직접 보는 순간 뚫립니다.
 */
export function JobForm({ tracks }: { tracks: Track[] }) {
  const router = useRouter();
  const [error, setError] = useState<{ code: string; details?: Record<string, unknown> } | null>(null);
  const [busy, setBusy] = useState(false);
  const [visibility, setVisibility] = useState<string>('PUBLIC');

  async function submit(form: FormData) {
    setBusy(true); setError(null);
    const num = (k: string) => {
      const v = form.get(k);
      return v && String(v).trim() !== '' ? Number(v) : undefined;
    };
    const str = (k: string) => {
      const v = form.get(k);
      return v && String(v).trim() !== '' ? String(v) : undefined;
    };
    try {
      const res = await fetch('/api/jobs', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          trackId: str('trackId'), title: str('title'),
          headcount: num('headcount') ?? 1, region: str('region'),
          employmentType: str('employmentType'), startDate: str('startDate'),
          dormProvided: form.get('dormProvided') === 'on',
          salaryMin: visibility === 'NEGOTIABLE' ? undefined : num('salaryMin'),
          salaryMax: visibility === 'NEGOTIABLE' ? undefined : num('salaryMax'),
          salaryVisibility: visibility,
          minExperienceYrs: num('minExperienceYrs'),
          languageLevel: str('languageLevel'),
          extraConditions: str('extraConditions'),
        }),
      });
      const body = await res.json();
      if (!res.ok) { setError(body); return; }
      router.push(`/jobs/${body.id}`);
      router.refresh();
    } finally { setBusy(false); }
  }

  const field: React.CSSProperties = {
    width: '100%', height: 40, padding: '0 var(--cl-s4)',
    border: '1px solid var(--cl-line-strong)', borderRadius: 'var(--cl-r-desk)',
    fontSize: 'var(--cl-body)', fontFamily: 'inherit',
  };
  const lbl: React.CSSProperties = {
    display: 'block', fontSize: 'var(--cl-caption)', color: 'var(--cl-text-sub)',
    marginBottom: 'var(--cl-s2)',
  };

  return (
    <form action={submit} style={{ maxWidth: 720, marginTop: 'var(--cl-s6)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--cl-s5)' }}>
        <div style={{ gridColumn: '1 / -1' }}>
          <label style={lbl}>요청 제목</label>
          <input name="title" style={field} placeholder="병원 간병사 (3교대)" />
        </div>
        <div>
          <label style={lbl}>트랙</label>
          <select name="trackId" style={field} required>
            {tracks.map((t) => <option key={t.id} value={t.id}>{t.labelKo}</option>)}
          </select>
        </div>
        <div>
          <label style={lbl}>모집 인원</label>
          <input name="headcount" type="number" min={1} defaultValue={1} style={field} required />
        </div>
        <div>
          <label style={lbl}>근무 지역</label>
          <input name="region" style={field} placeholder="경기 안산시" required />
        </div>
        <div>
          <label style={lbl}>고용 형태</label>
          <select name="employmentType" style={field}>
            <option value="">선택 안 함</option>
            <option value="FULL_TIME">상근</option>
            <option value="SHIFT">교대</option>
            <option value="PART_TIME">시간제</option>
          </select>
        </div>
        <div>
          <label style={lbl}>근무 시작일</label>
          <input name="startDate" type="date" style={field} />
        </div>
        <div>
          <label style={lbl}>최소 경력 (년)</label>
          <input name="minExperienceYrs" type="number" min={0} step={0.5} style={field} />
        </div>
        <div>
          <label style={lbl}>한국어 수준</label>
          <select name="languageLevel" style={field}>
            <option value="">요구 없음</option>
            <option value="TOPIK_2">TOPIK 2급</option>
            <option value="TOPIK_3">TOPIK 3급</option>
            <option value="TOPIK_4">TOPIK 4급</option>
            <option value="KIIP_3">KIIP 3단계</option>
          </select>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--cl-s3)', paddingTop: 'var(--cl-s6)' }}>
          <input id="dorm" name="dormProvided" type="checkbox" style={{ width: 18, height: 18 }} />
          <label htmlFor="dorm" style={{ fontSize: 'var(--cl-body)' }}>기숙사 제공</label>
        </div>
      </div>

      <fieldset
        style={{
          marginTop: 'var(--cl-s6)', border: '1px solid var(--cl-line)',
          borderRadius: 'var(--cl-r-desk)', padding: 'var(--cl-s5)',
        }}
      >
        <legend style={{ padding: '0 var(--cl-s3)', fontSize: 'var(--cl-caption)', color: 'var(--cl-text-sub)' }}>
          급여 공개 범위
        </legend>
        <div style={{ display: 'grid', gap: 'var(--cl-s3)' }}>
          {VISIBILITY.map((v) => (
            <label
              key={v.value}
              style={{
                display: 'flex', gap: 'var(--cl-s3)', alignItems: 'flex-start',
                padding: 'var(--cl-s3)', borderRadius: 'var(--cl-r-desk)',
                background: visibility === v.value ? 'var(--cl-action-tint)' : undefined,
                cursor: 'pointer',
              }}
            >
              <input
                type="radio" name="salaryVisibility" value={v.value}
                checked={visibility === v.value}
                onChange={() => setVisibility(v.value)}
                style={{ marginTop: 3 }}
              />
              <span>
                <span style={{ fontWeight: 600 }}>{v.label}</span>
                <span style={{ display: 'block', fontSize: 'var(--cl-caption)', color: 'var(--cl-text-muted)' }}>
                  {v.hint}
                </span>
              </span>
            </label>
          ))}
        </div>

        {visibility !== 'NEGOTIABLE' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--cl-s5)', marginTop: 'var(--cl-s5)' }}>
            <div>
              <label style={lbl}>월 급여 하한 (원)</label>
              <input name="salaryMin" type="number" min={0} step={10000} style={field} />
            </div>
            <div>
              <label style={lbl}>월 급여 상한 (원)</label>
              <input name="salaryMax" type="number" min={0} step={10000} style={field} />
            </div>
          </div>
        )}
      </fieldset>

      <div style={{ marginTop: 'var(--cl-s5)' }}>
        <label style={lbl}>추가 조건</label>
        <textarea
          name="extraConditions" rows={3}
          style={{ ...field, height: 'auto', padding: 'var(--cl-s4)', resize: 'vertical' }}
          placeholder="근무 조건, 우대 사항 등"
        />
        <p style={{ margin: 'var(--cl-s2) 0 0', fontSize: 'var(--cl-caption)', color: 'var(--cl-text-muted)' }}>
          투약·주사·석션 같은 의료행위는 간병 업무 범위 밖입니다. 자유 입력은 검토 대상이 될 수 있습니다.
        </p>
      </div>

      {error && <div style={{ marginTop: 'var(--cl-s5)' }}><ErrorNotice code={error.code} details={error.details} /></div>}

      <div style={{ marginTop: 'var(--cl-s6)' }}>
        <Button variant="filled" type="submit" disabled={busy}>
          {busy ? '등록 중…' : '등록하고 매칭 실행'}
        </Button>
      </div>
    </form>
  );
}
