import type { CareServiceItem } from '@carelink/shared-types';
import { Page } from '@/components/Page';
import { apiGet } from '@/lib/api';
import { currentUser } from '@/lib/session';
import { RequestForm } from './RequestForm';

export const dynamic = 'force-dynamic';

/**
 * SCR-303 간병 신청.
 *
 * ── 의료행위가 화면에 없습니다 ─────────────────────────────────────────
 * 지원 항목은 `GET /care-services/catalog`에서 옵니다. 카탈로그에 투약·주사·
 * 석션·처치가 **항목 자체로 존재하지 않습니다** (§6-2). 화면에 상수 배열을
 * 두면 그 배열이 곧 카탈로그가 되므로, 여기서는 목록을 만들지 않습니다.
 *
 * ── 자유 입력은 막지 않습니다 ──────────────────────────────────────────
 * 특이사항 칸은 열어 둡니다. 서버가 `restricted_act_keywords`로 스캔하고
 * 감지되면 `OPS_REVIEW`로 보냅니다. **자동 거절하지 않습니다** (§6-15) —
 * 거절하면 보호자가 표현을 바꿔 우회하고, 그러면 간병사에게 그대로
 * 전달됩니다. 사람이 설명하는 것이 목적입니다.
 */
export default async function NewRequestPage({
  searchParams,
}: {
  searchParams: { hospitalId?: string; name?: string };
}) {
  await currentUser();
  const catalog = await apiGet<CareServiceItem[]>('/care-services/catalog');

  return (
    <Page title="간병 신청" back="/care/hospitals">
      <RequestForm
        catalog={catalog}
        hospitalId={searchParams.hospitalId ?? ''}
        hospitalName={searchParams.name ?? ''}
      />
    </Page>
  );
}
