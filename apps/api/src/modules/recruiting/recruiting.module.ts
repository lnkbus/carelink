import { Module } from '@nestjs/common';
import { TalentModule } from '../talent/talent.module';
import { AttributionController } from './controller/attribution.controller';
import { RecruitingController } from './controller/recruiting.controller';
import { RecruitingRepository } from './repository/recruiting.repository';
import { RecruitingService } from './service/recruiting.service';

/** recruiting — 파트너, 채널, 캠페인, 코호트 파이프라인 (docs/02 §4). */
@Module({
  // 채널·캠페인·추천 코드 해석은 recruiting이, 기록은 talent가 한다 (§5.1).
  imports: [TalentModule],
  controllers: [RecruitingController, AttributionController],
  providers: [RecruitingRepository, RecruitingService],
  exports: [RecruitingService],
})
export class RecruitingModule {}
