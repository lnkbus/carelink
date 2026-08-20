import { Injectable } from '@nestjs/common';
import { DbService } from '../../../core/db/db.service';

export interface TrackMetricRow {
  track_code: string; track_label: string;
  candidates: string; ready: string; matched: string; placed: string;
  open_jobs: string; applications: string;
  avg_days_to_fill: string | null;
}

/**
 * 운영 지표. **모든 지표를 트랙별로 분리 집계한다** (§5.8 · SCR-501 notes).
 *
 * 합산 지표만 만들면 어느 트랙이 통했는지 영영 알 수 없다. MVP가 3개 트랙을
 * 동시에 운영하는 이상 이건 선택이 아니다.
 */
@Injectable()
export class MetricsRepository {
  constructor(private readonly db: DbService) {}

  byTrack(): Promise<TrackMetricRow[]> {
    return this.db.query<TrackMetricRow>(
      `SELECT t.code AS track_code,
              t.label_ko AS track_label,
              (SELECT count(*) FROM candidate_tracks ct WHERE ct.track_id = t.id)::text AS candidates,
              (SELECT count(*) FROM candidate_tracks ct JOIN candidates c ON c.id = ct.candidate_id
                WHERE ct.track_id = t.id AND c.status = 'READY')::text AS ready,
              (SELECT count(*) FROM candidate_tracks ct JOIN candidates c ON c.id = ct.candidate_id
                WHERE ct.track_id = t.id AND c.status = 'MATCHED')::text AS matched,
              (SELECT count(*) FROM candidate_tracks ct JOIN candidates c ON c.id = ct.candidate_id
                WHERE ct.track_id = t.id AND c.status = 'PLACED')::text AS placed,
              (SELECT count(*) FROM jobs j WHERE j.track_id = t.id AND j.status = 'OPEN')::text AS open_jobs,
              (SELECT count(*) FROM applications a JOIN jobs j ON j.id = a.job_id
                WHERE j.track_id = t.id)::text AS applications,
              -- 평균 충원 기간. 단 하나만 본다면 이 값이다 (docs/01 §11).
              (SELECT round(avg(EXTRACT(EPOCH FROM (j.filled_at - j.opened_at)) / 86400)::numeric, 1)::text
                 FROM jobs j WHERE j.track_id = t.id AND j.filled_at IS NOT NULL AND j.opened_at IS NOT NULL
              ) AS avg_days_to_fill
         FROM tracks t WHERE t.is_active ORDER BY t.sort_order`,
    );
  }

  /** SCR-501 공급 파이프라인 6단계. 여정 이력에서 현재 단계를 집계한다. */
  supplyPipeline(): Promise<{ step: string; count: string }[]> {
    return this.db.query(
      `WITH latest AS (
         SELECT DISTINCT ON (candidate_id) candidate_id, step
           FROM candidate_journey_steps ORDER BY candidate_id, entered_at DESC, id DESC
       )
       SELECT step::text AS step, count(*)::text AS count FROM latest GROUP BY step`,
    );
  }

  /**
   * 채널별 유입. CAC가 나오지 않으면 예산 배분을 할 수 없다 (§5.13).
   * referred_by(기존 인력 추천)는 전환율이 가장 높으므로 별도 집계한다.
   */
  channelInflow(): Promise<{ channel_code: string; label_ko: string; candidates: string; placed: string }[]> {
    return this.db.query(
      `SELECT COALESCE(rc.code, '(UNSET)') AS channel_code,
              COALESCE(rc.label_ko, '미지정') AS label_ko,
              count(c.id)::text AS candidates,
              count(*) FILTER (WHERE c.status = 'PLACED')::text AS placed
         FROM candidates c LEFT JOIN recruiting_channels rc ON rc.id = c.channel_id
        GROUP BY rc.code, rc.label_ko ORDER BY count(c.id) DESC`,
    );
  }

  referralInflow(): Promise<{ referred: string; placed: string }> {
    return this.db.one<{ referred: string; placed: string }>(
      `SELECT count(*)::text AS referred,
              count(*) FILTER (WHERE status = 'PLACED')::text AS placed
         FROM candidates WHERE referred_by IS NOT NULL`,
    ) as Promise<{ referred: string; placed: string }>;
  }

  /** SCR-501 오늘 처리 큐. SLA 초과는 음수로 표시한다. */
  todayQueue(): Promise<{ kind: string; target_id: string; label: string; sla_hours_left: string | null }[]> {
    return this.db.query(
      `SELECT 'APPLICATION_STALE' AS kind, a.id::text AS target_id,
              COALESCE(j.title, '(제목 없음)') AS label,
              round(EXTRACT(EPOCH FROM (a.status_changed_at + interval '7 days' - now())) / 3600)::text AS sla_hours_left
         FROM applications a JOIN jobs j ON j.id = a.job_id
        WHERE a.status IN ('APPLIED','UNDER_REVIEW','INTERVIEW_REQUESTED','OFFERED')
          AND a.status_changed_at <= now() - interval '5 days'
        UNION ALL
       SELECT 'ORG_PENDING_VERIFICATION', o.id::text, o.name, NULL
         FROM organizations o WHERE o.verification_status = 'PENDING'
        UNION ALL
       SELECT 'DOC_UNDER_REVIEW', d.id::text, d.doc_type::text, NULL
         FROM documents d WHERE d.status = 'UNDER_REVIEW'
        ORDER BY sla_hours_left NULLS LAST`,
    );
  }

  /** 매칭에서 제외된 사유별 집계. 운영자가 공급 병목을 본다. */
  exclusionBreakdown(): Promise<{ reason: string; count: string }[]> {
    return this.db.query(
      `SELECT split_part(reason, ':', 1) AS reason, count(*)::text AS count
         FROM match_logs WHERE action = 'EXCLUDED' GROUP BY 1 ORDER BY count(*) DESC`,
    );
  }
}
