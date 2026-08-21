import { Module } from '@nestjs/common';
import { EngagementModule } from '../engagement/engagement.module';
import { QualityModule } from '../quality/quality.module';
import { CareController } from './controller/care.controller';
import { CareJobs } from './jobs/care.jobs';
import { ShiftReviewJobs } from './jobs/shift-review.jobs';
import { CareRepository } from './repository/care.repository';
import { CareService } from './service/care.service';

/**
 * care — 간병 요청·배정·서비스 기록 (docs/02 §4 · V2).
 *
 * **버티컬 모듈입니다** (§5.14). 여기의 개념(간병 요청, 병실, 보호자)이
 * 코어로 새어 나가면 농업·미용 같은 신규 산업을 붙일 때 전면 재작업이 됩니다.
 * 코어(engagement · work_records · billing_lines)는 이 모듈을 알지 못합니다.
 */
@Module({
  // 버티컬이 코어를 참조합니다. 반대 방향은 없습니다 — 코어는 care를
  // 알지 못합니다 (§5.14).
  imports: [EngagementModule, QualityModule],
  controllers: [CareController],
  providers: [CareRepository, CareService, CareJobs, ShiftReviewJobs],
  exports: [CareService],
})
export class CareModule {}
