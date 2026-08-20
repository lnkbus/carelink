import { Injectable, Logger } from '@nestjs/common';
import { DomainError } from '../../../core/errors/domain-error';
import { StorageService, type PresignedUrl } from '../../../core/storage/storage.service';
import { AuditService } from '../../ops/service/audit.service';
import { DocumentRepository, type DocumentRow, type DocumentType } from '../repository/document.repository';
import {
  DOCUMENT_VERDICTS, documentMachine, PURGE_ORIGINAL_AFTER_REVIEW, type DocumentStatus,
} from '../state/document.state';

@Injectable()
export class DocumentService {
  private readonly log = new Logger(DocumentService.name);

  constructor(
    private readonly repo: DocumentRepository,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
  ) {}

  list(candidateId: string): Promise<DocumentRow[]> {
    return this.repo.listByCandidate(candidateId);
  }

  async getById(id: string): Promise<DocumentRow> {
    const row = await this.repo.findById(id);
    if (!row) throw new DomainError('COMMON_NOT_FOUND', { targetType: 'document', targetId: id });
    return row;
  }

  /** 업로드 시작. presigned PUT URL을 주고 레코드를 PENDING으로 만든다. */
  async createUpload(input: {
    candidateId: string; docType: DocumentType; fileName: string;
    issuedOn: string | null; expiresAt: string | null; actorUserId: string | null;
  }): Promise<{ document: DocumentRow; upload: PresignedUrl }> {
    const fileKey = this.storage.newFileKey(input.candidateId, input.docType, input.fileName);
    const document = await this.repo.create({
      candidateId: input.candidateId, docType: input.docType, fileKey,
      fileName: input.fileName, issuedOn: input.issuedOn, expiresAt: input.expiresAt,
    });
    await this.audit.record({
      actorUserId: input.actorUserId, action: 'STATUS_CHANGE', targetType: 'document',
      targetId: document.id, after: { docType: input.docType, status: 'PENDING' },
    });
    return { document, upload: this.storage.presign(fileKey, 'put') };
  }

  /**
   * 파일 조회 URL. 만료 5분짜리 presigned URL만 내보낸다 (CLAUDE.md §6-5).
   * 원본이 파기된 서류는 URL 자체가 없다 — 결과값만 남아 있다.
   */
  async presignRead(documentId: string, actorUserId: string | null): Promise<PresignedUrl> {
    const doc = await this.getById(documentId);
    if (!doc.file_key) {
      throw new DomainError('TALENT_DOC_ORIGINAL_PURGED', {
        documentId, docType: doc.doc_type,
        purgedAt: doc.original_purged_at, verdict: doc.verdict,
      });
    }
    // 서류 원본 조회는 개인정보 조회다. 전량 적재한다 (docs/11 §5).
    await this.audit.record({
      actorUserId, action: 'VIEW_PII', targetType: 'document', targetId: documentId,
      after: { docType: doc.doc_type },
    });
    return this.storage.presign(doc.file_key, 'get');
  }

  async submitForReview(documentId: string, actorUserId: string | null): Promise<DocumentRow> {
    return this.transition(documentId, 'UNDER_REVIEW', actorUserId, {});
  }

  /**
   * 검증 완료. 범죄경력·건강진단서는 여기서 원본을 파기한다.
   *
   * 확인 → 결과 기록 → 원본 파기가 원칙이다 (docs/11 §1.2).
   * 파기를 나중으로 미루는 경로를 만들지 않는다 — 미뤄진 파기는 지켜지지 않는다.
   */
  async verify(
    documentId: string, actorUserId: string, verdict: string | null,
  ): Promise<DocumentRow> {
    const doc = await this.getById(documentId);
    const needsVerdict = PURGE_ORIGINAL_AFTER_REVIEW.includes(doc.doc_type);

    if (needsVerdict) {
      const allowed = DOCUMENT_VERDICTS[doc.doc_type as keyof typeof DOCUMENT_VERDICTS];
      if (!verdict || !(allowed as readonly string[]).includes(verdict)) {
        throw new DomainError('TALENT_DOC_VERDICT_REQUIRED', {
          documentId, docType: doc.doc_type, allowed, submitted: verdict ?? null,
        });
      }
    }

    const updated = await this.transition(documentId, 'VERIFIED', actorUserId, { verdict });

    if (needsVerdict) {
      await this.repo.purgeOriginal(documentId);
      await this.audit.record({
        actorUserId, action: 'EXPORT', targetType: 'document', targetId: documentId,
        after: { purged: true, verdict, reason: 'original discarded after review (docs/11 §1.2)' },
      });
      this.log.log(`원본 파기: document=${documentId} type=${doc.doc_type}`);
      return this.getById(documentId);
    }
    return updated;
  }

  async reject(documentId: string, actorUserId: string, reason: string): Promise<DocumentRow> {
    return this.transition(documentId, 'REJECTED', actorUserId, { rejectReason: reason });
  }

  /** 만료 전이. 배치 잡이 호출한다. */
  async expire(documentId: string): Promise<DocumentRow> {
    return this.transition(documentId, 'EXPIRED', null, {});
  }

  private async transition(
    documentId: string, to: DocumentStatus, actorUserId: string | null,
    extra: { rejectReason?: string; verdict?: string | null },
  ): Promise<DocumentRow> {
    const before = await this.getById(documentId);
    documentMachine.assert(before.status, to);
    await this.repo.updateStatus(documentId, to, {
      reviewerId: actorUserId,
      rejectReason: extra.rejectReason ?? null,
      verdict: extra.verdict ?? null,
    });
    await this.audit.record({
      actorUserId, action: 'STATUS_CHANGE', targetType: 'document', targetId: documentId,
      before: { status: before.status }, after: { status: to, ...extra },
    });
    return this.getById(documentId);
  }
}
