import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Request, Response } from 'express';

/**
 * 모든 에러를 { code, message, details? }로 통일한다 (docs/02 §9.1).
 * 문구는 클라이언트가 번역하므로 code가 계약이다.
 *
 * **그리고 전부 로그로 남긴다.**
 *
 * 종전에는 500만 기록했다. 그래서 401·403으로 막힌 요청은 서버 로그에
 * 아무 흔적이 없었고, 화면은 조용히 로그인으로 되돌아갔다 — 사용자도
 * 운영자도 무엇이 막혔는지 알 수 없었다. 실제로 그 상태에서 하루를 썼다.
 *
 * 운영에서도 켜 둔다. 4xx는 대부분 사용자 실수지만, **대량으로 찍히는 4xx는
 * 항상 우리 쪽 문제**다 — 그걸 보려면 평소에 찍히고 있어야 한다.
 */
@Catch()
export class DomainExceptionFilter implements ExceptionFilter {
  private readonly log = new Logger('Exception');

  catch(exception: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const res = http.getResponse<Response>();
    const req = http.getRequest<Request>();
    const where = `${req?.method ?? '?'} ${req?.originalUrl ?? req?.url ?? '?'}`;

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();

      if (typeof body === 'object' && body !== null && 'code' in body) {
        const payload = body as { code: string; details?: unknown };
        this.record(status, where, payload.code, payload.details);
        res.status(status).json(body);
        return;
      }

      // NestJS 기본 예외(검증 실패 등)를 도메인 형태로 감싼다.
      const message = typeof body === 'string' ? body : (body as { message?: unknown }).message;
      const code = status === HttpStatus.BAD_REQUEST ? 'COMMON_VALIDATION_FAILED' : 'COMMON_ERROR';
      this.record(status, where, code, message);
      res.status(status).json({
        code,
        message: 'Request could not be processed',
        details: { reason: message },
      });
      return;
    }

    this.log.error(`500 ${where} — 처리되지 않은 예외`, exception as Error);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      code: 'COMMON_INTERNAL_ERROR',
      message: 'Internal server error',
    });
  }

  /**
   * 한 줄로 남긴다. 사람이 `docker compose logs api`로 읽는 것이 목적이라,
   * 상태·경로·도메인 코드가 한눈에 들어와야 한다.
   *
   * details는 그대로 붙인다 — 여기 들어오는 값은 사유 코드·개수·필드명이지
   * 개인정보가 아니다. 개인정보를 details에 넣지 않는 것이 규칙이고,
   * 그 규칙이 깨지면 여기가 아니라 그 호출부를 고쳐야 한다.
   */
  private record(status: number, where: string, code: string, details: unknown): void {
    const tail = details === undefined ? '' : ` ${safe(details)}`;
    const line = `${status} ${where} → ${code}${tail}`;
    if (status >= 500) this.log.error(line);
    else this.log.warn(line);
  }
}

function safe(details: unknown): string {
  try {
    return JSON.stringify(details);
  } catch {
    return String(details);
  }
}
