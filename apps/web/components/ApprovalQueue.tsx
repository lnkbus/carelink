'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button, StatusPill } from '@carelink/ui';
import type { PendingRoleRequest } from '@carelink/shared-types';
import { errorLabel as adminError } from '@/lib/labels-admin';
import { errorLabel as orgError } from '@/lib/labels-org';

/**
 * 승인 큐 — 운영자와 기관 관리자가 같은 컴포넌트를 씁니다.
 *
 * 화면을 둘로 나누지 않은 이유: 승인 규칙은 하나이고, 무엇을 볼 수 있는지는
 * 서버가 `@Scope`로 이미 잘라서 보냅니다. 여기서 역할을 다시 판정하면
 * 두 판정이 어긋나는 날이 오고, 그날 기관 관리자가 남의 기관 신청을 봅니다.
 *
 * `businessRegNo`가 오지 않는 것도 그래서입니다 — 숨기는 코드가 아니라
 * 애초에 내려오지 않습니다.
 */

const ROLE_LABEL: Record<string, string> = {
  ORG_MEMBER: '기관 담당자',
  ORG_ADMIN: '기관 관리자',
  PARTNER: '파트너 제휴',
};

const VERIFY_TONE: Record<string, 'signal' | 'flag' | 'alert' | 'neutral'> = {
  VERIFIED: 'signal', PENDING: 'flag', UNDER_REVIEW: 'flag', REJECTED: 'alert', SUSPENDED: 'alert',
};

const VERIFY_LABEL: Record<string, string> = {
  VERIFIED: '검증 완료', PENDING: '검증 대기', UNDER_REVIEW: '검증 심사 중',
  REJECTED: '검증 반려', SUSPENDED: '정지',
};

export function ApprovalQueue({
  items, audience, emptyNote,
}: {
  items: PendingRoleRequest[];
  /**
   * 문구 사전을 고릅니다 — 같은 오류 코드가 운영자와 기관 담당자에게
   * 다르게 읽힙니다.
   *
   * 함수를 prop으로 받지 않는 이유: 서버 컴포넌트에서 클라이언트 컴포넌트로
   * 함수를 넘길 수 없습니다. 타입 검사도 빌드도 통과하고 **화면을 열었을 때
   * 터집니다** — 실제로 그랬습니다.
   */
  audience: 'admin' | 'org';
  emptyNote: string;
}) {
  const errorLabel = audience === 'admin' ? adminError : orgError;
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // 반려는 사유가 필수라 입력칸을 펴야 합니다.
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState('');

  async function decide(id: string, decision: 'APPROVE' | 'REJECT', why?: string) {
    setBusyId(id); setError(null);
    try {
      const res = await fetch(`/api/role-requests/${id}`, {
        method: 'PATCH', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ decision, reason: why }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.code ?? 'COMMON_INTERNAL_ERROR'); return; }
      setRejecting(null); setReason('');
      router.refresh();
    } catch { setError('NETWORK'); }
    finally { setBusyId(null); }
  }

  if (items.length === 0) {
    return (
      <div style={{ padding: 'var(--cl-s6)', color: 'var(--cl-text-muted)', lineHeight: 1.7 }}>
        {emptyNote}
      </div>
    );
  }

  return (
    <div>
      {error && (
        <div
          style={{
            margin: '0 0 var(--cl-s5)', padding: 'var(--cl-s4)', borderRadius: 10,
            background: 'var(--cl-alert-bg, #fdecec)', color: 'var(--cl-alert)',
            fontSize: 15, lineHeight: 1.6,
          }}
        >
          {errorLabel(error)}
        </div>
      )}

      <div style={{ display: 'grid', gap: 'var(--cl-s4)' }}>
        {items.map((r) => (
          <div
            key={r.id}
            // 카드를 집어낼 수 있어야 합니다. 큐에 여러 건이 쌓이면 '첫 번째
            // 승인 버튼'은 화면에 보이는 그 건이 아닙니다 — 실제로 브라우저
            // 검증에서 엉뚱한 신청을 승인했습니다.
            data-role-request={r.id}
            style={{
              padding: 'var(--cl-s5)', border: '1px solid var(--cl-line)',
              borderRadius: 12, background: 'var(--cl-bg)',
            }}
          >
            <div style={{ display: 'flex', gap: 'var(--cl-s3)', alignItems: 'center', flexWrap: 'wrap' }}>
              <strong style={{ fontSize: 'var(--cl-subtitle)' }}>
                {r.organizationName ?? ROLE_LABEL[r.role] ?? r.role}
              </strong>
              <StatusPill tone="neutral" label={ROLE_LABEL[r.role] ?? r.role} />
              {r.verificationStatus && (
                <StatusPill
                  tone={VERIFY_TONE[r.verificationStatus] ?? 'neutral'}
                  label={VERIFY_LABEL[r.verificationStatus] ?? r.verificationStatus}
                />
              )}
              {/* 첫 담당자는 승인하면 그 기관의 관리자가 됩니다. 누르는 쪽이
                  무게를 알아야 합니다 — 이 사람이 이후 동료를 승인합니다. */}
              {r.becomesAdmin && <StatusPill tone="flag" label="승인 시 기관 관리자" />}
            </div>

            <div
              style={{
                marginTop: 'var(--cl-s3)', display: 'flex', gap: 'var(--cl-s5)',
                flexWrap: 'wrap', fontSize: 'var(--cl-caption)', color: 'var(--cl-text-sub)',
              }}
            >
              {/* 승인하는 사람이 판단할 근거가 사실상 이것뿐입니다 —
                  대개 이 번호로 전화해 확인하고 누릅니다. */}
              <span style={{ fontFamily: 'var(--cl-font-mono)' }}>{r.phone ?? '번호 없음'}</span>
              {r.businessRegNo && (
                <span style={{ fontFamily: 'var(--cl-font-mono)' }}>사업자 {r.businessRegNo}</span>
              )}
              <span>신청 {new Date(r.requestedAt).toLocaleDateString('ko-KR')}</span>
            </div>

            {rejecting === r.id ? (
              <div style={{ marginTop: 'var(--cl-s4)' }}>
                <input
                  autoFocus
                  style={{
                    width: '100%', height: 'var(--cl-tap-desk)', padding: '0 var(--cl-s4)',
                    boxSizing: 'border-box', border: '1px solid var(--cl-line-strong)',
                    borderRadius: 'var(--cl-r-desk)', fontSize: 'var(--cl-body)', fontFamily: 'inherit',
                  }}
                  placeholder="반려 사유 — 신청자에게 무엇을 고쳐야 하는지 남깁니다"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                />
                <div style={{ display: 'flex', gap: 'var(--cl-s3)', marginTop: 'var(--cl-s3)' }}>
                  <Button
                    variant="filled" tone="alert"
                    disabled={busyId === r.id || reason.trim().length < 2}
                    onClick={() => decide(r.id, 'REJECT', reason.trim())}
                  >
                    반려 확정
                  </Button>
                  <Button variant="ghost" onClick={() => { setRejecting(null); setReason(''); }}>
                    취소
                  </Button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 'var(--cl-s3)', marginTop: 'var(--cl-s4)' }}>
                <Button variant="filled" disabled={busyId === r.id} onClick={() => decide(r.id, 'APPROVE')}>
                  {busyId === r.id ? '처리 중' : '승인'}
                </Button>
                <Button variant="ghost" onClick={() => { setRejecting(r.id); setReason(''); setError(null); }}>
                  반려
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
