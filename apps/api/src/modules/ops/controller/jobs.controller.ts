import { Controller, Get, Param, Post } from '@nestjs/common';
import { JOBS, type JobName } from '../../../core/queue/queue.constants';
import { QueueService } from '../../../core/queue/queue.service';
import { Roles } from '../../iam/guard/roles.guard';

/**
 * 백그라운드 잡 상태 조회와 수동 실행. 운영자 전용.
 *
 * 만료 알림이 멈춘 것은 화면 어디에도 드러나지 않는다. 운영자가 등록 현황을
 * 확인하고 즉시 돌려볼 수 있어야 한다.
 */
@Controller('admin/jobs')
@Roles('ADMIN', 'SUPER_ADMIN')
export class JobsController {
  constructor(private readonly queue: QueueService) {}

  @Get()
  list(): { name: string; cron: string | null; implemented: boolean }[] {
    const implemented = new Set(this.queue.registeredJobs());
    return Object.values(JOBS).map((j) => ({
      name: j.name,
      cron: j.cron,
      implemented: implemented.has(j.name),
    }));
  }

  @Post(':name/run')
  async run(@Param('name') name: string): Promise<unknown> {
    return this.queue.runNow(name as JobName);
  }
}
