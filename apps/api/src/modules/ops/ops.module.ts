import { Global, Module } from '@nestjs/common';
import { TalentModule } from '../talent/talent.module';
import { JobsController } from './controller/jobs.controller';
import { OpsController } from './controller/ops.controller';
import { MetricsRepository } from './repository/metrics.repository';
import { OpsService } from './service/ops.service';
import { ExpiryJobs } from './jobs/expiry.jobs';
import { MatchingJobs } from './jobs/matching.jobs';
import { AuditService } from './service/audit.service';
import { NotificationService } from './service/notification.service';

/**
 * ops — 운영자 콘솔, 사건·문의, 알림, 감사 로그, 지표 (docs/02 §4).
 *
 * AuditService는 모든 모듈이 쓰므로 @Global로 노출한다. 감사 적재를 위해
 * 모듈마다 ops를 import 하게 만들면 순환 의존이 생긴다.
 */
@Global()
@Module({
  imports: [TalentModule],
  controllers: [JobsController, OpsController],
  providers: [AuditService, NotificationService, ExpiryJobs, MatchingJobs, MetricsRepository, OpsService],
  exports: [AuditService, NotificationService],
})
export class OpsModule {}
