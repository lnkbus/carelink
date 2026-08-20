import { Global, Module } from '@nestjs/common';
import { TalentModule } from '../talent/talent.module';
import { ApplicationController } from './controller/application.controller';
import { JobController } from './controller/job.controller';
import { MatchEngine } from './engine/match.engine';
import { ApplicationRepository } from './repository/application.repository';
import { JobRepository } from './repository/job.repository';
import { MatchRepository } from './repository/match.repository';
import { ApplicationService } from './service/application.service';
import { JobService } from './service/job.service';
import { MatchingPiiUnlock } from './service/pii-unlock.adapter';
import { MatchingService } from './service/matching.service';
import { PII_UNLOCK } from '../../core/pii/pii-unlock.port';

/** matching — 채용 요청, 룰 매칭, 지원, 면접 (docs/02 §4). */
@Global()
@Module({
  imports: [TalentModule],
  controllers: [JobController, ApplicationController],
  providers: [
    MatchingPiiUnlock,
    { provide: PII_UNLOCK, useExisting: MatchingPiiUnlock },
    JobRepository, MatchRepository, ApplicationRepository,
    MatchEngine, JobService, MatchingService, ApplicationService,
  ],
  /**
   * PII_UNLOCK은 후보자 프로필을 직렬화하는 모든 곳에서 필요하다.
   * ops의 AuditService와 같은 이유로 @Global 경유로 내보낸다 — 모듈마다
   * import 하게 만들면 하나를 빠뜨렸을 때 그 경로만 조용히 열린다.
   */
  exports: [MatchingService, ApplicationService, JobService, PII_UNLOCK],
})
export class MatchingModule {}
