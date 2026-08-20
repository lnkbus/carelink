import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';

/**
 * 서류 파일 접근. docs/02 §13 · docs/11 §5 — presigned URL만, 만료 5분.
 *
 * 직접 URL을 노출하지 않는다 (CLAUDE.md §6-5). 파일 키가 새면 만료도 취소도
 * 불가능하고, 범죄경력·건강진단서가 걸려 있어 유출 시 피해가 다른 항목과 다르다.
 *
 * 여기 구현은 개발용 서명자다. 운영에서는 같은 인터페이스로 S3 호환
 * 오브젝트 스토리지 드라이버를 끼운다 — 호출부는 바뀌지 않는다.
 */
export const PRESIGN_TTL_SECONDS = 300; // 5분. 문서에 고정된 값이라 설정으로 빼지 않는다.

export interface PresignedUrl {
  url: string;
  expiresAt: Date;
}

@Injectable()
export class StorageService {
  private readonly secret: string;
  private readonly baseUrl: string;

  constructor(@Inject(ConfigService) config: ConfigService) {
    this.secret = config.get<string>('JWT_SECRET')!;
    this.baseUrl = config.get<string>('STORAGE_BASE_URL') ?? 'http://127.0.0.1:3000/api/v1/files';
  }

  /** 업로드용 키 발급. 후보자 id를 접두로 두어 소유자 확인이 가능하게 한다. */
  newFileKey(candidateId: string, docType: string, fileName: string): string {
    const ext = fileName.includes('.') ? fileName.slice(fileName.lastIndexOf('.')) : '';
    return `candidates/${candidateId}/${docType}/${randomUUID()}${ext}`;
  }

  presign(fileKey: string, action: 'get' | 'put'): PresignedUrl {
    const expiresAt = new Date(Date.now() + PRESIGN_TTL_SECONDS * 1000);
    const exp = Math.floor(expiresAt.getTime() / 1000);
    const sig = this.sign(fileKey, action, exp);
    const url = `${this.baseUrl}/${encodeURI(fileKey)}?action=${action}&exp=${exp}&sig=${sig}`;
    return { url, expiresAt };
  }

  verify(fileKey: string, action: string, exp: number, sig: string): boolean {
    if (!Number.isFinite(exp) || exp * 1000 < Date.now()) return false;
    const expected = this.sign(fileKey, action, exp);
    const a = Buffer.from(expected);
    const b = Buffer.from(sig);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  private sign(fileKey: string, action: string, exp: number): string {
    return createHmac('sha256', this.secret).update(`${action}:${fileKey}:${exp}`).digest('base64url');
  }
}
