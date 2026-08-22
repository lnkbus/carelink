import { Controller, Get, Param, ParseUUIDPipe, Patch, Query } from '@nestjs/common';
import { DomainError } from '../../../core/errors/domain-error';
import type { Viewer } from '../../../core/scope/scope.types';
import { CurrentViewer } from '../../iam/guard/viewer.decorator';
import { NotificationDto, NotificationQueryDto } from '../dto/notification.dto';
import { NotificationService, renderTemplate } from '../service/notification.service';

/**
 * 내 알림.
 *
 * 역할 게이트를 두지 않았습니다 — 로그인한 사람은 누구나 **자기 것만**
 * 봅니다. 그 제한은 `@Scope('self')`와 저장소 질의 두 곳에서 겁니다.
 * 역할로 가르면 역할이 없는 사람(승인 대기 중)이 자기 승인 결과를 못
 * 봅니다. 그 사람이야말로 알림이 가장 필요한 사람입니다.
 */
@Controller('notifications')
export class NotificationController {
  constructor(private readonly notifications: NotificationService) {}

  @Get()
  async list(
    @CurrentViewer() viewer: Viewer,
    @Query() query: NotificationQueryDto,
  ): Promise<NotificationDto[]> {
    if (!viewer.userId) throw new DomainError('IAM_TOKEN_INVALID');
    const rows = await this.notifications.listForUser(viewer.userId, {
      unreadOnly: query.unreadOnly === 'true',
    });
    return rows.map((r) =>
      Object.assign(new NotificationDto(), {
        ownerUserId: viewer.userId,
        id: r.id,
        code: r.code,
        // 치환은 여기서 합니다. 화면마다 하면 화면마다 다르게 틀립니다.
        title: renderTemplate(r.title, r.payload),
        body: renderTemplate(r.body, r.payload),
        channel: r.channel,
        read: r.read_at !== null,
        createdAt: r.created_at,
        payload: r.payload,
      }),
    );
  }

  /**
   * 읽음 처리.
   *
   * 이미 읽은 건을 다시 눌러도 오류로 만들지 않습니다 — 화면이 두 번
   * 부르는 일은 흔하고, 결과는 같습니다.
   */
  @Patch(':id/read')
  async markRead(
    @CurrentViewer() viewer: Viewer,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<{ ok: true }> {
    if (!viewer.userId) throw new DomainError('IAM_TOKEN_INVALID');
    await this.notifications.markRead(id, viewer.userId);
    return { ok: true };
  }
}
