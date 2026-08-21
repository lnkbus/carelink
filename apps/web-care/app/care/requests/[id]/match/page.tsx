import type { CareAssignment, CareMatchResult, CareRequest } from '@carelink/shared-types';
import { Page, Notice } from '@/components/Page';
import { RequestSteps } from '@/components/RequestSteps';
import { guardedGet, apiSend } from '@/lib/api';
import { currentUser } from '@/lib/session';
import { label } from '@/lib/labels';
import { CaregiverList } from './CaregiverList';

export const dynamic = 'force-dynamic';

/**
 * SCR-304 간병사 매칭.
 *
 * ── 카드에 없는 것 ─────────────────────────────────────────────────────
 * **국적·실명·연락처가 없습니다** (§6-21 · §5.10, 2026-08-21 확정).
 * API가 애초에 내려주지 않고 (`CaregiverCardDto`에 필드가 없음), 타입에도
 * 없어서 여기서 그리려 하면 컴파일이 실패합니다. 게이트를 세 겹으로 둔 것은
 * 화면이 늘어나면 어느 한 겹은 뚫리기 때문입니다.
 *
 * 보호자가 국적으로 고르기 시작하면 그것이 배정 관행이 되고, 검증을 통과한
 * 인력이 국적 때문에 선택받지 못합니다. 플랫폼이 거르는 것은 국적이 아니라
 * 검증되지 않은 인력입니다.
 *
 * ── 고른다고 끝이 아닙니다 ─────────────────────────────────────────────
 * 보호자 선택 → 간병사 수락 → **담당자 확인**의 3단계입니다 (§6-4).
 * 화면 위쪽에 단계를 그려 두는 이유는, 고른 순간 끝났다고 생각하면
 * 기다리는 동안 문의가 그대로 오기 때문입니다.
 */
export default async function MatchPage({ params }: { params: { id: string } }) {
  await currentUser();
  const request = await guardedGet<CareRequest>(`/care-requests/${params.id}`);

  // 매칭은 POST입니다 — 실행할 때마다 match_logs에 운영자 판단 근거가 쌓입니다.
  const [match, assignments] = await Promise.all([
    apiSend<CareMatchResult>('POST', `/care-requests/${params.id}/match`),
    guardedGet<CareAssignment[]>(`/care-requests/${params.id}/assignments`),
  ]);

  const pending = assignments.find((a) => ['OFFERED', 'ACCEPTED'].includes(a.status));

  return (
    <Page title="간병사 선택" back="/care">
      <div className="cf-card">
        <h2>{request.hospitalName ?? '병원'} {request.ward ?? ''}</h2>
        <RequestSteps status={request.status} />
      </div>

      {pending ? (
        <div className="cf-card">
          <h2>{pending.caregiverDisplayCode} 님에게 제안했습니다</h2>
          <p style={{ margin: 0, lineHeight: 1.6, color: 'var(--cl-text-sub)' }}>
            {pending.status === 'ACCEPTED'
              ? '간병사가 수락했습니다. 담당자 확인이 끝나면 확정 안내를 보내 드립니다.'
              : '간병사가 확인하는 중입니다. 수락하면 알려 드립니다.'}
          </p>
          <span className="cf-label">현재 상태 · {label(pending.status)}</span>
        </div>
      ) : (
        <>
          <CaregiverList requestId={params.id} candidates={match.candidates} />
          {match.excludedCount > 0 && (
            <Notice>
              <b>{match.excludedCount}명이 후보에서 빠졌습니다.</b>
              {/* 사유 내역은 운영자 전용입니다 — 보호자 응답에는 키 자체가
                  없어서 여기서 그릴 수 없습니다. 건수만으로도 "사람이 없다"와
                  "조건이 맞는 사람이 적다"는 구분됩니다. */}
              {match.excludedReasons ? (
                <ul style={{ margin: 'var(--cl-s3) 0 0', paddingLeft: 'var(--cl-s6)' }}>
                  {Object.entries(match.excludedReasons).map(([code, n]) => (
                    <li key={code}>{reasonText(code)} · {n}명</li>
                  ))}
                </ul>
              ) : (
                <p style={{ margin: 'var(--cl-s3) 0 0' }}>
                  검증이 끝나지 않았거나 해당 기간에 일정이 없는 분들입니다.
                </p>
              )}
            </Notice>
          )}
        </>
      )}
    </Page>
  );
}

/**
 * 왜 빠졌는지 알립니다.
 *
 * "후보가 2명뿐"과 "12명 중 10명이 검증 기간이 지나 빠졌다"는 전혀 다른
 * 정보입니다. 감추면 보호자는 플랫폼에 사람이 없다고 판단하고 떠납니다.
 */
function reasonText(code: string): string {
  switch (code) {
    case 'CLEARANCE_INCOMPLETE': return '배치 전 검증이 끝나지 않음';
    case 'CLEARANCE_EXPIRED': return '검증 유효기간이 지남';
    case 'NOT_AVAILABLE': return '해당 기간에 일정이 없음';
    default: return '조건이 맞지 않음';
  }
}
