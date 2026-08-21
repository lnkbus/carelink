import { Controller, Delete, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { DomainError } from '../../../core/errors/domain-error';
import type { Viewer } from '../../../core/scope/scope.types';
import { CurrentViewer } from '../guard/viewer.decorator';
import { UserService } from '../service/user.service';

/**
 * SCR-110 마이페이지 — 탈퇴 요청·철회.
 *
 * ── 왜 즉시 삭제가 아닌가 ──────────────────────────────────────────────
 * 탈퇴는 **요청**이고, 30일 뒤에 `data-retention-purge`가 익명화합니다
 * (docs/11 §4). 그 사이 철회하면 되돌아옵니다. 즉시 지우면 실수로 누른
 * 사람이 돌아올 방법이 없고, 분쟁 중인 건의 사실관계도 함께 사라집니다.
 *
 * ── 왜 지우지 않고 익명화인가 ─────────────────────────────────────────
 * 근무 기록·감사 로그·동의 이력이 이 사용자 id를 참조하고, 그것들은
 * 파기 대상이 아닙니다 (§5.4). 식별자만 무효화합니다.
 */
@Controller('users')
export class UserController {
  constructor(private readonly users: UserService) {}

  /**
   * DELETE /api/v1/users/{id} — 탈퇴 요청 (SCR-110).
   *
   * 본인만 할 수 있습니다. 운영자 대행 탈퇴는 경로를 두지 않았습니다 —
   * 본인 의사 확인이 없는 탈퇴는 나중에 증명할 방법이 없습니다.
   */
  @Delete(':id')
  @HttpCode(204)
  async requestWithdrawal(
    @CurrentViewer() viewer: Viewer,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    this.assertSelf(viewer, id);
    await this.users.changeStatus(id, 'WITHDRAWAL_REQUESTED');
  }

  /**
   * POST /api/v1/users/{id}/restore — 탈퇴 철회.
   *
   * 상태머신이 `WITHDRAWAL_REQUESTED → ACTIVE`를 허용하는데 경로가 없으면
   * 그 전이는 존재하지 않는 것과 같습니다. 익명화가 끝난 뒤에는 복구되지
   * 않으므로 30일이 실질적인 기한입니다.
   */
  @Post(':id/restore')
  @HttpCode(204)
  async restore(
    @CurrentViewer() viewer: Viewer,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<void> {
    this.assertSelf(viewer, id);
    await this.users.changeStatus(id, 'ACTIVE');
  }

  private assertSelf(viewer: Viewer, id: string): void {
    if (viewer.userId !== id) {
      throw new DomainError('IAM_ROLE_FORBIDDEN', {
        reason: 'withdrawal is a personal decision; it cannot be made on someone else\'s behalf',
      });
    }
  }
}
