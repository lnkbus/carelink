import Link from 'next/link';
import type { CareAssignment, CareRequest } from '@carelink/shared-types';
import { Ask, Page, Notice, Row } from '@/components/Page';
import { RequestSteps } from '@/components/RequestSteps';
import { guardedGet } from '@/lib/api';
import { currentUser } from '@/lib/session';
import { fmtDateTime, label } from '@/lib/labels';

export const dynamic = 'force-dynamic';

/**
 * SCR-305 예약 확인.
 *
 * ── 결제가 없습니다 ────────────────────────────────────────────────────
 * SCREENS의 SCR-305는 `POST /pricing/quote`와 `POST /payments/authorize`를
 * 요구하지만, **정산·결제는 V3이고 착수 금지입니다** (CLAUDE.md §2).
 * 막혀 있는 것은 기술이 아니라 사업 결정입니다 —
 *   · 간병사와의 법적 관계(직접고용/위탁/중개)에 따라 청구 구조가 다릅니다
 *   · 4대보험·퇴직금을 반영한 기관 청구 단가가 미확정입니다 (§10)
 *   · 취소·환불 정책이 미확정입니다 (§10)
 *
 * 그래서 금액을 계산해 보여주지 않습니다. 가짜 금액을 띄우면 그 숫자를
 * 본 보호자가 나중에 다른 금액을 청구받습니다. 예약 내용 확인까지만 하고,
 * 비용은 담당자가 안내한다고 적습니다.
 */
export default async function ConfirmPage({ params }: { params: { id: string } }) {
  await currentUser();
  const [request, assignments] = await Promise.all([
    guardedGet<CareRequest>(`/care-requests/${params.id}`),
    guardedGet<CareAssignment[]>(`/care-requests/${params.id}/assignments`),
  ]);

  const confirmed = assignments.find((a) => ['ASSIGNED', 'IN_SERVICE', 'COMPLETED'].includes(a.status));

  return (
    <Page
      title="간병 신청"
      back="/care"
      step={4}
      footer={
        confirmed
          ? <Link className="cf-btn" href={`/care/assignments/${confirmed.id}`}>진행 상황 보기</Link>
          : undefined
      }
    >
      <Ask>이대로 신청할까요?</Ask>

      <div className="cf-card">
        <RequestSteps status={request.status} />
      </div>

      <div className="cf-card">
        <h2>{request.hospitalName ?? '병원'}</h2>
        <Row label="병실">{request.ward ?? '—'}</Row>
        <Row label="시작">{fmtDateTime(request.startAt)}</Row>
        <Row label="교대">{label(request.shiftPatternCode)}</Row>
        <Row label="거동">{label(request.mobilityLevel)}</Row>
        {request.supportItems && request.supportItems.length > 0 && (
          <Row label="필요한 도움">{request.supportItems.length}가지</Row>
        )}
      </div>

      {/*
        시안(SCR-305)에는 금액 3행이 있습니다 — 일당 × 일수 · 플랫폼 이용료 ·
        합계(mono 26px). **숫자를 만들지 않습니다** (§6-8 · §2).
        막혀 있는 것은 기술이 아니라 사업 결정입니다:
          · 간병사와의 법적 관계(직접고용/위탁/중개)에 따라 청구 구조가 다르고
          · 4대보험·퇴직금을 반영한 청구 단가(U6)가 미확정이며
          · 취소·환불 정책이 미확정입니다 (§10)
        가짜 금액을 띄우면 그 숫자를 본 보호자가 나중에 다른 금액을
        청구받습니다. 자리는 두되 무엇을 기다리는지 씁니다 — 자리를 지우면
        결정이 난 뒤 레이아웃을 다시 짜야 합니다.
      */}
      <div className="cf-card">
        <h2>비용</h2>
        <div className="cf-row">
          <span className="cf-label">간병 비용</span>
          <span className="cf-value" style={{ color: 'var(--cl-text-muted)' }}>담당자 안내</span>
        </div>
        <div className="cf-row">
          <span className="cf-label">플랫폼 이용료</span>
          <span className="cf-value" style={{ color: 'var(--cl-text-muted)' }}>담당자 안내</span>
        </div>
        <p style={{ margin: 0, fontSize: 'var(--cf-caption)', color: 'var(--cl-text-muted)', lineHeight: 1.6 }}>
          간병사 확인 후 확정됩니다. <b>확정 전에는 결제되지 않습니다.</b>
        </p>
      </div>

      {confirmed && (
        <div className="cf-card">
          <h2>배정된 간병사</h2>
          <Row label="간병사"><span className="cf-mono">{confirmed.caregiverDisplayCode}</span></Row>
          <Row label="상태">{label(confirmed.status)}</Row>
        </div>
      )}

      {/* 업무범위 검토 중이면 무엇 때문인지 말합니다. 감지는 거절이 아닙니다 (§6-15). */}
      {request.status === 'OPS_REVIEW' && (
        <Notice>
          적어 주신 특이사항에 간병사가 할 수 없는 일이 포함된 것 같아
          담당자가 확인하고 있습니다. 확인이 끝나면 다시 간병사를 찾습니다 —
          신청이 취소된 것이 아닙니다.
        </Notice>
      )}

      <div className="cf-card">
        <h2>비용</h2>
        <p style={{ margin: 0, lineHeight: 1.6, color: 'var(--cl-text-sub)' }}>
          간병 비용과 취소 규정은 담당자가 확인 후 안내해 드립니다.
          이 화면에서는 결제가 이뤄지지 않습니다.
        </p>
      </div>
    </Page>
  );
}
