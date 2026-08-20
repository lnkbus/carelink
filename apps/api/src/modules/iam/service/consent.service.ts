import { Injectable } from '@nestjs/common';
import { DomainError } from '../../../core/errors/domain-error';
import { CONSENT_CODES, SIGNUP_REQUIRED_CONSENTS, type ConsentCode } from '../iam.types';
import { ConsentRepository, type ConsentRow } from '../repository/consent.repository';

export interface ConsentInput {
  code: ConsentCode;
  version: string;
  agreed: boolean;
  /** OVERSEAS_TRANSFER는 이전받는 자·국가가 없으면 무효다 (docs/11 §2.2). */
  transfer?: { country: string; recipient: string };
}

@Injectable()
export class ConsentService {
  constructor(private readonly consents: ConsentRepository) {}

  /**
   * 동의 적재. 항목별로 따로 받는다 — 필수와 선택을 한 번에 일괄 체크로 받으면
   * 그 동의는 무효다 (docs/11 §2.3). 그래서 입력도 배열로 받아 코드별로 행을 남긴다.
   */
  async record(userId: string, inputs: ConsentInput[], ip: string | null): Promise<ConsentRow[]> {
    const out: ConsentRow[] = [];
    for (const input of inputs) {
      const spec = CONSENT_CODES[input.code];
      if (!spec) throw new DomainError('COMMON_NOT_FOUND', { consentCode: input.code });

      if (input.code === 'OVERSEAS_TRANSFER' && input.agreed && !input.transfer) {
        // 이전받는 자·국가·목적·항목·보유기간을 명시하지 않은 국외이전 동의는 성립하지 않는다.
        throw new DomainError('IAM_CONSENT_REQUIRED', {
          consentCode: input.code,
          reason: 'transfer recipient and country are mandatory for overseas transfer consent',
        });
      }

      out.push(
        await this.consents.record(userId, input.code, input.version, spec.required, input.agreed, ip, input.transfer),
      );
    }
    return out;
  }

  /** 가입 필수 동의가 모두 있는지. 없으면 IAM_CONSENT_REQUIRED. */
  async assertSignupConsents(userId: string): Promise<void> {
    const latest = await this.consents.latestByCode(userId);
    const agreed = new Set(latest.filter((c) => c.agreed).map((c) => c.consent_code));
    const missing = SIGNUP_REQUIRED_CONSENTS.filter((c) => !agreed.has(c));
    if (missing.length > 0) throw new DomainError('IAM_CONSENT_REQUIRED', { missing });
  }

  async latest(userId: string): Promise<ConsentRow[]> {
    return this.consents.latestByCode(userId);
  }

  async history(userId: string): Promise<ConsentRow[]> {
    return this.consents.history(userId);
  }
}
