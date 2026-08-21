import { PageHeader } from '@carelink/ui';
import { OrgShell } from '@/components/OrgShell';
import { apiGet } from '@/lib/api';
import { currentOrg } from '@/lib/session';
import { JobForm } from './JobForm';

export const dynamic = 'force-dynamic';

interface Track { id: string; code: string; labelKo: string }

/**
 * SCR-202 채용 요청 등록.
 *
 * 트랙은 `tracks` 테이블에서 읽습니다. 상수로 박으면 새 산업을 열 때 배포가
 * 필요해집니다 (§5.8 · §6-10).
 */
export default async function NewJobPage() {
  const org = await currentOrg();
  const tracks = await apiGet<Track[]>('/tracks');

  return (
    <OrgShell orgName={org.name} verificationStatus={org.verificationStatus}>
      <PageHeader
        title="채용 요청 등록"
        screenId="SCR-202"
        description="등록하면 바로 매칭이 돌아갑니다. 결과는 점수와 근거를 함께 보여줍니다."
      />
      <div className="cl-body">
        <JobForm tracks={tracks} />
      </div>
    </OrgShell>
  );
}
