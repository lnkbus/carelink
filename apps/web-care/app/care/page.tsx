import Link from 'next/link';
import type { CareRequest } from '@carelink/shared-types';
import { Ask, Page, Row } from '@/components/Page';
import { apiGet } from '@/lib/api';
import { currentUser } from '@/lib/session';
import { fmtDateTime, label } from '@/lib/labels';

export const dynamic = 'force-dynamic';

/**
 * SCR-301 보호자 홈.
 *
 * 진행 중인 건이 하나라도 있으면 그것이 화면의 전부입니다. 보호자가 가장
 * 많이 하는 행동은 "잘 있나 확인"이고 (SCR-306 notes), 신규 신청은 그 다음입니다.
 */
export default async function CareHome() {
  await currentUser();
  const requests = await apiGet<CareRequest[]>('/care-requests/me/list');

  const live = requests.filter((r) => ['SUBMITTED', 'MATCHING', 'OFFER_SENT', 'ASSIGNED', 'IN_SERVICE', 'OPS_REVIEW', 'ISSUE'].includes(r.status));
  const past = requests.filter((r) => !live.includes(r));

  return (
    <Page
      title="케어링크"
      action={
        <Link
          href="/care/me"
          style={{
            marginLeft: 'auto', minHeight: 'var(--cf-tap)', display: 'flex',
            alignItems: 'center', gap: 6, color: 'var(--cl-text-sub)',
            fontSize: 'var(--cf-subtitle)', fontWeight: 600,
          }}
        >
          내 정보
        </Link>
      }
    >
      {/*
        디자인의 홈은 '빈 화면 + 하단 버튼'이 아니라 **큰 문장 + 히어로 버튼**입니다
        (design/README §Patient Web 301). 하단 고정 버튼은 스크롤이 있을 때만
        의미가 있는데, 보호자 홈은 대개 카드 한두 장이라 스크롤이 없습니다.
        그럴 때 하단 고정은 화면 아래쪽에 붕 뜬 버튼으로 보입니다.
      */}
      <Ask sub="병원과 기간만 알려주시면 자격을 확인한 간병사를 연결해 드립니다.">
        간병인이 필요하신가요?
      </Ask>

      <Link className="cf-btn cf-btn-hero" href="/care/hospitals">
        <span aria-hidden="true" style={{ fontSize: 28, lineHeight: 1 }}>＋</span>
        간병 신청하기
      </Link>

      {live.map((r) => (
        <Link
          key={r.id}
          href={hrefFor(r)}
          className="cf-card"
          style={{ color: 'inherit', border: '2px solid var(--cl-action)', borderRadius: 18 }}
        >
          <div className="cf-row">
            <b style={{ fontSize: 'var(--cf-subtitle)' }}>{r.hospitalName ?? '병원 미지정'}</b>
            <span style={{ color: 'var(--cl-action-text)', fontWeight: 600 }}>{label(r.status)}</span>
          </div>
          <Row label="병실">{r.ward ?? '—'}</Row>
          <Row label="시작">{fmtDateTime(r.startAt)}</Row>
          <Row label="교대">{label(r.shiftPatternCode)}</Row>
        </Link>
      ))}

      {past.length > 0 && (
        <Link href="/care/history" className="cf-card" style={{ color: 'inherit' }}>
          <div className="cf-row">
            <h2>지난 이용 내역</h2>
            <span className="cf-label">{past.length}건 ›</span>
          </div>
          {past.slice(0, 3).map((r) => (
            <div key={r.id} className="cf-row">
              <span>{r.hospitalName ?? '—'} · {fmtDateTime(r.startAt)}</span>
              <span className="cf-label">{label(r.status)}</span>
            </div>
          ))}
        </Link>
      )}
    </Page>
  );
}

/**
 * 상태에 따라 갈 곳이 다릅니다.
 *
 * 배정이 끝난 건은 매칭 화면으로 보내면 안 됩니다 — 이미 정해진 것을
 * 다시 고르는 화면이 열리면 보호자는 무언가 잘못됐다고 생각합니다.
 */
function hrefFor(r: CareRequest): string {
  if (['ASSIGNED', 'IN_SERVICE'].includes(r.status)) return `/care/requests/${r.id}/confirm`;
  if (['MATCHING', 'OFFER_SENT'].includes(r.status)) return `/care/requests/${r.id}/match`;
  return `/care/requests/${r.id}/confirm`;
}
