import { Injectable } from '@nestjs/common';
import { BrokerageStrategy } from './brokerage.strategy';
import { DelegationStrategy } from './delegation.strategy';
import { DirectEmploymentStrategy } from './direct-employment.strategy';
import type { EngagementModel, EngagementStrategy } from './engagement.strategy';

/**
 * 모델 → Strategy. 호출부는 이 팩토리만 쓴다.
 *
 *   ❌  if (model === 'DIRECT_EMPLOYMENT') { ... }
 *   ✅  factory.get(model).calculatePayout(records, ctx)
 */
@Injectable()
export class EngagementStrategyFactory {
  private readonly strategies = new Map<EngagementModel, EngagementStrategy>([
    ['DIRECT_EMPLOYMENT', new DirectEmploymentStrategy()],
    ['DELEGATION', new DelegationStrategy()],
    ['BROKERAGE', new BrokerageStrategy()],
  ]);

  get(model: EngagementModel): EngagementStrategy {
    const strategy = this.strategies.get(model);
    if (!strategy) throw new Error(`구현되지 않은 고용 모델: ${model}`);
    return strategy;
  }

  all(): EngagementStrategy[] { return [...this.strategies.values()]; }
}
