import { Injectable, Logger } from '@nestjs/common';
import { DbService } from '../../../core/db/db.service';

export interface ScopeScanHit {
  keyword: string;
  category: string;
  /** 원문에서 감지된 위치. 운영자가 문맥을 보고 판단할 수 있게 남긴다. */
  index: number;
}

export interface ScopeScanResult {
  clean: boolean;
  hits: ScopeScanHit[];
  /** 감지되면 이 상태로 보낸다. 거절이 아니다. */
  action: 'PASS' | 'OPS_REVIEW';
}

/**
 * 업무범위 하드 게이트 (docs/07 §3.3 · CLAUDE.md §6-15).
 *
 * **감지는 거부가 아니라 검토 트리거다.** 자동 거절하면 보호자가 표현을 바꿔
 * 우회하고, 그러면 같은 요구가 감지되지 않은 채 간병사에게 전달된다.
 * 사람이 개입해 "그건 의료행위라 할 수 없습니다"를 설명하는 것이 목적이다.
 *
 * 정형 항목(care_service_items)에는 애초에 의료행위가 없다. 이 스캔은
 * 자유 입력 필드(care_requests.cautions, 상담 메시지)를 대상으로 한다.
 */
@Injectable()
export class ScopeScanService {
  private readonly log = new Logger(ScopeScanService.name);
  private cache: { keyword: string; category: string }[] | null = null;

  constructor(private readonly db: DbService) {}

  /** 사전은 운영하며 확장된다. 배포 없이 행 추가로 늘리므로 캐시를 짧게 둔다. */
  private async dictionary(): Promise<{ keyword: string; category: string }[]> {
    if (this.cache) return this.cache;
    this.cache = await this.db.query<{ keyword: string; category: string }>(
      `SELECT keyword, category FROM restricted_act_keywords WHERE is_active`,
    );
    return this.cache;
  }

  /** 사전이 갱신되면 호출한다. */
  invalidate(): void { this.cache = null; }

  async scan(text: string | null | undefined): Promise<ScopeScanResult> {
    if (!text) return { clean: true, hits: [], action: 'PASS' };
    const dict = await this.dictionary();
    const normalized = text.replace(/\s+/g, ' ');

    const hits: ScopeScanHit[] = [];
    for (const entry of dict) {
      // 공백을 무시하고 찾는다. '약 먹여'와 '약  먹여'가 다르게 취급되면 안 된다.
      const needle = entry.keyword.replace(/\s+/g, ' ');
      let from = 0;
      for (;;) {
        const at = normalized.indexOf(needle, from);
        if (at === -1) break;
        hits.push({ keyword: entry.keyword, category: entry.category, index: at });
        from = at + needle.length;
      }
    }

    if (hits.length > 0) {
      this.log.warn(`업무범위 키워드 감지 ${hits.length}건 — OPS_REVIEW로 보냅니다: ${hits.map((h) => h.keyword).join(', ')}`);
    }
    return { clean: hits.length === 0, hits, action: hits.length > 0 ? 'OPS_REVIEW' : 'PASS' };
  }
}
