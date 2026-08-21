import { redirect } from 'next/navigation';
import type { Track, TrackWeights } from '@carelink/shared-types';
import { PageHeader, Section, StatusPill } from '@carelink/ui';
import { Shell } from '@/components/Shell';
import { ApiError, apiGet } from '@/lib/api';
import { RequirementEditor, WeightEditor, ActiveToggle } from './Editors';

export const dynamic = 'force-dynamic';

/**
 * SCR-507 상세 — 요건과 매칭 가중치.
 *
 * ── 요건 ────────────────────────────────────────────────────────────────
 * **시스템이 판정하지 않습니다** (SCR-507 notes · §6-1). 여기 등록하는 것은
 * '무엇을 확인해야 하는가'이고, 확인 결과는 사람이 입력합니다. 그래서 요건
 * 행에 합격/불합격 필드가 없습니다.
 *
 * ── 가중치 ──────────────────────────────────────────────────────────────
 * 점수를 코드에 박지 않는 이유가 이 화면입니다 (§5.5). 운영 중 조정이 반드시
 * 발생하고, 그때마다 배포하면 조정을 안 하게 됩니다.
 *
 * 배점은 0~100으로 제한합니다. 한 룰에 1000점을 주면 나머지가 사실상 무시되고,
 * 그러면 룰 기반 매칭을 쓰는 이유(근거를 설명할 수 있음)가 사라집니다.
 */
export default async function TrackDetailPage({ params }: { params: { id: string } }) {
  let track: Track;
  let weights: TrackWeights;
  try {
    [track, weights] = await Promise.all([
      apiGet<Track>(`/tracks/${params.id}`),
      apiGet<TrackWeights>(`/admin/tracks/${params.id}/weights`),
    ]);
  } catch (e) {
    if (e instanceof ApiError && (e.status === 401 || e.status === 403)) redirect('/login');
    throw e;
  }

  const reqs = track.requirements ?? [];

  return (
    <Shell>
      <PageHeader
        screenId="SCR-507"
        title={track.labelKo}
        description={track.code}
        actions={
          <StatusPill
            tone={track.isActive ? 'signal' : 'neutral'}
            label={track.isActive ? '운영 중' : '준비 중'}
          />
        }
      />

      <Section
        title="공개 여부"
        note="요건이 하나도 없는 트랙은 열리지 않습니다. 요건 없는 트랙은 '아무나 배치 가능'과 같은 말입니다."
      >
        <ActiveToggle trackId={track.id} isActive={track.isActive} requirementCount={reqs.length} />
      </Section>

      <Section
        title="요건"
        note="시스템이 판정하지 않습니다. 무엇을 확인해야 하는가만 정의하고, 확인 결과는 사람이 입력합니다."
      >
        <RequirementEditor trackId={track.id} initial={reqs} />
      </Section>

      <Section
        title="매칭 가중치"
        note="점수는 코드가 아니라 이 표에서 옵니다. 배점은 0~100 — 한 룰이 나머지를 덮으면 근거를 설명할 수 없습니다."
      >
        <WeightEditor trackId={track.id} initial={weights.weights} />
      </Section>

      {track.visaTypes && track.visaTypes.length > 0 && (
        <Section
          title="관련 체류자격"
          note="표시·필터용입니다. 실제 허용 여부는 track_visa_eligibility가 정하고, 회색 영역은 사람이 확인합니다 (§6-11)."
        >
          <div style={{ display: 'flex', gap: 'var(--cl-s2)', flexWrap: 'wrap' }}>
            {track.visaTypes.map((v) => (
              <span
                key={v}
                style={{
                  fontFamily: 'var(--cl-font-mono)', fontSize: 'var(--cl-caption)',
                  border: '1px solid var(--cl-line)', borderRadius: 'var(--cl-r-chip)',
                  padding: '2px var(--cl-s3)',
                }}
              >
                {v}
              </span>
            ))}
          </div>
        </Section>
      )}
    </Shell>
  );
}
