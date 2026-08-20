import { Injectable } from '@nestjs/common';
import { DbService } from '../../../core/db/db.service';
import type { DocumentStatus } from '../state/document.state';

export type DocumentType =
  | 'IDENTITY' | 'CRIMINAL_RECORD' | 'EDUCATION' | 'CAREER' | 'QUALIFICATION' | 'HEALTH' | 'OTHER';

export interface DocumentRow {
  id: string; candidate_id: string; doc_type: DocumentType;
  file_key: string | null; file_name: string | null;
  status: DocumentStatus; reviewer_id: string | null; reviewed_at: Date | null;
  reject_reason: string | null; issued_on: Date | null; expires_at: Date | null;
  original_purged_at: Date | null; verdict: string | null; created_at: Date;
}

const COL_NAMES = [
  'id', 'candidate_id', 'doc_type', 'file_key', 'file_name', 'status', 'reviewer_id', 'reviewed_at',
  'reject_reason', 'issued_on', 'expires_at', 'original_purged_at', 'verdict', 'created_at',
] as const;
const COLS = COL_NAMES.join(', ');
/** 조인 쿼리에서 documents 컬럼에 별칭을 붙인다. */
const D_COLS = COL_NAMES.map((c) => `d.${c}`).join(', ');

@Injectable()
export class DocumentRepository {
  constructor(private readonly db: DbService) {}

  listByCandidate(candidateId: string): Promise<DocumentRow[]> {
    return this.db.query<DocumentRow>(
      `SELECT ${COLS} FROM documents WHERE candidate_id = $1 ORDER BY doc_type, created_at DESC`,
      [candidateId],
    );
  }

  findById(id: string): Promise<DocumentRow | null> {
    return this.db.one<DocumentRow>(`SELECT ${COLS} FROM documents WHERE id = $1`, [id]);
  }

  async create(input: {
    candidateId: string; docType: DocumentType; fileKey: string; fileName: string;
    issuedOn: string | null; expiresAt: string | null;
  }): Promise<DocumentRow> {
    const row = await this.db.one<DocumentRow>(
      `INSERT INTO documents (candidate_id, doc_type, file_key, file_name, issued_on, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING ${COLS}`,
      [input.candidateId, input.docType, input.fileKey, input.fileName, input.issuedOn, input.expiresAt],
    );
    return row!;
  }

  async updateStatus(
    id: string, status: DocumentStatus,
    extra: { reviewerId?: string | null; rejectReason?: string | null; verdict?: string | null } = {},
  ): Promise<void> {
    await this.db.query(
      // $2를 ENUM과 텍스트 비교에 함께 쓰면 PostgreSQL이 타입을 정하지 못한다
      // (inconsistent types deduced for parameter). 캐스팅을 명시한다.
      // reviewer_id·reviewed_at은 심사 결과(VERIFIED/REJECTED)일 때만 채운다 —
      // 제출(UNDER_REVIEW)은 후보자가 하는 행위라 심사자가 아니다.
      `UPDATE documents
          SET status = $2::document_status,
              reviewer_id = CASE WHEN $2::text IN ('VERIFIED','REJECTED')
                                 THEN COALESCE($3::uuid, reviewer_id) ELSE reviewer_id END,
              reviewed_at = CASE WHEN $2::text IN ('VERIFIED','REJECTED')
                                 THEN now() ELSE reviewed_at END,
              reject_reason = $4,
              verdict = COALESCE($5, verdict)
        WHERE id = $1`,
      [id, status, extra.reviewerId ?? null, extra.rejectReason ?? null, extra.verdict ?? null],
    );
  }

  /**
   * 원본 파기. 파일 키를 지우고 파기 시각을 남긴다.
   * 결과값(verdict)만 보존한다 — docs/11 §1.2 · §4.
   */
  async purgeOriginal(id: string): Promise<void> {
    await this.db.query(
      `UPDATE documents SET file_key = NULL, original_purged_at = now() WHERE id = $1`,
      [id],
    );
  }

  /** 만료 n일 전 서류. 배치 중인 인력을 먼저 처리하도록 status로 정렬한다. */
  expiringWithin(days: number): Promise<(DocumentRow & { user_id: string; candidate_status: string })[]> {
    return this.db.query(
      `SELECT ${D_COLS}, c.user_id, c.status AS candidate_status
         FROM documents d JOIN candidates c ON c.id = d.candidate_id
        WHERE d.status = 'VERIFIED'
          AND d.expires_at IS NOT NULL
          AND d.expires_at <= CURRENT_DATE + ($1 || ' days')::interval
          AND d.expires_at > CURRENT_DATE
        ORDER BY (c.status IN ('PLACED','MATCHED')) DESC, d.expires_at`,
      [days],
    ) as Promise<(DocumentRow & { user_id: string; candidate_status: string })[]>;
  }

  /** 만료일이 지난 VERIFIED 서류. EXPIRED로 전이시킬 대상. */
  dueForExpiry(): Promise<(DocumentRow & { user_id: string })[]> {
    return this.db.query(
      `SELECT ${D_COLS}, c.user_id
         FROM documents d JOIN candidates c ON c.id = d.candidate_id
        WHERE d.status = 'VERIFIED' AND d.expires_at IS NOT NULL AND d.expires_at <= CURRENT_DATE`,
    ) as Promise<(DocumentRow & { user_id: string })[]>;
  }
}
