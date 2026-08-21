import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Industry, Track } from '@carelink/shared-types';
import { DataTable, KpiChip, KpiRow, PageHeader, Section, StatusPill, Td, Tr } from '@carelink/ui';
import { Shell } from '@/components/Shell';
import { ApiError, apiGet } from '@/lib/api';
import { NewIndustry, NewTrack } from './Forms';

export const dynamic = 'force-dynamic';

const QUAL_LABEL: Record<string, string> = {
  NONE: '무자격 진입 가능',
  TRAINING_REQUIRED: '교육 이수 필요',
  NATIONAL_LICENSE: '국가자격 · 면허 필요',
};

/**
 * SCR-507 산업 · 트랙 · 요건 관리.
 *
 * **이 화면이 버티컬 확장의 실행 창구입니다** (SCR-507 notes). 농업·미용·요리를
 * 추가할 때 개발자가 아니라 운영자가 여기서 산업과 트랙을 열고 요구사항을
 * 정의합니다. 코드 배포가 필요한 경우는 그 산업에 **전용 모듈**(간병 서비스
 * 같은)이 필요할 때뿐입니다.
 *
 * 그래서 이 화면이 없으면 §5.8이 문서로만 존재합니다 — 트랙을 테이블에서
 * 읽도록 만들어 놓고 그 테이블에 행을 넣을 방법이 SQL뿐이면, 결국 개발자가
 * 붙어야 합니다.
 *
 * ── 만드는 것과 여는 것을 분리했습니다 ──────────────────────────────────
 * 산업·트랙은 비활성으로 생성됩니다. 요건이 갖춰지기 전에 열면 후보자가
 * 아무것도 할 수 없는 트랙에 지원합니다. 요건이 하나도 없는 트랙은 아예
 * 열리지 않습니다 — 요건 없는 트랙은 '아무나 배치 가능'과 같은 말이고,
 * 그건 이 플랫폼이 파는 것의 반대입니다.
 */
export default async function TracksPage() {
  let industries: Industry[];
  let tracks: Track[];
  try {
    [industries, tracks] = await Promise.all([
      apiGet<Industry[]>('/admin/industries'),
      apiGet<Track[]>('/admin/tracks'),
    ]);
  } catch (e) {
    if (e instanceof ApiError && (e.status === 401 || e.status === 403)) redirect('/login');
    throw e;
  }

  const openIndustries = industries.filter((i) => i.isActive).length;
  const openTracks = tracks.filter((t) => t.isActive).length;

  return (
    <Shell>
      <PageHeader
        screenId="SCR-507"
        title="산업 · 트랙 · 요건"
        description="새 산업은 여기서 열립니다. 코드 배포가 필요한 것은 전용 모듈이 있는 산업뿐입니다."
      />

      <KpiRow>
        <KpiChip label="산업" value={`${openIndustries} / ${industries.length}`} hint="운영 중 / 전체" />
        <KpiChip label="트랙" value={`${openTracks} / ${tracks.length}`} hint="운영 중 / 전체" />
      </KpiRow>

      <Section title="산업" aside={<NewIndustry />}>
        <DataTable
          columns={[
            { key: 'code', label: '코드', width: 180 },
            { key: 'name', label: '이름' },
            { key: 'status', label: '상태', width: 120 },
          ]}
        >
          {industries.map((i) => (
            <Tr key={i.id}>
              <Td mono>{i.code}</Td>
              <Td>{i.labelKo}</Td>
              <Td>
                <StatusPill
                  tone={i.isActive ? 'signal' : 'neutral'}
                  label={i.isActive ? '운영 중' : '준비 중'}
                />
              </Td>
            </Tr>
          ))}
        </DataTable>
      </Section>

      <Section title="트랙" aside={<NewTrack industries={industries} />}>
        <DataTable
          columns={[
            { key: 'code', label: '코드', width: 200 },
            { key: 'name', label: '이름' },
            { key: 'qual', label: '자격 경로', width: 180 },
            { key: 'reqs', label: '요건', width: 80, align: 'right' },
            { key: 'status', label: '상태', width: 120 },
            { key: 'link', label: '', width: 120 },
          ]}
        >
          {tracks.map((t) => (
            <Tr key={t.id}>
              <Td mono>{t.code}</Td>
              <Td>{t.labelKo}</Td>
              <Td>{QUAL_LABEL[t.qualificationType] ?? t.qualificationType}</Td>
              <Td mono>{t.requirements?.length ?? 0}</Td>
              <Td>
                {/* 요건이 없는데 열려 있으면 그 자체가 사건입니다. */}
                <StatusPill
                  tone={t.isActive ? 'signal' : (t.requirements?.length ?? 0) === 0 ? 'flag' : 'neutral'}
                  label={
                    t.isActive
                      ? '운영 중'
                      : (t.requirements?.length ?? 0) === 0
                        ? '요건 없음'
                        : '준비 중'
                  }
                />
              </Td>
              <Td>
                <Link href={`/tracks/${t.id}`}>요건 · 가중치</Link>
              </Td>
            </Tr>
          ))}
        </DataTable>
      </Section>

      <p style={{ fontSize: 'var(--cl-caption)', color: 'var(--cl-text-muted)', lineHeight: 1.6 }}>
        자격 요건은 <b>시스템이 판정하지 않습니다</b>. 여기 등록하는 것은 &lsquo;무엇을
        확인해야 하는가&rsquo;이고, 확인 결과는 사람이 입력합니다 (§6-1).
      </p>
    </Shell>
  );
}
