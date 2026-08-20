import { Module } from '@nestjs/common';
import { EngagementController } from './controller/engagement.controller';
import { EngagementRepository } from './repository/engagement.repository';
import { EngagementService } from './service/engagement.service';
import { EngagementStrategyFactory } from './strategy/engagement-strategy.factory';

/**
 * engagement — 고용 모델, 계약, 컴플라이언스 게이트, 근무 원장, 청구·지급 (docs/02 §4).
 *
 * V1에는 골격만 넣는다. 나중에 끼워 넣으면 배치·정산 로직을 전부 다시 짜야 한다.
 * DirectEmploymentStrategy의 급여 계산은 U1·U2 해결 후 (docs/12 §4).
 */
@Module({
  controllers: [EngagementController],
  providers: [EngagementRepository, EngagementStrategyFactory, EngagementService],
  exports: [EngagementService, EngagementStrategyFactory],
})
export class EngagementModule {}
