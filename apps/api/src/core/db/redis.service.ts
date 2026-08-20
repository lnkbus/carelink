import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/** Redis. 세션·OTP 챌린지·SLA 타이머·BullMQ 큐에 쓴다 (docs/02 §2). */
@Injectable()
export class RedisService implements OnModuleDestroy {
  readonly client: Redis;

  constructor(@Inject(ConfigService) config: ConfigService) {
    this.client = new Redis(config.get<string>('REDIS_URL')!, { maxRetriesPerRequest: null });
  }

  async onModuleDestroy(): Promise<void> {
    this.client.disconnect();
  }
}
