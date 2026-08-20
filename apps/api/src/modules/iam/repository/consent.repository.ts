import { Injectable } from '@nestjs/common';
import { DbService } from '../../../core/db/db.service';
import type { ConsentCode } from '../iam.types';

export interface ConsentRow {
  id: string;
  user_id: string;
  consent_code: ConsentCode;
  version: string;
  is_required: boolean;
  agreed: boolean;
  agreed_at: Date;
  transfer_country: string | null;
  transfer_recipient: string | null;
}

/**
 * 동의 이력. append-only로 다룬다 — 철회도 UPDATE가 아니라 agreed=false인 새 행이다.
 * "그때 어떤 문구에 동의했는가"가 분쟁 시 유일한 방어 근거이므로 버전을 함께 남긴다
 * (docs/11 §2.3). 보존기간은 영구 (docs/11 §4).
 */
@Injectable()
export class ConsentRepository {
  constructor(private readonly db: DbService) {}

  async record(
    userId: string,
    code: ConsentCode,
    version: string,
    isRequired: boolean,
    agreed: boolean,
    ip: string | null,
    transfer?: { country: string; recipient: string },
  ): Promise<ConsentRow> {
    const row = await this.db.one<ConsentRow>(
      `INSERT INTO consent_records
         (user_id, consent_code, version, is_required, agreed, ip_address, transfer_country, transfer_recipient)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, user_id, consent_code, version, is_required, agreed, agreed_at,
                 transfer_country, transfer_recipient`,
      [userId, code, version, isRequired, agreed, ip, transfer?.country ?? null, transfer?.recipient ?? null],
    );
    return row!;
  }

  /** 코드별 최신 동의 상태. 같은 코드의 마지막 행이 현재 상태다. */
  latestByCode(userId: string): Promise<ConsentRow[]> {
    return this.db.query<ConsentRow>(
      `SELECT DISTINCT ON (consent_code)
              id, user_id, consent_code, version, is_required, agreed, agreed_at,
              transfer_country, transfer_recipient
         FROM consent_records
        WHERE user_id = $1
        ORDER BY consent_code, agreed_at DESC`,
      [userId],
    );
  }

  /** 전체 이력. 분쟁 대응용이므로 시간 오름차순으로 준다. */
  history(userId: string): Promise<ConsentRow[]> {
    return this.db.query<ConsentRow>(
      `SELECT id, user_id, consent_code, version, is_required, agreed, agreed_at,
              transfer_country, transfer_recipient
         FROM consent_records WHERE user_id = $1 ORDER BY agreed_at`,
      [userId],
    );
  }
}
