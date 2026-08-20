import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);

  // docs/02 §9.1 — Base: /api/v1
  app.setGlobalPrefix('api/v1');

  /**
   * CORS.
   *
   * 브라우저에서 API를 직접 부르는 곳이 둘 있습니다:
   *   - 후보자 앱 웹 빌드 (Flutter) — 모든 호출
   *   - 운영 콘솔·기관 웹의 로그인 화면 — OTP 발송만 (토큰은 서버 라우트가 받습니다)
   *
   * **와일드카드를 쓰지 않습니다.** credentials와 함께 쓰면 브라우저가 거부하고,
   * 무엇보다 이 API는 후보자의 실명·연락처·체류자격을 다룹니다. 허용 출처를
   * 환경변수로 명시하고, 값이 없으면 개발 기본값만 엽니다.
   */
  // localhost와 127.0.0.1은 브라우저에게 **다른 출처**입니다. 둘 다 넣지 않으면
  // 주소창에 무엇을 쳤느냐에 따라 되기도 하고 안 되기도 합니다.
  const defaultOrigins = [3100, 3200, 3300]
    .flatMap((port) => [`http://localhost:${port}`, `http://127.0.0.1:${port}`])
    .join(',');
  const origins = (process.env.CORS_ORIGINS ?? defaultOrigins)
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  app.enableCors({
    origin: origins,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['content-type', 'authorization'],
    maxAge: 600,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  new Logger('Bootstrap').log(`CARELINK API listening on :${port}/api/v1`);
}

void bootstrap();
