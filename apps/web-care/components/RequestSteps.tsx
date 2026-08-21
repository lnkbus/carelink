import { label } from '@/lib/labels';

/**
 * 3단계 확정을 화면으로 보여줍니다 (§6-4).
 *
 * 보호자가 간병사를 고른 순간 끝났다고 생각하면, 운영자 확인을 기다리는
 * 동안 "왜 아직이냐"는 문의가 그대로 옵니다. 단계를 그려 두면 지금 어디에
 * 있는지가 보이고 문의가 줄어듭니다.
 *
 * 색만으로 구분하지 않습니다 — 완료는 체크 문자, 현재는 숫자입니다
 * (design/README §Interactions).
 */
const STEPS = [
  { key: 'MATCHING', text: '간병사를 찾습니다', sub: '검증을 통과한 분만 후보로 올라갑니다' },
  { key: 'OFFER_SENT', text: '간병사가 수락하기를 기다립니다', sub: '고르신 분에게 제안이 갔습니다' },
  { key: 'ASSIGNED', text: '담당자가 확인하면 확정됩니다', sub: '수락만으로는 확정되지 않습니다' },
];

export function RequestSteps({ status }: { status: string }) {
  const order = ['SUBMITTED', 'MATCHING', 'OFFER_SENT', 'ASSIGNED', 'IN_SERVICE', 'COMPLETED'];
  const now = order.indexOf(status);

  return (
    <div className="cf-steps">
      {STEPS.map((s, i) => {
        const at = order.indexOf(s.key);
        const done = now > at;
        const current = now === at;
        return (
          <div key={s.key} className={`cf-step ${done ? 'cf-step-done' : ''} ${current ? 'cf-step-now' : ''}`}>
            <span className="cf-step-dot">{done ? '✓' : i + 1}</span>
            <span>
              <span className="cf-step-text">{s.text}</span>
              <br />
              <span className="cf-step-sub">{s.sub}</span>
            </span>
          </div>
        );
      })}
      {(status === 'OPS_REVIEW' || status === 'ISSUE') && (
        <div className="cf-note">
          {status === 'OPS_REVIEW'
            ? '적어 주신 내용을 담당자가 확인하고 있습니다. 확인이 끝나면 다시 간병사를 찾습니다.'
            : '배정이 예상보다 늦어지고 있습니다. 담당자가 확인 중입니다.'}
        </div>
      )}
      {status === 'CANCELLED' && <div className="cf-note cf-note-alert">취소된 요청입니다.</div>}
      {status === 'COMPLETED' && <div className="cf-note">{label(status)}된 요청입니다.</div>}
    </div>
  );
}
