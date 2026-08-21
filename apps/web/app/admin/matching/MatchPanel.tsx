'use client';
import { useEffect, useState } from 'react';
import type { DomainErrorBody, MatchRun } from '@carelink/shared-types';
import { MatchReasonList, Section, StatusPill } from '@carelink/ui';
import { ErrorNotice } from '@/components/ErrorNotice';
import { errorLabel, ruleLabel } from '@/lib/labels-admin';

/**
 * 하드 필터 messageKey → 운영자용 사유 문장.
 *
 * 백엔드는 코드만 주고 문구는 여기서 붙입니다 (§5.15). 차단은 항상 사유와 함께
 * 보여줘야 하므로, 표에 없는 키가 와도 키 원문을 그대로 노출합니다 —
 * 빈칸으로 두면 운영자가 무엇을 물어봐야 할지 모릅니다.
 */
const REASON: Record<string, string> = {
  'match.exclude.clearanceIncomplete': '클리어런스 6종이 전부 통과되지 않았습니다',
  'match.exclude.visaExpiresBeforeStart': '근무 시작일 전에 체류기간이 만료됩니다 — 배치하면 불법 취업이 됩니다',
  'match.exclude.statusNotReady': '아직 배치 준비 상태가 아닙니다',
  'match.exclude.notAvailableByStart': '근무 시작일에 근무를 시작할 수 없습니다',
  'visa.eligibility.NOT_ALLOWED': '이 트랙에서 취업이 허용되지 않는 체류자격입니다',
  'visa.eligibility.PENDING_CONFIRMATION': '체류자격 적격성이 확정되지 않았습니다 — 사람이 확인해야 자동 배정이 열립니다',
  'visa.eligibility.REQUIRES_CONVERSION': '배치 전 체류자격 변경이 필요합니다',
  'visa.eligibility.REQUIRES_QUALIFICATION': '자격 보유 여부를 확인해야 합니다',
  'visa.check.unknownStatus': '체류자격이 아직 확인되지 않았습니다',
  'visa.check.combinationNotDefined': '이 트랙 × 체류자격 조합이 정의돼 있지 않습니다 — 운영자가 판정해 기록해야 합니다',
};

export function MatchPanel({ jobId }: { jobId: string }) {
  const [run, setRun] = useState<MatchRun | null>(null);
  const [error, setError] = useState<DomainErrorBody | null>(null);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    let alive = true;
    setBusy(true); setError(null); setRun(null);
    fetch(`/api/matching/${jobId}`, { method: 'POST' })
      .then(async (res) => {
        const body = await res.json();
        if (!alive) return;
        if (!res.ok) setError(body); else setRun(body);
      })
      .finally(() => { if (alive) setBusy(false); });
    return () => { alive = false; };
  }, [jobId]);

  if (busy) return <p style={{ marginTop: 'var(--cl-s7)', color: 'var(--cl-text-muted)' }}>매칭 실행 중…</p>;
  if (error) return <div style={{ marginTop: 'var(--cl-s7)' }}><ErrorNotice code={error.code} details={error.details} labeler={errorLabel} /></div>;
  if (!run) return null;

  const blocked = run.excluded.filter((e) => e.severity === 'BLOCKED_FOR_REVIEW');
  const removed = run.excluded.filter((e) => e.severity !== 'BLOCKED_FOR_REVIEW');

  return (
    <div>
      {/*
        하단 요약 바는 제안 대상과 제외 건수·사유를 **함께** 보여줍니다.
        제안 3명만 보이면 "후보가 없다"로 읽히지만, 실제로는 대부분 검증이
        안 끝난 것입니다. 그 구분이 운영자의 다음 행동을 바꿉니다.
      */}
      <div
        style={{
          display: 'flex', gap: 'var(--cl-s5)', alignItems: 'center', flexWrap: 'wrap',
          padding: 'var(--cl-s5)', border: '1px solid var(--cl-line)',
          borderRadius: 'var(--cl-r-desk)', marginTop: 'var(--cl-s7)',
        }}
      >
        <span>
          <span style={{ fontFamily: 'var(--cl-font-mono)', fontSize: 'var(--cl-display)', fontWeight: 700 }}>
            {run.matched.length}
          </span>
          <span style={{ marginLeft: 6, color: 'var(--cl-text-muted)', fontSize: 'var(--cl-caption)' }}>제안 대상</span>
        </span>
        <span style={{ color: 'var(--cl-line-strong)' }}>|</span>
        <span style={{ fontSize: 'var(--cl-caption)', color: 'var(--cl-text-sub)' }}>
          {run.scanned}명 검토 · {run.excludedCount}명 제외
        </span>
        {blocked.length > 0 && <StatusPill tone="flag" label={`운영자 확인 필요 ${blocked.length}`} />}
      </div>

      <Section title="제안 후보" note="점수 단독 노출은 금지입니다. 항목별 가중치와 부족 요건을 함께 봅니다.">
        <div style={{ display: 'grid', gap: 'var(--cl-s5)', padding: 'var(--cl-s5)' }}>
          {run.matched.length === 0 && (
            <p style={{ margin: 0, color: 'var(--cl-text-muted)', fontSize: 'var(--cl-caption)' }}>
              제안할 후보가 없습니다. 아래 제외 사유를 먼저 보세요 — 대부분은 검증 미완이지 인력 부족이 아닙니다.
            </p>
          )}
          {run.matched.map((m) => (
            <div key={m.candidateId}>
              <div style={{ display: 'flex', gap: 'var(--cl-s3)', alignItems: 'baseline', marginBottom: 'var(--cl-s2)' }}>
                <span style={{ fontFamily: 'var(--cl-font-mono)', fontWeight: 600 }}>{m.displayCode}</span>
                {m.candidateName
                  ? <span>{m.candidateName}</span>
                  : (
                    <span style={{ fontSize: 'var(--cl-caption)', color: 'var(--cl-text-disabled)' }}>
                      실명은 면접 수락 이후에 열립니다
                    </span>
                  )}
              </div>
              <MatchReasonList
                score={m.score}
                reasons={m.reasons.map((r) => ({
                  ruleCode: r.ruleCode, label: ruleLabel(r.ruleCode),
                  points: r.points, maxPoints: r.maxPoints,
                }))}
                missing={m.missingRequirements.map((r) => ruleLabel(r.ruleCode))}
              />
            </div>
          ))}
        </div>
      </Section>

      {blocked.length > 0 && (
        <Section
          title="운영자 확인 필요"
          note="자동 배정이 막힌 건입니다. 적격성 판정은 코드가 아니라 사람이 하고, 그 결과를 기록합니다."
        >
          <ExclusionList items={blocked} tone="flag" />
        </Section>
      )}

      {removed.length > 0 && (
        <Section
          title="제외된 후보"
          note="점수 계산 이전에 걸러진 건입니다. 사유 없이 사라지지 않습니다."
        >
          <ExclusionList items={removed} tone="alert" />
        </Section>
      )}
    </div>
  );
}

function ExclusionList({
  items, tone,
}: {
  items: MatchRun['excluded'];
  tone: 'flag' | 'alert';
}) {
  return (
    <ul style={{ listStyle: 'none', margin: 0, padding: 'var(--cl-s3) 0' }}>
      {items.map((e, i) => (
        <li
          key={`${e.displayCode}-${i}`}
          style={{
            display: 'flex', gap: 'var(--cl-s4)', alignItems: 'baseline',
            padding: 'var(--cl-s3) var(--cl-s5)', fontSize: 'var(--cl-body)',
          }}
        >
          <span style={{ fontFamily: 'var(--cl-font-mono)', width: 90 }}>{e.displayCode}</span>
          <StatusPill tone={tone} label={e.filterCode} />
          <span style={{ color: 'var(--cl-text-sub)' }}>
            {REASON[e.reasonKey] ?? e.reasonKey}
          </span>
        </li>
      ))}
    </ul>
  );
}
