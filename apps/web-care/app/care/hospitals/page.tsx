import type { CareHospital } from '@carelink/shared-types';
import { Ask, Page, Notice } from '@/components/Page';
import { apiGet } from '@/lib/api';
import { currentUser } from '@/lib/session';
import { HospitalPicker } from './HospitalPicker';

export const dynamic = 'force-dynamic';

/**
 * SCR-302 병원 검색.
 *
 * **제휴 병원만 나옵니다** (SCR-302 notes). 전국 병원 데이터를 붙이면
 * 커버리지는 넓어지지만 간병사 공급이 없는 지역까지 신청이 들어오고,
 * 그 신청은 전부 취소로 끝납니다. 취소를 겪은 보호자는 돌아오지 않습니다.
 *
 * API가 `activeCaregivers = 0`인 병원을 이미 걸러 내지만, 화면에서도
 * 배정 가능 인원을 보여 줍니다 — 고르기 전에 알 수 있어야 합니다.
 */
export default async function HospitalsPage() {
  await currentUser();
  const hospitals = await apiGet<CareHospital[]>('/care-hospitals');

  return (
    <Page title="간병 신청" back="/care" step={1}>
      <Ask>어느 병원인가요?</Ask>
      {hospitals.length === 0 ? (
        <>
          <div className="cf-empty">지금 신청 가능한 병원이 없습니다.</div>
          <Notice>
            간병사가 배정 가능한 병원만 보여 드립니다. 원하시는 병원이 없으면
            담당자에게 문의해 주세요 — 제휴가 되면 알려 드립니다.
          </Notice>
        </>
      ) : (
        <HospitalPicker hospitals={hospitals} />
      )}
    </Page>
  );
}
