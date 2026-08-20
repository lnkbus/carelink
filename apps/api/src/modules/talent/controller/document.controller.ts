import { Body, Controller, Get, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { DomainError } from '../../../core/errors/domain-error';
import type { Viewer } from '../../../core/scope/scope.types';
import { Roles } from '../../iam/guard/roles.guard';
import { CurrentViewer } from '../../iam/guard/viewer.decorator';
import {
  CreateDocumentDto, DocumentDto, DocumentUploadDto, PresignedUrlDto, RejectDocumentDto, VerifyDocumentDto,
} from '../dto/document.dto';
import type { DocumentRow } from '../repository/document.repository';
import { CandidateService } from '../service/candidate.service';
import { DocumentService } from '../service/document.service';

/** SCR-105 서류 · 증빙 */
@Controller()
export class DocumentController {
  constructor(
    private readonly documents: DocumentService,
    private readonly candidates: CandidateService,
  ) {}

  /** GET /api/v1/candidates/me/documents — ClearanceMatrix가 소비한다 */
  @Get('candidates/me/documents')
  async myDocuments(@CurrentViewer() viewer: Viewer): Promise<DocumentDto[]> {
    if (!viewer.userId) throw new DomainError('IAM_TOKEN_INVALID');
    const candidate = await this.candidates.getOrCreateForUser(viewer.userId);
    const rows = await this.documents.list(candidate.id);
    return rows.map((r) => toDto(r, viewer.userId!));
  }

  @Get('candidates/:candidateId/documents')
  async listForCandidate(
    @Param('candidateId', ParseUUIDPipe) candidateId: string,
  ): Promise<DocumentDto[]> {
    const candidate = await this.candidates.getById(candidateId);
    const rows = await this.documents.list(candidateId);
    return rows.map((r) => toDto(r, candidate.user_id));
  }

  /** POST /api/v1/candidates/me/documents — presigned PUT URL을 돌려준다 */
  @Post('candidates/me/documents')
  async upload(@CurrentViewer() viewer: Viewer, @Body() dto: CreateDocumentDto): Promise<DocumentUploadDto> {
    if (!viewer.userId) throw new DomainError('IAM_TOKEN_INVALID');
    const candidate = await this.candidates.getOrCreateForUser(viewer.userId);
    const { document, upload } = await this.documents.createUpload({
      candidateId: candidate.id,
      docType: dto.docType,
      fileName: dto.fileName,
      issuedOn: dto.issuedOn ?? null,
      expiresAt: dto.expiresAt ?? null,
      actorUserId: viewer.userId,
    });
    return Object.assign(new DocumentUploadDto(), {
      ownerUserId: viewer.userId,
      document: toDto(document, viewer.userId),
      upload: Object.assign(new PresignedUrlDto(), upload, { ownerUserId: viewer.userId }),
    });
  }

  /** 업로드를 마치고 심사를 요청한다. */
  @Post('documents/:id/submit')
  async submit(@CurrentViewer() viewer: Viewer, @Param('id', ParseUUIDPipe) id: string): Promise<DocumentDto> {
    const row = await this.documents.submitForReview(id, viewer.userId);
    const candidate = await this.candidates.getById(row.candidate_id);
    return toDto(row, candidate.user_id);
  }

  /** GET /api/v1/documents/{id}/url — 만료 5분 presigned URL */
  @Get('documents/:id/url')
  async fileUrl(@CurrentViewer() viewer: Viewer, @Param('id', ParseUUIDPipe) id: string): Promise<PresignedUrlDto> {
    const doc = await this.documents.getById(id);
    const candidate = await this.candidates.getById(doc.candidate_id);
    const url = await this.documents.presignRead(id, viewer.userId);
    return Object.assign(new PresignedUrlDto(), url, { ownerUserId: candidate.user_id });
  }

  /**
   * 운영자 검증. 범죄경력·건강진단서는 이 시점에 원본이 파기되고 결과값만 남는다.
   * 적격성 판정은 사람이 하고 시스템은 결과만 기록한다 (CLAUDE.md §6-1).
   */
  @Post('documents/:id/verify')
  @Roles('ADMIN', 'SUPER_ADMIN')
  async verify(
    @CurrentViewer() viewer: Viewer,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VerifyDocumentDto,
  ): Promise<DocumentDto> {
    const row = await this.documents.verify(id, viewer.userId!, dto.verdict ?? null);
    const candidate = await this.candidates.getById(row.candidate_id);
    return toDto(row, candidate.user_id);
  }

  @Post('documents/:id/reject')
  @Roles('ADMIN', 'SUPER_ADMIN')
  async reject(
    @CurrentViewer() viewer: Viewer,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectDocumentDto,
  ): Promise<DocumentDto> {
    const row = await this.documents.reject(id, viewer.userId!, dto.reason);
    const candidate = await this.candidates.getById(row.candidate_id);
    return toDto(row, candidate.user_id);
  }
}

function toDto(r: DocumentRow, ownerUserId: string): DocumentDto {
  return Object.assign(new DocumentDto(), {
    ownerUserId,
    id: r.id,
    docType: r.doc_type,
    fileName: r.file_name,
    status: r.status,
    rejectReason: r.reject_reason,
    issuedOn: r.issued_on ? r.issued_on.toISOString().slice(0, 10) : null,
    expiresAt: r.expires_at ? r.expires_at.toISOString().slice(0, 10) : null,
    expiresInDays: daysUntil(r.expires_at),
    verdict: r.verdict,
    originalPurgedAt: r.original_purged_at,
    fileKey: r.file_key,
  });
}

function daysUntil(d: Date | null): number | null {
  if (!d) return null;
  const now = new Date();
  const a = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const b = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return Math.round((b - a) / 86_400_000);
}
