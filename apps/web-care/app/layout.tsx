import type { Metadata, Viewport } from 'next';
import '@carelink/ui/src/tokens/tokens.css';
import './globals.css';

export const metadata: Metadata = {
  title: 'CARELINK 간병 신청',
  description: '병원 간병 신청·진행 확인',
};

/**
 * 확대를 막지 않습니다.
 *
 * `user-scalable=no`는 흔한 기본값이지만 고령 사용자에게는 화면을 못 읽게
 * 만드는 설정입니다. 기본 16px로 충분하게 만들되, 더 크게 보고 싶은 사람을
 * 막지는 않습니다.
 */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css"
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
