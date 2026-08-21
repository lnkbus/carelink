import type { Metadata } from 'next';
import '@carelink/ui/src/tokens/tokens.css';
import '@carelink/ui/src/tokens/desk.css';
import './globals.css';

export const metadata: Metadata = {
  title: 'CARELINK Admin Console',
  description: '돌봄·의료 인력 운영 콘솔',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        {/* 프로덕션에서는 셀프 호스팅 권장 (design/README §Assets) */}
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
