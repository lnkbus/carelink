import type { Notification } from '@carelink/shared-types';
import { apiGet } from '@/lib/api';

/**
 * 승인 · 반려 결과 알림.
 *
 * ── 반려가 이 컴포넌트의 존재 이유입니다 ──────────────────────────────
 * 반려는 `user_roles` 행을 **지웁니다**. 그러면 신청자 화면에는 아무것도
 * 남지 않고, 그 사람은 대기 화면에 있다가 어느 날 '신청한 적 없는 상태'로
 * 돌아가 있는 것을 봅니다. 사유는 감사 로그에만 있고 운영자만 봅니다.
 *
 * 무엇을 고쳐야 하는지 모르는 사람은 **같은 신청을 다시 냅니다.** 큐가
 * 두 배가 되고, 운영자는 같은 이유로 또 반려합니다.
 *
 * 문구는 서버가 수신자 언어로 붙여서 보냅니다 — 여기서 번역하지 않습니다.
 */
const ROLE_CODES = ['IAM_ROLE_APPROVED', 'IAM_ROLE_REJECTED'];

export async function RoleDecisionNotice() {
  // 실패해도 화면을 막지 않습니다. 알림 하나 때문에 대기 화면이 죽으면
  // 신청자는 무엇이 잘못됐는지조차 알 수 없습니다.
  const items = await apiGet<Notification[]>('/notifications').catch(() => [] as Notification[]);
  const decisions = items.filter((n) => ROLE_CODES.includes(n.code)).slice(0, 3);
  if (decisions.length === 0) return null;

  return (
    <div style={{ display: 'grid', gap: 'var(--cl-s4)', marginTop: 'var(--cl-s5)' }}>
      {decisions.map((n) => {
        const rejected = n.code === 'IAM_ROLE_REJECTED';
        return (
          <div
            key={n.id}
            style={{
              padding: 'var(--cl-s5)', borderRadius: 12,
              // 반려는 눈에 띄어야 합니다. 다른 안내 상자와 같은 회색이면
              // 읽지 않고 지나갑니다.
              border: `1px solid ${rejected ? 'var(--cl-alert)' : 'var(--cl-signal)'}`,
              background: 'var(--cl-bg)',
            }}
          >
            <div
              style={{
                fontSize: 17, fontWeight: 700,
                color: rejected ? 'var(--cl-alert)' : 'var(--cl-text)',
              }}
            >
              {n.title ?? (rejected ? '신청이 반려되었습니다' : '신청이 승인되었습니다')}
            </div>
            {n.body && (
              <p style={{ margin: 'var(--cl-s3) 0 0', fontSize: 15, lineHeight: 1.7, color: 'var(--cl-text-sub)' }}>
                {n.body}
              </p>
            )}
            <div style={{ marginTop: 'var(--cl-s3)', fontSize: 'var(--cl-caption)', color: 'var(--cl-text-muted)' }}>
              {new Date(n.createdAt).toLocaleString('ko-KR')}
            </div>
          </div>
        );
      })}
    </div>
  );
}
