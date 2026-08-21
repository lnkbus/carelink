import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { JOBS } from '../../../core/queue/queue.constants';
import { QueueService } from '../../../core/queue/queue.service';
import type { JobResult } from '../../ops/jobs/expiry.jobs';
import { NotificationService } from '../../ops/service/notification.service';
import { CareRepository } from '../repository/care.repository';
import { CARE_ASSIGNMENT_SLA_HOURS } from '../state/care.state';

/**
 * 간병 배정 SLA (CLAUDE.md §7).
 *
 * 요청 후 4시간 안에 배정되지 않으면 `ISSUE`로 올리고 운영자에게 알립니다.
 *
 * **없으면 보호자가 밤새 기다립니다.** 대개 입원 당일에 신청하는데, 아무 응답이
 * 없으면 다른 경로를 찾고 한번 떠난 보호자는 돌아오지 않습니다.
 *
 * 10분마다 도는 이유: 4시간 SLA에 1시간 주기로 돌면 최악의 경우 5시간이 됩니다.
 */
@Injectable()
export class CareJobs implements OnModuleInit {
  private readonly log = new Logger(CareJobs.name);

  constructor(
    private readonly queue: QueueService,
    private readonly repo: CareRepository,
    private readonly notifications: NotificationService,
  ) {}

  onModuleInit(): void {
    this.queue.register(JOBS.CARE_ASSIGNMENT_SLA.name, () => this.careAssignmentSla());
  }

  async careAssignmentSla(): Promise<JobResult> {
    const rows = await this.repo.overdueRequests();
    let acted = 0;
    let skipped = 0;

    for (const row of rows) {
      // 이미 ISSUE면 다시 올리지 않습니다. 알림만 하루 한 번.
      const dedupeKey = `${row.id}:${row.sla_due_at?.toISOString().slice(0, 10)}`;
      if (await this.notifications.sentToday(row.requester_id, 'CARE_SLA_BREACHED', dedupeKey)) {
        skipped++;
        continue;
      }

      if (row.status !== 'ISSUE') {
        await this.repo.setRequestStatus(row.id, 'ISSUE');
      }

      const overdueHours = row.sla_due_at
        ? Math.round((Date.now() - row.sla_due_at.getTime()) / 3_600_000)
        : 0;

      await this.notifications.enqueue(row.requester_id, 'CARE_SLA_BREACHED', {
        dedupeKey,
        careRequestId: row.id,
        hospitalName: row.hospital_name,
        ward: row.ward,
        slaHours: CARE_ASSIGNMENT_SLA_HOURS,
        overdueHours,
        // 업무범위 검토로 막힌 건인지 공급이 없는 건인지 구분해야
        // 운영자가 다른 행동을 합니다.
        blockedByScope: (row.restricted_flags?.length ?? 0) > 0,
      });
      acted++;
    }

    if (rows.length > 0) {
      this.log.warn(`care-assignment-sla: SLA 초과 ${rows.length}건 · ISSUE 전이 ${acted}건`);
    }
    return { job: JOBS.CARE_ASSIGNMENT_SLA.name, scanned: rows.length, acted, skipped };
  }
}
