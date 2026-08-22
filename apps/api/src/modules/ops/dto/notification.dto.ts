import { IsBooleanString, IsOptional } from 'class-validator';
import { Scope, ScopeOwner } from '../../../core/scope/scope.decorator';

/**
 * 알림 한 건.
 *
 * **`self`만입니다.** 알림에는 '어느 기관에 지원했다', '어느 서류가 만료된다'가
 * 들어갑니다 — 본인 말고 누구에게도 나갈 이유가 없습니다. 운영자에게도
 * 열지 않았습니다. 운영자가 봐야 하는 것은 알림이 아니라 그 원인이고,
 * 그건 각 화면에 있습니다.
 */
export class NotificationDto {
  @ScopeOwner() ownerUserId: string;

  @Scope('self') id: string;
  /** 화면이 아이콘·이동 경로를 고르는 데 씁니다. 문구는 title·body에 이미 들어 있습니다. */
  @Scope('self') code: string;
  @Scope('self') title: string | null;
  @Scope('self') body: string | null;
  @Scope('self') channel: string;
  @Scope('self') read: boolean;
  @Scope('self') createdAt: Date;
  /**
   * 화면이 다음 행동을 만들 때 쓰는 값 (예: 반려 사유, 기관 이름).
   *
   * 문구 치환은 서버가 이미 했습니다. 여기 남기는 이유는 화면이
   * 문장 밖에서 값을 써야 할 때가 있기 때문입니다 — 반려 사유를
   * 별도 상자에 넣는 것처럼.
   */
  @Scope('self') payload: Record<string, unknown>;
}

export class NotificationQueryDto {
  /** 'true'면 안 읽은 것만. 쿼리스트링이라 문자열로 옵니다. */
  @IsOptional() @IsBooleanString() unreadOnly?: string;
}
