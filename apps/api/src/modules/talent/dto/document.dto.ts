import { IsDateString, IsIn, IsOptional, IsString, Length } from 'class-validator';
import { Scope, ScopeOwner } from '../../../core/scope/scope.decorator';

const DOC_TYPES = ['IDENTITY', 'CRIMINAL_RECORD', 'EDUCATION', 'CAREER', 'QUALIFICATION', 'HEALTH', 'OTHER'] as const;

export class CreateDocumentDto {
  @IsIn(DOC_TYPES) docType: (typeof DOC_TYPES)[number];
  @IsString() @Length(1, 255) fileName: string;
  @IsOptional() @IsDateString() issuedOn?: string;
  @IsOptional() @IsDateString() expiresAt?: string;
}

export class VerifyDocumentDto {
  /** CRIMINAL_RECORD는 CLEAR|FLAGGED, HEALTH는 FIT|UNFIT. 원본 대신 남기는 결과값. */
  @IsOptional() @IsString() @Length(1, 32) verdict?: string;
}

export class RejectDocumentDto {
  @IsString() @Length(1, 500) reason: string;
}

export class DocumentDto {
  @ScopeOwner() ownerUserId: string;
  @Scope('self', 'admin', 'org') id: string;
  @Scope('self', 'admin', 'org') docType: string;
  @Scope('self', 'admin', 'org') fileName: string | null;
  @Scope('self', 'admin', 'org') status: string;
  @Scope('self', 'admin') rejectReason: string | null;
  @Scope('self', 'admin', 'org') issuedOn: string | null;
  @Scope('self', 'admin', 'org') expiresAt: string | null;
  /** 만료는 날짜가 아니라 카운트다운으로 보여준다 (docs/09 §4.1-5). */
  @Scope('self', 'admin', 'org') expiresInDays: number | null;

  /**
   * 범죄경력·건강진단 결과값.
   * 기관은 '결격 여부'/'적합 여부'만 본다 (docs/11 §3.1). 원본 파일은 이미 없다.
   */
  @Scope('self', 'admin', 'org') verdict: string | null;
  @Scope('self', 'admin') originalPurgedAt: Date | null;

  /**
   * 파일 키는 어떤 scope로도 나가지 않는다. 조회는 presigned URL 전용 엔드포인트로만 한다
   * (CLAUDE.md §6-5). 그래서 이 필드에는 @Scope가 없다.
   */
  fileKey: string | null;
}

export class PresignedUrlDto {
  @ScopeOwner() ownerUserId: string;
  @Scope('self', 'admin', 'org') url: string;
  @Scope('self', 'admin', 'org') expiresAt: Date;
}

export class DocumentUploadDto {
  @ScopeOwner() ownerUserId: string;
  @Scope('self', 'admin') document: DocumentDto;
  @Scope('self', 'admin') upload: PresignedUrlDto;
}
