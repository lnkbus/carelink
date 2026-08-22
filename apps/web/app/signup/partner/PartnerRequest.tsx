'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@carelink/ui';
import { errorLabel } from '@/lib/labels-org';

/**
 * 파트너 제휴 신청 — 버튼 하나입니다.
 *
 * 기관과 달리 입력받을 것이 없습니다. `partners` 행은 신청 시점에 만들지
 * 않기 때문입니다 — 제휴는 계약이고, 계약은 운영자가 확인한 뒤에 존재합니다.
 * 여기서 기관명·담당자를 받아 두면 승인 전의 파트너 목록이 생기고, 그
 * 목록은 아무 근거가 없습니다.
 */
export function PartnerRequest() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <Button
        variant="filled" disabled={busy}
        onClick={async () => {
          setBusy(true); setError(null);
          try {
            const res = await fetch('/api/signup/partner', { method: 'POST' });
            const data = await res.json();
            if (!res.ok) { setError(data.code ?? 'COMMON_INTERNAL_ERROR'); return; }
            router.push('/pending');
            router.refresh();
          } catch { setError('NETWORK'); }
          finally { setBusy(false); }
        }}
      >
        {busy ? '신청하는 중' : '제휴 신청 보내기'}
      </Button>
      {error && (
        <div style={{ marginTop: 'var(--cl-s4)', color: 'var(--cl-alert)', fontSize: 15, lineHeight: 1.6 }}>
          {errorLabel(error)}
        </div>
      )}
    </div>
  );
}
