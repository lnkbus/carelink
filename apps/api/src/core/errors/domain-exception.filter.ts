import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import type { Response } from 'express';

/**
 * 모든 에러를 { code, message, details? }로 통일한다 (docs/02 §9.1).
 * 문구는 클라이언트가 번역하므로 code가 계약이다.
 */
@Catch()
export class DomainExceptionFilter implements ExceptionFilter {
  private readonly log = new Logger('Exception');

  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      if (typeof body === 'object' && body !== null && 'code' in body) {
        res.status(status).json(body);
        return;
      }
      // NestJS 기본 예외(검증 실패 등)를 도메인 형태로 감싼다.
      const message = typeof body === 'string' ? body : (body as { message?: unknown }).message;
      res.status(status).json({
        code: status === HttpStatus.BAD_REQUEST ? 'COMMON_VALIDATION_FAILED' : 'COMMON_ERROR',
        message: 'Request could not be processed',
        details: { reason: message },
      });
      return;
    }

    this.log.error('처리되지 않은 예외', exception as Error);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      code: 'COMMON_INTERNAL_ERROR',
      message: 'Internal server error',
    });
  }
}
