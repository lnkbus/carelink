import { Injectable } from '@nestjs/common';
import { DomainError } from '../../../core/errors/domain-error';
import type { Viewer } from '../../../core/scope/scope.types';
import { AuditService } from '../../ops/service/audit.service';
import { TracksService } from '../../tracks/service/tracks.service';
import { CandidateDto, CandidateTrackDto } from '../dto/candidate.dto';
import { CandidateRepository, type CandidateRow, type CandidateTrackRow } from '../repository/candidate.repository';
import { candidateStatusMachine, type CandidateStatus } from '../state/candidate-status.state';

@Injectable()
export class CandidateService {
  constructor(
    private readonly repo: CandidateRepository,
    private readonly tracks: TracksService,
    private readonly audit: AuditService,
  ) {}

  async getById(id: string): Promise<CandidateRow> {
    const row = await this.repo.findById(id);
    if (!row) throw new DomainError('TALENT_CANDIDATE_NOT_FOUND', { candidateId: id });
    return row;
  }

  async getOrCreateForUser(userId: string): Promise<CandidateRow> {
    const existing = await this.repo.findByUserId(userId);
    if (existing) return existing;
    // channel_id·campaign_id·referred_by는 유입 시점에 채워진다.
    // 비어 있으면 채널별 CAC가 나오지 않으므로 recruiting 모듈에서 반드시 넣어야 한다 (§5.13).
    return this.repo.create(userId, null, null, null);
  }

  async updateProfile(candidateId: string, patch: Record<string, unknown>, actorUserId: string | null): Promise<CandidateRow> {
    const before = await this.getById(candidateId);
    await this.repo.updateProfile(candidateId, patch);
    await this.audit.record({
      actorUserId, action: 'STATUS_CHANGE', targetType: 'candidate', targetId: candidateId,
      before: { status: before.status }, after: { patched: Object.keys(patch) },
    });
    return this.getById(candidateId);
  }

  /**
   * 체류자격 기록. 운영자가 확인한 결과를 넣을 뿐 시스템이 판정하지 않는다
   * (CLAUDE.md §6-1 · §6-11 · docs/06 §9.3).
   */
  async recordVisaVerification(
    candidateId: string, visaStatusCode: string, visaExpiresOn: string | null, actorUserId: string,
  ): Promise<CandidateRow> {
    const before = await this.getById(candidateId);
    await this.repo.recordVisaVerification(candidateId, visaStatusCode, visaExpiresOn, actorUserId);
    await this.audit.record({
      actorUserId, action: 'STATUS_CHANGE', targetType: 'candidate', targetId: candidateId,
      before: { visaStatusCode: before.visa_status_code, visaExpiresOn: before.visa_expires_on },
      after: { visaStatusCode, visaExpiresOn },
    });
    return this.getById(candidateId);
  }

  async changeStatus(candidateId: string, to: CandidateStatus, actorUserId: string | null): Promise<void> {
    const before = await this.getById(candidateId);
    candidateStatusMachine.assert(before.status, to);
    await this.repo.updateStatus(candidateId, to);
    await this.audit.record({
      actorUserId, action: 'STATUS_CHANGE', targetType: 'candidate', targetId: candidateId,
      before: { status: before.status }, after: { status: to },
    });
  }

  async selectTrack(candidateId: string, trackId: string, isPrimary: boolean): Promise<CandidateTrackRow[]> {
    const track = await this.tracks.getTrack(trackId);
    if (!track.is_active) throw new DomainError('TALENT_TRACK_NOT_ACTIVE', { trackId, trackCode: track.code });
    await this.repo.addTrack(candidateId, trackId, isPrimary);
    return this.repo.listTracks(candidateId);
  }

  async removeTrack(candidateId: string, trackId: string): Promise<CandidateTrackRow[]> {
    await this.repo.removeTrack(candidateId, trackId);
    return this.repo.listTracks(candidateId);
  }

  listTracks(candidateId: string): Promise<CandidateTrackRow[]> {
    return this.repo.listTracks(candidateId);
  }

  /**
   * 응답 DTO 조립. 필드 필터링은 여기서 하지 않는다 — @Scope가 직렬화 단계에서 자른다.
   * 여기서는 기관용 치환값(employable)만 만들어 넣는다.
   */
  async toDto(row: CandidateRow, viewer: Viewer): Promise<CandidateDto> {
    const tracks = await this.repo.listTracks(row.id);
    const primaryTrackId = tracks.find((t) => t.is_primary)?.track_id ?? tracks[0]?.track_id ?? null;

    // 기관에는 체류자격 코드 대신 '취업 가능 여부'만 준다 (CLAUDE.md §6-12).
    let employable: boolean | null = null;
    let employabilityReasonKey: string | null = null;
    if (primaryTrackId) {
      const check = await this.tracks.checkVisaEligibility(primaryTrackId, row.visa_status_code);
      employable = check.eligibility === 'ALLOWED';
      employabilityReasonKey = check.reasonKey;
    }

    // 개인정보 조회는 전량 감사 로그에 남긴다 (docs/11 §5).
    // 본인 조회는 제외한다 — 본인이 자기 프로필을 보는 것까지 적재하면 신호가 묻힌다.
    const isSelf = viewer.userId === row.user_id;
    if (!isSelf && (viewer.scopes.includes('admin') || viewer.scopes.includes('org'))) {
      await this.audit.recordPiiView(viewer.userId, 'candidate', row.id, ['name', 'birthDate', 'phone']);
    }

    return Object.assign(new CandidateDto(), {
      ownerUserId: row.user_id,
      id: row.id,
      displayCode: row.display_code,
      name: row.name,
      birthDate: toDateString(row.birth_date),
      phone: row.phone ?? null,
      nationality: row.nationality,
      visaStatusCode: row.visa_status_code,
      visaExpiresOn: toDateString(row.visa_expires_on),
      visaExpiresInDays: daysUntil(row.visa_expires_on),
      employable,
      employabilityReasonKey,
      gender: row.gender,
      currentLocation: row.current_location,
      preferredRegions: row.preferred_regions,
      employmentTypes: row.employment_types,
      dormRequired: row.dorm_required,
      availableFrom: toDateString(row.available_from),
      status: row.status,
      tracks: tracks.map(toTrackDto),
      assigneeId: row.assignee_id,
      channelId: row.channel_id,
      campaignId: row.campaign_id,
      referredBy: row.referred_by,
      tags: row.tags,
    });
  }
}

function toTrackDto(t: CandidateTrackRow): CandidateTrackDto {
  return Object.assign(new CandidateTrackDto(), {
    trackId: t.track_id,
    trackCode: t.track_code,
    labelKo: t.label_ko,
    isPrimary: t.is_primary,
    // 자격 상태는 교육·자격 이력에서 산출한다. 지금은 선택 여부까지만 안다.
    qualificationState: 'SELECTED',
  });
}

function toDateString(d: Date | null): string | null {
  return d ? d.toISOString().slice(0, 10) : null;
}

/** 만료까지 남은 일수. 화면은 날짜가 아니라 D-42 형태로 보여준다 (docs/09 §4.1-5). */
function daysUntil(d: Date | null): number | null {
  if (!d) return null;
  const today = new Date();
  const utcToday = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const utcTarget = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return Math.round((utcTarget - utcToday) / 86_400_000);
}
