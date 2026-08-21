import { redirect } from 'next/navigation';
import type { ChannelCac, Partner, ReferralStats } from '@carelink/shared-types';
import { DataTable, KpiChip, KpiRow, PageHeader, Section, StatusPill, Td, Tr } from '@carelink/ui';
import { Shell } from '@/components/Shell';
import { ApiError, apiGet } from '@/lib/api';
import { label } from '@/lib/labels';
import { redirectToLogin } from '@/lib/session';

export const dynamic = 'force-dynamic';

const PARTNER_TONE: Record<string, 'signal' | 'flag' | 'alert' | 'neutral'> = {
  ACTIVE: 'signal', MOU_SIGNED: 'signal', IN_TALKS: 'flag', PROSPECT: 'neutral',
  PAUSED: 'flag', TERMINATED: 'alert',
};

const won = (n: number) => n.toLocaleString('ko-KR');

/**
 * SCR-510 파트너 · 채널.
 *
 * CAC가 없으면 예산 배분을 감으로 하게 됩니다 (§5.13). 배치 0명인 채널은 CAC를
 * 계산하지 않고 '아직 없음'으로 둡니다 — 0으로 나눈 값보다 정직합니다.
 *
 * 기존 인력 추천은 채널 표에 섞지 않고 별도 축으로 둡니다. 세그먼트 채널과
 * 직교하고(동포 채널로 들어온 사람이 지인을 데려올 수 있음), 실측상 전환율이
 * 가장 높은 유입 경로라서 다른 채널 뒤에 숨으면 안 됩니다.
 */
export default async function PartnersPage() {
  let channels: ChannelCac[];
  let partners: Partner[];
  let referral: ReferralStats;
  try {
    [channels, partners, referral] = await Promise.all([
      apiGet<ChannelCac[]>('/admin/recruiting/channels/cac'),
      apiGet<Partner[]>('/admin/recruiting/partners'),
      apiGet<ReferralStats>('/admin/recruiting/channels/referrals'),
    ]);
  } catch (e) {
    if (e instanceof ApiError && (e.status === 401 || e.status === 403)) redirectToLogin(e);
    throw e;
  }

  const totalCost = channels.reduce((s, c) => s + c.cost, 0);
  const totalIn = channels.reduce((s, c) => s + c.candidates, 0);
  const totalPlaced = channels.reduce((s, c) => s + c.placed, 0);
  const activePartners = partners.filter((p) => p.status === 'ACTIVE' || p.status === 'MOU_SIGNED').length;

  return (
    <Shell>
      <PageHeader
        title="파트너 · 채널"
        screenId="SCR-510"
        description="채널별 CAC가 나오지 않으면 예산 배분을 할 수 없습니다."
      />
      <div className="cl-body">
        <div style={{ marginTop: 'var(--cl-s6)' }}>
          <KpiRow>
            <KpiChip label="집행 비용" value={won(totalCost)} unit="원" />
            <KpiChip label="유입" value={totalIn} unit="명" />
            <KpiChip label="배치" value={totalPlaced} unit="명" tone={totalPlaced ? 'signal' : 'neutral'} />
            <KpiChip label="파트너" value={partners.length} unit="곳" />
            <KpiChip label="활성 파트너" value={activePartners} unit="곳" tone={activePartners ? 'signal' : 'flag'} />
          </KpiRow>
        </div>

        <Section
          title="채널별 CAC"
          note="배치 0명인 채널은 CAC를 계산하지 않습니다. '아직 없음'과 '0원'은 다른 상태입니다."
        >
          <DataTable
            columns={[
              { key: 'ch', label: '채널' },
              { key: 'cost', label: '비용', align: 'right', width: 130 },
              { key: 'in', label: '유입', align: 'right', width: 90 },
              { key: 'placed', label: '배치', align: 'right', width: 90 },
              { key: 'rate', label: '배치율', width: 170 },
              { key: 'cac', label: 'CAC', align: 'right', width: 130 },
            ]}
            empty="채널이 없습니다"
          >
            {channels.map((c) => {
              const rate = c.candidates > 0 ? Math.round((c.placed / c.candidates) * 1000) / 10 : 0;
              return (
                <Tr key={c.channelCode}>
                  <Td>{c.labelKo}</Td>
                  <Td mono align="right">{won(c.cost)}</Td>
                  <Td mono align="right">{c.candidates}</Td>
                  <Td mono align="right">{c.placed}</Td>
                  <Td>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--cl-s3)' }}>
                      <span style={{ flex: 1, height: 6, borderRadius: 999, background: 'var(--cl-bg-sub)', overflow: 'hidden' }}>
                        <span style={{ display: 'block', height: '100%', width: `${rate}%`, background: 'var(--cl-action)' }} />
                      </span>
                      <span style={{ fontFamily: 'var(--cl-font-mono)', fontSize: 'var(--cl-caption)', color: 'var(--cl-text-muted)' }}>
                        {rate}%
                      </span>
                    </span>
                  </Td>
                  <Td mono align="right" tone={c.cac === null ? 'muted' : undefined}>
                    {c.cac === null ? '— 배치 0명' : `${won(c.cac)}원`}
                  </Td>
                </Tr>
              );
            })}
            <Tr key="__referral" tone="selected">
              <Td>
                기존 인력 추천
                <span style={{ fontSize: 'var(--cl-caption)', color: 'var(--cl-text-muted)', marginLeft: 6 }}>
                  추천인 {referral.referrers}명 · 채널과 직교하는 별도 축
                </span>
              </Td>
              <Td mono align="right" tone="muted">—</Td>
              <Td mono align="right">{referral.candidates}</Td>
              <Td mono align="right">{referral.placed}</Td>
              <Td tone="muted">—</Td>
              <Td mono align="right" tone="muted">보상 정책 미정</Td>
            </Tr>
          </DataTable>
        </Section>

        <Section
          title="파트너"
          note="대학 MOU에는 성과 데이터(참여·수료·취업·이탈률) 정기 제공 의무를 넣습니다 — 교육국제화역량 인증 평가에 쓸 자료이자 다음 기수 협상력의 원천입니다."
        >
          <DataTable
            columns={[
              { key: 'name', label: '파트너' },
              { key: 'type', label: '유형', width: 160 },
              { key: 'region', label: '지역', width: 120 },
              { key: 'status', label: '상태', width: 120 },
              { key: 'signed', label: 'MOU 체결', width: 120 },
              { key: 'expires', label: 'MOU 만료', width: 120 },
              { key: 'contact', label: '담당자', width: 170 },
            ]}
            empty="등록된 파트너가 없습니다"
          >
            {partners.map((p) => (
              <Tr key={p.id} tone={p.status === 'TERMINATED' ? 'alert' : undefined}>
                <Td>{p.name}</Td>
                <Td tone="muted">{label(p.partnerType)}</Td>
                <Td>{p.region ?? '—'}</Td>
                <Td><StatusPill tone={PARTNER_TONE[p.status] ?? 'neutral'} label={label(p.status)} /></Td>
                <Td mono tone="muted">{p.mouSignedOn?.slice(0, 10) ?? '—'}</Td>
                <Td mono tone="muted">{p.mouExpiresOn?.slice(0, 10) ?? '—'}</Td>
                <Td>
                  {p.contactName ?? '—'}
                  {p.contactPhone && (
                    <span style={{ fontFamily: 'var(--cl-font-mono)', color: 'var(--cl-text-muted)', marginLeft: 6 }}>
                      {p.contactPhone}
                    </span>
                  )}
                </Td>
              </Tr>
            ))}
          </DataTable>
        </Section>
      </div>
    </Shell>
  );
}
