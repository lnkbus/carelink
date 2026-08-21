import { Inject, Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, Worker, type Job, type Processor } from 'bullmq';
import { RedisService } from '../db/redis.service';
import { JOBS, QUEUE_NAME, type JobName } from './queue.constants';

/**
 * BullMQ 큐·워커. docs/02 §2 — Redis + BullMQ로 반복 잡과 SLA 타이머를 돌린다.
 *
 * 반복 잡은 부팅 시 등록한다. 등록을 잊으면 만료 알림이 조용히 멈추는데,
 * 그 상태는 화면 어디에도 드러나지 않으므로 코드로 고정한다.
 */
@Injectable()
export class QueueService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly log = new Logger(QueueService.name);
  private queue: Queue | null = null;
  private readonly workers: Worker[] = [];
  private readonly handlers = new Map<string, Processor>();
  private readonly enabled: boolean;

  constructor(
    private readonly redis: RedisService,
    @Inject(ConfigService) config: ConfigService,
  ) {
    // 테스트·단발성 실행에서는 워커를 띄우지 않는다.
    this.enabled = config.get<string>('QUEUE_ENABLED') !== 'false';
  }

  /** 모듈이 자기 잡 처리기를 등록한다. */
  register(job: JobName, processor: Processor): void {
    this.handlers.set(job, processor);
  }

  /**
   * onModuleInit이 아니라 onApplicationBootstrap에서 띄운다.
   * 처리기는 각 모듈의 onModuleInit에서 register()로 붙는데, QueueModule이
   * 루트에서 먼저 초기화되므로 onModuleInit 시점에는 아직 아무것도 등록돼 있지 않다.
   */
  async onApplicationBootstrap(): Promise<void> {
    if (!this.enabled) {
      this.log.warn('QUEUE_ENABLED=false — 백그라운드 잡을 띄우지 않습니다');
      return;
    }
    const connection = this.redis.client;
    this.queue = new Queue(QUEUE_NAME, { connection });

    for (const spec of Object.values(JOBS)) {
      if (!spec.cron) continue;
      await this.queue.upsertJobScheduler(spec.name, { pattern: spec.cron }, { name: spec.name });
    }

    const worker = new Worker(
      QUEUE_NAME,
      async (job: Job) => {
        const handler = this.handlers.get(job.name);
        if (!handler) {
          this.log.warn(`처리기가 등록되지 않은 잡: ${job.name}`);
          return;
        }
        return handler(job, undefined as never);
      },
      { connection, concurrency: 4 },
    );
    worker.on('failed', (job, err) => this.log.error(`잡 실패: ${job?.name}`, err));
    this.workers.push(worker);

    const repeating = Object.values(JOBS).filter((j) => j.cron).length;
    const total = Object.keys(JOBS).length;
    this.log.log(
      `백그라운드 잡: 정의 ${total}종 · 반복 스케줄 ${repeating}종 · 처리기 구현 ${this.handlers.size}종`,
    );
    // inline 잡은 큐를 타지 않습니다 (scope-keyword-scan — 요청 생성 시점의
    // 동기 게이트). 여기서 걸러 두지 않으면 매번 미구현으로 보고돼,
    // 진짜 미구현이 생겼을 때 눈에 띄지 않습니다.
    const missing = Object.values(JOBS)
      .filter((j) => !('inline' in j && j.inline))
      .map((j) => j.name)
      .filter((n) => !this.handlers.has(n));
    if (missing.length > 0) {
      // 미구현 잡을 조용히 두면 만료 알림이 멈춘 것을 아무도 모른다.
      this.log.warn(`처리기 미구현: ${missing.join(', ')}`);
    }
  }

  /** 즉시 실행. 검증과 운영자 수동 실행에 쓴다. */
  async runNow(job: JobName): Promise<unknown> {
    const handler = this.handlers.get(job);
    if (!handler) throw new Error(`처리기가 없습니다: ${job}`);
    return handler({ name: job, data: {} } as Job, undefined as never);
  }

  registeredJobs(): string[] {
    return [...this.handlers.keys()];
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.all(this.workers.map((w) => w.close()));
    await this.queue?.close();
  }
}
