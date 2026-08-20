import { Body, Controller, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { DomainError } from '../../../core/errors/domain-error';
import type { Viewer } from '../../../core/scope/scope.types';
import { Roles } from '../../iam/guard/roles.guard';
import { CurrentViewer } from '../../iam/guard/viewer.decorator';
import { CandidateService } from '../../talent/service/candidate.service';
import { AttributionResultDto, RecordAttributionDto } from '../dto/recruiting.dto';
import { RecruitingService } from '../service/recruiting.service';

/**
 * 유입 출처 기록 (§5.13).
 *
 * channel_id·campaign_id·referred_by가 비어 있으면 채널별 CAC가 나오지 않고,
 * CAC가 없으면 예산 배분이 감으로 이뤄진다. 그래서 경로를 두 개 둔다:
 *   - 후보자 본인: 가입 링크에 실린 채널·캠페인·추천 코드
 *   - 운영자: 링크 없이 들어온 오프라인 유입(설명회·지자체) 보정
 *
 * 두 경로 모두 '먼저 기록된 값이 이긴다'. 마지막에 만진 채널로 성과가 몰리면
 * 실제로 사람을 데려온 채널의 예산이 깎인다.
 */
@Controller()
export class AttributionController {
  constructor(
    private readonly recruiting: RecruitingService,
    private readonly candidates: CandidateService,
  ) {}

  /** POST /api/v1/candidates/me/attribution — 가입 링크에서 넘어온 출처. */
  @Post('candidates/me/attribution')
  async recordMine(
    @CurrentViewer() viewer: Viewer,
    @Body() dto: RecordAttributionDto,
  ): Promise<AttributionResultDto> {
    if (!viewer.userId) throw new DomainError('IAM_TOKEN_INVALID');
    const me = await this.candidates.getOrCreateForUser(viewer.userId);
    const result = await this.recruiting.recordAttribution({
      candidateId: me.id, channelCode: dto.channelCode, campaignId: dto.campaignId,
      referralCode: dto.referralCode, actorUserId: viewer.userId,
    });
    return Object.assign(new AttributionResultDto(), { userId: viewer.userId, ...result });
  }

  /** PATCH /api/v1/admin/recruiting/candidates/{id}/attribution — 오프라인 유입 보정. */
  @Patch('admin/recruiting/candidates/:id/attribution')
  @Roles('ADMIN', 'SUPER_ADMIN')
  async recordForCandidate(
    @CurrentViewer() viewer: Viewer,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RecordAttributionDto,
  ): Promise<AttributionResultDto> {
    const result = await this.recruiting.recordAttribution({
      candidateId: id, channelCode: dto.channelCode, campaignId: dto.campaignId,
      referralCode: dto.referralCode, actorUserId: viewer.userId ?? null,
    });
    return Object.assign(new AttributionResultDto(), { userId: viewer.userId, ...result });
  }
}
