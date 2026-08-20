import { Module } from '@nestjs/common';
import { CandidateController } from './controller/candidate.controller';
import { CandidateRepository } from './repository/candidate.repository';
import { CandidateService } from './service/candidate.service';

/** talent — 후보자 프로필, 서류 검증, 교육, 커리어 여정 (docs/02 §4). */
@Module({
  controllers: [CandidateController],
  providers: [CandidateRepository, CandidateService],
  exports: [CandidateService],
})
export class TalentModule {}
