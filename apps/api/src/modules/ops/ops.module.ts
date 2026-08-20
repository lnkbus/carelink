import { Global, Module } from '@nestjs/common';
import { AuditService } from './service/audit.service';

/**
 * ops — 운영자 콘솔, 사건·문의, 알림, 감사 로그, 지표 (docs/02 §4).
 *
 * AuditService는 모든 모듈이 쓰므로 @Global로 노출한다. 감사 적재를 위해
 * 모듈마다 ops를 import 하게 만들면 순환 의존이 생긴다.
 */
@Global()
@Module({ providers: [AuditService], exports: [AuditService] })
export class OpsModule {}
