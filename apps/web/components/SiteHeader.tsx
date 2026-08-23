import Link from 'next/link';
import { Icon } from '@/components/Icon';

/**
 * 공용 헤더 (시안 `SCR-002-HDR` · `data-shared="GLOBAL-HEADER"`).
 *
 * ── 왜 공용인가 ──────────────────────────────────────────────────────
 * 시안이 이 헤더에 `data-shared`를 달아 둔 것이 요점입니다. 인트로와
 * 가입 화면이 같은 헤더를 쓰면, 신청하다 멈춘 사람이 로고를 눌러 처음으로
 * 돌아갈 수 있습니다. 종전 가입 화면에는 헤더가 아예 없어서 **뒤로 갈
 * 길이 브라우저 뒤로가기뿐**이었습니다.
 *
 * ── 로케일 전환기를 여기 두지 않았습니다 ─────────────────────────────
 * 시안 헤더에는 `KO` 버튼이 있지만, DESK는 한국어 전용입니다
 * (AdminShell 하단 안내와 같은 결정). 눌러도 아무 일이 없는 버튼을 두면
 * 그것이 고장으로 읽힙니다. 다국어가 필요한 인트로는 자기 헤더에서
 * 전환기를 직접 그립니다.
 */
export function SiteHeader({
  landing, cta = true,
}: {
  landing?: string | null;
  /**
   * 오른쪽 버튼을 띄울지. 대기 화면처럼 **누를 곳이 지금 있는 곳**인
   * 화면에서는 끕니다 — '내 화면으로'를 눌렀는데 같은 화면이면 고장으로
   * 읽힙니다. 그 화면들은 카드 안에 로그아웃을 따로 갖고 있습니다.
   */
  cta?: boolean;
}) {
  return (
    <header className="cl-sh" data-block="SCR-002-HDR">
      <div className="cl-sh-in">
        {/* 시안 `data-action="NAV-HOME"` → 인트로 */}
        <Link href="/" className="cl-sh-brand">
          <span className="cl-sh-mark" aria-hidden="true">
            <Icon name="check" size={18} stroke={2.4} />
          </span>
          CareLink
        </Link>
        {/* 시안 `data-action="AUTH-LOGIN"`. 이미 로그인했으면 자기 화면으로 —
            로그인한 사람에게 '로그인'을 보여 주면 지금 상태를 의심하게 됩니다. */}
        {cta && (
          <Link href={landing ?? '/login'} className="cl-sh-cta">
            {landing ? '내 화면으로' : '로그인'}
          </Link>
        )}
      </div>
    </header>
  );
}
