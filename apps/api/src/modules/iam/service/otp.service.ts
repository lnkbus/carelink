import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomInt, timingSafeEqual } from 'node:crypto';
import { RedisService } from '../../../core/db/redis.service';
import { DomainError } from '../../../core/errors/domain-error';

/**
 * OTP 챌린지. S1 확정에 따라 이 플랫폼의 유일한 로그인 수단이다.
 *
 * 코드는 Redis에만 두고 PostgreSQL에 남기지 않는다. 짧은 수명의 인증 수단을
 * 원장에 적재하면 유출 표면만 넓어지고 파기 정책도 따로 필요해진다.
 */
@Injectable()
export class OtpService {
  private readonly log = new Logger(OtpService.name);

  /**
   * 인증번호를 응답에 실을지. **한 번만 계산해 둔다.**
   *
   * ConfigService.get은 팩토리 값보다 process.env를 먼저 본다. 그래서 이 키로
   * 돌아오는 값은 팩토리의 boolean일 수도, 환경변수의 **문자열**일 수도 있다.
   * 문자열 'false'는 truthy라, 그대로 if에 넣으면 끈 것이 켜진다 —
   * 실제로 AUTH_EXPOSE_OTP_CODE=false로 띄운 API가 코드를 그대로 내보냈다.
   * 그래서 타입을 믿지 않고 명시적으로 판정한다.
   */
  private readonly exposeCode: boolean;

  constructor(
    private readonly redis: RedisService,
    @Inject(ConfigService) private readonly config: ConfigService,
  ) {
    const raw = this.config.get('AUTH_EXPOSE_OTP_CODE');
    this.exposeCode = raw === true || raw === 'true';

    // 켜져 있으면 조용히 두지 않는다. 전화번호만 알면 남의 계정으로 로그인이
    // 되는 상태이므로, 실수로 켠 채 배포했을 때 로그에서 눈에 띄어야 한다.
    if (this.exposeCode) {
      this.log.warn(
        'AUTH_EXPOSE_OTP_CODE=true — 인증번호가 API 응답에 그대로 실려 나갑니다. ' +
        '데모·로컬 전용입니다. 운영이라면 지금 끄세요.',
      );
    }
  }

  private codeKey(phone: string): string { return `otp:code:${phone}`; }
  private attemptKey(phone: string): string { return `otp:attempt:${phone}`; }
  private cooldownKey(phone: string): string { return `otp:cooldown:${phone}`; }

  /**
   * 코드 발급. 재발송 쿨다운이 걸려 있으면 IAM_OTP_RATE_LIMITED.
   * 반환값은 AUTH_EXPOSE_OTP_CODE가 켜졌을 때만 코드를 포함한다 —
   * 운영에서는 SMS/알림톡으로만 나간다.
   */
  async issue(phone: string): Promise<{ expiresInSeconds: number; devCode?: string }> {
    const cooldown = this.config.get<number>('OTP_RESEND_COOLDOWN_SECONDS')!;
    const ttl = this.config.get<number>('OTP_TTL_SECONDS')!;

    const set = await this.redis.client.set(this.cooldownKey(phone), '1', 'EX', cooldown, 'NX');
    if (set === null) {
      throw new DomainError('IAM_OTP_RATE_LIMITED', { retryAfterSeconds: cooldown });
    }

    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    await this.redis.client.set(this.codeKey(phone), code, 'EX', ttl);
    await this.redis.client.del(this.attemptKey(phone));

    // TODO(ops): 알림톡/SMS 발송으로 교체. 후보자·간병사는 앱 푸시 도달률이 낮다 (docs/02 §2).
    this.log.log(`OTP issued for ${maskPhone(phone)} (ttl ${ttl}s)`);

    return {
      expiresInSeconds: ttl,
      ...(this.exposeCode ? { devCode: code } : {}),
    };
  }

  /**
   * 코드 검증. 성공하면 코드를 즉시 소비한다(1회용).
   * 시도 횟수를 세어 무차별 대입을 막는다 — 6자리는 100만 분의 1이라 제한이 없으면 뚫린다.
   */
  async verify(phone: string, submitted: string): Promise<void> {
    const max = this.config.get<number>('OTP_MAX_ATTEMPTS')!;
    const attempts = await this.redis.client.incr(this.attemptKey(phone));
    if (attempts === 1) {
      await this.redis.client.expire(this.attemptKey(phone), this.config.get<number>('OTP_TTL_SECONDS')!);
    }
    if (attempts > max) {
      await this.redis.client.del(this.codeKey(phone));
      throw new DomainError('IAM_OTP_TOO_MANY_ATTEMPTS', { maxAttempts: max });
    }

    const stored = await this.redis.client.get(this.codeKey(phone));
    if (stored === null || !constantTimeEquals(stored, submitted)) {
      throw new DomainError('IAM_OTP_INVALID');
    }

    await this.redis.client.del(this.codeKey(phone), this.attemptKey(phone));
  }
}

/** 길이가 다르면 비교 없이 false. 같으면 타이밍 노출 없이 비교한다. */
function constantTimeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

function maskPhone(phone: string): string {
  return phone.length <= 4 ? '***' : `${phone.slice(0, 3)}****${phone.slice(-2)}`;
}
