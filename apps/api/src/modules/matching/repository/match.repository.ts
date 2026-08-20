import { Injectable } from '@nestjs/common';
import { DbService } from '../../../core/db/db.service';
import type { MatchExclusion, MatchResult } from '../engine/match.types';

export interface MatchingRuleRow { rule_code: string; max_points: number; params: Record<string, unknown> }

@Injectable()
export class MatchRepository {
  constructor(private readonly db: DbService) {}

  /** 점수를 코드에 하드코딩하지 않는다. 운영 중 조정이 반드시 발생한다 (§5.5). */
  listActiveRules(): Promise<MatchingRuleRow[]> {
    return this.db.query<MatchingRuleRow>(
      `SELECT rule_code, max_points, params FROM matching_rules WHERE is_active ORDER BY max_points DESC`,
    );
  }

  async saveMatches(jobId: string, results: MatchResult[]): Promise<void> {
    if (results.length === 0) return;
    await this.db.tx(async (client) => {
      for (const r of results) {
        await client.query(
          `INSERT INTO matches (job_id, candidate_id, score, reasons, missing)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (job_id, candidate_id) DO UPDATE
             SET score = EXCLUDED.score, reasons = EXCLUDED.reasons,
                 missing = EXCLUDED.missing, computed_at = now()`,
          [jobId, r.candidateId, r.score, JSON.stringify(r.reasons), JSON.stringify(r.missingRequirements)],
        );
      }
    });
  }

  /**
   * 매칭 판단을 전량 적재한다. Phase 4의 AI 매칭은 이 로그로 학습한다 —
   * 지금 수집하지 않으면 나중에 만들 수 없다 (docs/02 §7.4).
   */
  async logDecisions(
    jobId: string, entries: { candidateId: string; action: string; score: number | null; reason: string | null }[],
    actorId: string | null,
  ): Promise<void> {
    if (entries.length === 0) return;
    await this.db.tx(async (client) => {
      for (const e of entries) {
        await client.query(
          `INSERT INTO match_logs (job_id, candidate_id, action, score_at_time, reason, actor_id)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [jobId, e.candidateId, e.action, e.score, e.reason, actorId],
        );
      }
    });
  }

  listMatches(jobId: string): Promise<{ candidate_id: string; score: number; reasons: unknown; missing: unknown; display_code: string }[]> {
    return this.db.query(
      `SELECT m.candidate_id, m.score, m.reasons, m.missing, c.display_code
         FROM matches m JOIN candidates c ON c.id = m.candidate_id
        WHERE m.job_id = $1 ORDER BY m.score DESC`,
      [jobId],
    );
  }

  /** 제외 사유를 화면에 함께 보여주기 위한 조회 (SCR-504 하단 요약 바). */
  async exclusionSummary(jobId: string): Promise<{ reason: string; count: string }[]> {
    return this.db.query(
      `SELECT reason, count(*)::text AS count FROM match_logs
        WHERE job_id = $1 AND action = 'EXCLUDED' GROUP BY reason ORDER BY count DESC`,
      [jobId],
    );
  }
}
