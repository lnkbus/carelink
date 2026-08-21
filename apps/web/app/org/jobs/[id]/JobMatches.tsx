'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { DomainErrorBody, MatchRun } from '@carelink/shared-types';
import { MatchReasonList, Section, StatusPill } from '@carelink/ui';
import { ErrorNotice } from '@/components/ErrorNotice';
import { errorLabel, ruleLabel } from '@/lib/labels-org';

/**
 * 매칭 결과 (SCR-203·204의 근거 출력).
 *
 * F-006 출력 3종 중 **Matching Reason이 가장 중요합니다** (SCR-204 notes).
 * 근거 없는 점수는 기관이 신뢰하지 않습니다. 룰 기반이라 근거를 문장으로
 * 만들 수 있고, 그것이 룰 기반을 쓰는 이유입니다.
 *
 * 제외된 후보의 사유는 기관에도 보여줍니다 — 제안이 적을 때 '인력이 없다'와
 * '검증이 안 끝났다'는 다른 상황이고, 기관의 다음 행동이 달라집니다.
 * 다만 사유는 검증 단계까지만 말하고 어느 서류가 왜 반려됐는지는 말하지 않습니다.
 */
const REASON: Record<string, string> = {
  'match.exclude.clearanceIncomplete': '아직 검증이 완료되지 않았습니다',
  'match.exclude.visaExpiresBeforeStart': '근무 시작일 전에 체류기간이 만료됩니다',
  'match.exclude.statusNotReady': '아직 배치 준비 상태가 아닙니다',
  'match.exclude.notAvailableByStart': '근무 시작일에 근무를 시작할 수 없습니다',
  'visa.eligibility.NOT_ALLOWED': '이 트랙에서 취업이 허용되지 않습니다',
  'visa.eligibility.PENDING_CONFIRMATION': '취업 가능 여부를 운영자가 확인 중입니다',
  'visa.eligibility.REQUIRES_CONVERSION': '배치 전 체류자격 변경이 필요합니다',
  'visa.eligibility.REQUIRES_QUALIFICATION': '자격 보유 여부 확인이 필요합니다',
  'visa.check.unknownStatus': '취업 가능 여부가 아직 확인되지 않았습니다',
  'visa.check.combinationNotDefined': '운영자 판정 대기 중입니다',
};

export function JobMatches({ jobId }: { jobId: string }) {
  const [run, setRun] = useState<MatchRun | null>(null);
  const [error, setError] = useState<DomainErrorBody | null>(null);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    let alive = true;
    setBusy(true);
    fetch(`/api/jobs/${jobId}/matches`, { method: 'POST' })
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

  return (
    <div>
      <Section
        title="매칭 결과"
        note="점수는 근거와 함께만 보여줍니다. 부족한 요건도 같이 나옵니다 — 조건을 조정하면 후보군이 넓어지는지 판단할 수 있어야 합니다."
        aside={
          <span style={{ fontSize: 'var(--cl-caption)', color: 'var(--cl-text-muted)' }}>
            {run.scanned}명 검토 · 제안 {run.matched.length}명 · 제외 {run.excludedCount}명
          </span>
        }
      >
        <div style={{ display: 'grid', gap: 'var(--cl-s5)', padding: 'var(--cl-s5)' }}>
          {run.matched.length === 0 && (
            <p style={{ margin: 0, color: 'var(--cl-text-muted)', fontSize: 'var(--cl-caption)' }}>
              제안할 후보가 없습니다. 아래 제외 사유를 먼저 보세요 — 인력이 없는 것과
              검증이 안 끝난 것은 다른 상황입니다.
            </p>
          )}
          {run.matched.map((m) => (
            <div key={m.candidateId}>
              <div style={{ display: 'flex', gap: 'var(--cl-s3)', alignItems: 'baseline', marginBottom: 'var(--cl-s2)' }}>
                <Link href={`/org/candidates/${m.candidateId}`} style={{ fontFamily: 'var(--cl-font-mono)', fontWeight: 600 }}>
                  {m.displayCode}
                </Link>
                {m.candidateName
                  ? <span>{m.candidateName}</span>
                  : (
                    <span style={{ fontSize: 'var(--cl-caption)', color: 'var(--cl-text-disabled)' }}>
                      실명은 면접 수락 후에 열립니다
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

      {run.excluded.length > 0 && (
        <Section
          title="제외된 후보"
          note="점수 계산 이전에 걸러진 건입니다. 검증 단계까지만 알려드립니다 — 어느 서류가 왜 반려됐는지는 후보자 본인의 정보입니다."
        >
          <ul style={{ listStyle: 'none', margin: 0, padding: 'var(--cl-s3) 0' }}>
            {run.excluded.map((e, i) => (
              <li
                key={`${e.displayCode}-${i}`}
                style={{
                  display: 'flex', gap: 'var(--cl-s4)', alignItems: 'baseline',
                  padding: 'var(--cl-s3) var(--cl-s5)', fontSize: 'var(--cl-body)',
                }}
              >
                <span style={{ fontFamily: 'var(--cl-font-mono)', width: 90 }}>{e.displayCode}</span>
                <StatusPill
                  tone={e.severity === 'BLOCKED_FOR_REVIEW' ? 'flag' : 'alert'}
                  label={e.severity === 'BLOCKED_FOR_REVIEW' ? '확인 중' : '제외'}
                />
                <span style={{ color: 'var(--cl-text-sub)' }}>{REASON[e.reasonKey] ?? '조건에 맞지 않습니다'}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}
