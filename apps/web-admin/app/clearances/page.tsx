import { redirect } from 'next/navigation';
import type { Clearance } from '@carelink/shared-types';
import {
  DataTable, ExpiryCountdown, KpiChip, KpiRow, PageHeader, Section, StatusPill, Td, Tr,
} from '@carelink/ui';
import { Shell } from '@/components/Shell';
import { ApiError, apiGet } from '@/lib/api';
import { label } from '@/lib/labels';
import { ScopeScanBox } from './ScopeScanBox';
import { redirectToLogin } from '@/lib/session';

export const dynamic = 'force-dynamic';

const RESULT_TONE: Record<string, 'signal' | 'flag' | 'alert' | 'neutral'> = {
  PASS: 'signal', N_A: 'neutral', PENDING: 'flag', FAIL: 'alert', EXPIRED: 'alert',
};

/**
 * SCR-509 품질 · 안전 게이트.
 *
 * 이 화면이 CARELINK가 파는 것의 실체입니다. 지금 시장에서 간병 사고가 나면
 * 책임지는 곳이 없습니다 — 소개소는 소개만 하고, 협회는 회비만 받고, 병원은
 * 사적 고용이라 관여하지 않습니다.
 *
 * 6개 항목이 전부 PASS여야 배치 가능하고 **운영자가 예외 처리할 수 없습니다** (§5.11).
 * 그래서 이 화면에 '강제 배치'나 '예외 승인' 버튼이 없습니다. 만들면 그 경로가
 * 기본값이 됩니다.
 *
 * 국적은 필터에도 결과에도 없습니다. 거르는 것은 국적이 아니라 검증되지 않은
 * 인력입니다 (§5.10).
 */
export default async function ClearancesPage({
  searchParams,
}: {
  searchParams: { result?: string; expiring?: string };
}) {
  let rows: Clearance[];
  try {
    rows = await apiGet<Clearance[]>('/admin/clearances', {
      result: searchParams.result,
      expiring: searchParams.expiring,
    });
  } catch (e) {
    if (e instanceof ApiError && (e.status === 401 || e.status === 403)) redirectToLogin(e);
    throw e;
  }

  const expired = rows.filter((r) => r.result === 'EXPIRED' || (r.daysToExpiry !== null && r.daysToExpiry < 0));
  const soon = rows.filter((r) => r.daysToExpiry !== null && r.daysToExpiry >= 0 && r.daysToExpiry <= 30);
  const pending = rows.filter((r) => r.result === 'PENDING');
  const failed = rows.filter((r) => r.result === 'FAIL');
  const placedAtRisk = [...expired, ...soon].filter(
    (r) => r.candidateStatus === 'PLACED' || r.candidateStatus === 'MATCHED',
  );

  return (
    <Shell>
      <PageHeader
        title="품질 · 안전 게이트"
        screenId="SCR-509"
        description="6개 항목이 전부 통과해야 배치됩니다. 예외 처리 경로는 없습니다 — 만들면 그 경로가 기본값이 됩니다."
      />
      <div className="cl-body">
        <div style={{ marginTop: 'var(--cl-s6)' }}>
          <KpiRow>
            <KpiChip label="기록된 검사" value={rows.length} unit="건" />
            <KpiChip label="검사 대기" value={pending.length} unit="건" tone={pending.length ? 'flag' : 'neutral'} />
            <KpiChip label="불합격" value={failed.length} unit="건" tone={failed.length ? 'alert' : 'neutral'} />
            <KpiChip label="만료됨" value={expired.length} unit="건" tone={expired.length ? 'alert' : 'neutral'} />
            <KpiChip
              label="배치 중 인력 위험"
              value={placedAtRisk.length}
              unit="건"
              tone={placedAtRisk.length ? 'alert' : 'signal'}
              hint="배치 중인 인력의 검증이 만료되면 무검증 상태로 근무가 계속됩니다"
            />
          </KpiRow>
        </div>

        <Section
          title="클리어런스"
          note="만료 임박은 배치 중인 인력이 먼저 나옵니다. 검사 결과는 사람이 확인해 입력한 값이고, 플랫폼은 판정하지 않습니다."
          aside={
            <div style={{ display: 'flex', gap: 'var(--cl-s2)', fontSize: 'var(--cl-caption)' }}>
              <a href="/clearances" style={{ color: !searchParams.result && !searchParams.expiring ? 'var(--cl-action-text)' : 'var(--cl-text-sub)' }}>전체</a>
              <span style={{ color: 'var(--cl-line-strong)' }}>·</span>
              <a href="/clearances?expiring=30" style={{ color: searchParams.expiring ? 'var(--cl-action-text)' : 'var(--cl-text-sub)' }}>만료 30일 이내</a>
              <span style={{ color: 'var(--cl-line-strong)' }}>·</span>
              <a href="/clearances?result=PENDING" style={{ color: searchParams.result === 'PENDING' ? 'var(--cl-action-text)' : 'var(--cl-text-sub)' }}>검사 대기</a>
              <span style={{ color: 'var(--cl-line-strong)' }}>·</span>
              <a href="/clearances?result=FAIL" style={{ color: searchParams.result === 'FAIL' ? 'var(--cl-action-text)' : 'var(--cl-text-sub)' }}>불합격</a>
            </div>
          }
        >
          <DataTable
            columns={[
              { key: 'code', label: '인력', width: 110 },
              { key: 'type', label: '항목', width: 180 },
              { key: 'result', label: '결과', width: 110 },
              { key: 'expiry', label: '만료', width: 170 },
              { key: 'status', label: '인력 상태', width: 120 },
              { key: 'note', label: '비고' },
            ]}
            empty="조건에 맞는 검사 기록이 없습니다"
          >
            {rows.map((r) => {
              const risky =
                (r.result === 'EXPIRED' || r.result === 'FAIL' ||
                  (r.daysToExpiry !== null && r.daysToExpiry < 0)) &&
                (r.candidateStatus === 'PLACED' || r.candidateStatus === 'MATCHED');
              return (
                <Tr key={r.id} tone={risky ? 'alert' : undefined}>
                  <Td mono>{r.displayCode ?? '—'}</Td>
                  <Td>{label(r.clearanceType)}</Td>
                  <Td><StatusPill tone={RESULT_TONE[r.result] ?? 'neutral'} label={label(r.result)} /></Td>
                  <Td>
                    {r.expiresOn
                      ? <ExpiryCountdown days={r.daysToExpiry} date={r.expiresOn} compact />
                      : <span style={{ color: 'var(--cl-text-disabled)' }}>기한 없음</span>}
                  </Td>
                  <Td tone="muted">{label(r.candidateStatus)}</Td>
                  <Td tone="muted">{r.note ?? '—'}</Td>
                </Tr>
              );
            })}
          </DataTable>
        </Section>

        <Section
          title="업무범위 스캔"
          note="감지는 거절이 아니라 검토 트리거입니다. 자동 거절하면 표현을 바꿔 우회하고, 그러면 같은 요구가 감지되지 않은 채 간병사에게 전달됩니다."
        >
          <div style={{ padding: 'var(--cl-s5)' }}>
            <ScopeScanBox />
          </div>
        </Section>
      </div>
    </Shell>
  );
}
