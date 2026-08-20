import { Injectable } from '@nestjs/common';
import type { PiiUnlockPort } from '../../../core/pii/pii-unlock.port';
import { ApplicationRepository } from '../repository/application.repository';

/**
 * PiiUnlockPort의 matching 쪽 구현.
 *
 * 판정 근거인 `interviews`·`jobs`를 소유한 모듈이 답한다. talent는 이 클래스를
 * 모르고 인터페이스만 안다 (core/pii/pii-unlock.port.ts).
 */
@Injectable()
export class MatchingPiiUnlock implements PiiUnlockPort {
  constructor(private readonly repo: ApplicationRepository) {}

  isCandidateUnlockedForOrg(candidateId: string, organizationId: string): Promise<boolean> {
    return this.repo.hasUnlockedInterview(organizationId, candidateId);
  }

  unlockedCandidateIds(organizationId: string, candidateIds: string[]): Promise<Set<string>> {
    return this.repo.unlockedCandidateIds(organizationId, candidateIds);
  }
}
