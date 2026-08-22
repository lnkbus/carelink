/**
 * 아이콘 — Lucide (ISC License).
 *
 * 시안의 인라인 SVG는 전부 **플레이스홀더**였습니다 (핸드오프 §Fidelity).
 * 24×24 뷰박스 · stroke 2 · round cap/join 규격만 맞춰 그린 임시 도형이라
 * 하나씩 보면 그럴듯한데 나란히 놓으면 굵기와 곡률이 제각각입니다.
 *
 * 패키지를 넣지 않고 path만 인라인합니다 — 여기 쓰는 아이콘이 10종뿐이고,
 * 의존성 하나가 늘면 버전·트리셰이킹·번들 크기를 계속 신경 써야 합니다.
 * 더 필요해지면 그때 `lucide-react`로 옮기세요. 규격이 같아 그대로 대체됩니다.
 */
const PATHS: Record<string, React.ReactNode> = {
  check: <path d="M20 6 9 17l-5-5" />,
  globe: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
      <path d="M2 12h20" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </>
  ),
  user: (
    <>
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </>
  ),
  heart: (
    <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
  ),
  building: (
    <>
      <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" />
      <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" />
      <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" />
      <path d="M10 6h4M10 10h4M10 14h4M10 18h4" />
    </>
  ),
  chevronRight: <path d="m9 18 6-6-6-6" />,
  camera: (
    <>
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
      <circle cx="12" cy="13" r="3" />
    </>
  ),
  alert: (
    <>
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </>
  ),
  circleCheck: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
};

export type IconName = keyof typeof PATHS;

export function Icon({
  name, size = 24, stroke = 2, className,
}: {
  name: IconName;
  size?: number;
  /** 시안 규격은 2.2입니다. 작은 크기에서는 2로 낮춰야 뭉개지지 않습니다. */
  stroke?: number;
  className?: string;
}) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}
