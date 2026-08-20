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
import { MatchingService } from './service/matching.service';

/** matching — 채용 요청, 룰 매칭, 지원, 면접 (docs/02 §4). */
@Global()
@Module({
  imports: [TalentModule],
  controllers: [JobController, ApplicationController],
  providers: [
    JobRepository, MatchRepository, ApplicationRepository,
    MatchEngine, JobService, MatchingService, ApplicationService,
  ],
  exports: [MatchingService, ApplicationService, JobService],
})
export class MatchingModule {}
