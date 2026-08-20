import { Module } from '@nestjs/common';
import { CandidateController } from './controller/candidate.controller';
import { DocumentController } from './controller/document.controller';
import { JourneyController } from './controller/journey.controller';
import { CandidateRepository } from './repository/candidate.repository';
import { DocumentRepository } from './repository/document.repository';
import { JourneyRepository } from './repository/journey.repository';
import { TrainingRepository } from './repository/training.repository';
import { CandidateService } from './service/candidate.service';
import { DocumentService } from './service/document.service';
import { JourneyService } from './service/journey.service';
import { TrainingService } from './service/training.service';

/** talent — 후보자 프로필, 서류 검증, 교육, 커리어 여정 (docs/02 §4). */
@Module({
  controllers: [CandidateController, DocumentController, JourneyController],
  providers: [
    CandidateRepository, DocumentRepository, JourneyRepository, TrainingRepository,
    CandidateService, DocumentService, JourneyService, TrainingService,
  ],
  exports: [CandidateService, DocumentService, JourneyService, DocumentRepository],
})
export class TalentModule {}
