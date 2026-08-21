import type { ConfigService } from '@nestjs/config';
import { OtpService } from './otp.service';
import configuration from '../../../core/config/configuration';

/**
 * 인증번호 노출 스위치.
 *
 * 이 게이트가 잘못 서면 두 방향으로 다 아픕니다.
 *   너무 닫히면  데모 스택에서 아무도 로그인할 수 없습니다 (실제로 겪었습니다 —
 *                도커 이미지가 NODE_ENV=production이라 항상 닫혀 있었습니다)
 *   너무 열리면  전화번호만 아는 사람이 남의 계정으로 로그인합니다
 *
 * 그래서 환경 변수 해석을 테스트로 못 박습니다.
 */
describe('AUTH_EXPOSE_OTP_CODE', () => {
  const original = { ...process.env };
  afterEach(() => { process.env = { ...original }; });

  function resolve(env: Record<string, string | undefined>): boolean {
    process.env = { ...original, ...env } as NodeJS.ProcessEnv;
    // undefined는 delete로만 표현됩니다 — 'undefined' 문자열이 되면 안 됩니다.
    for (const [k, v] of Object.entries(env)) if (v === undefined) delete process.env[k];
    return configuration().AUTH_EXPOSE_OTP_CODE;
  }

  it("명시적으로 'true'일 때만 열린다", () => {
    expect(resolve({ AUTH_EXPOSE_OTP_CODE: 'true', NODE_ENV: 'production' })).toBe(true);
  });

  it('true를 흉내 낸 값은 열지 않는다', () => {
    // '1'·'yes'·'TRUE'를 받아 주면 오타 하나로 운영에서 열립니다.
    for (const v of ['1', 'yes', 'TRUE', 'on', '']) {
      expect(resolve({ AUTH_EXPOSE_OTP_CODE: v, NODE_ENV: 'production' })).toBe(false);
    }
  });

  it('명시적으로 끄면 개발 환경에서도 닫힌다', () => {
    expect(resolve({ AUTH_EXPOSE_OTP_CODE: 'false', NODE_ENV: 'development' })).toBe(false);
  });

  it('설정이 없으면 NODE_ENV를 따른다', () => {
    // 로컬에서 pnpm dev로 띄우는 사람이 매번 플래그를 붙이지 않아도 되게.
    expect(resolve({ AUTH_EXPOSE_OTP_CODE: undefined, NODE_ENV: 'development' })).toBe(true);
    expect(resolve({ AUTH_EXPOSE_OTP_CODE: undefined, NODE_ENV: 'production' })).toBe(false);
  });
});

describe('OtpService.issue', () => {
  function build(expose: boolean) {
    const store = new Map<string, string>();
    const redis = {
      client: {
        set: async (k: string, v: string, ..._rest: unknown[]) => { store.set(k, v); return 'OK'; },
        del: async () => 1,
      },
    };
    const config = {
      get: (k: string) => ({
        OTP_RESEND_COOLDOWN_SECONDS: 30,
        OTP_TTL_SECONDS: 180,
        AUTH_EXPOSE_OTP_CODE: expose,
      } as Record<string, unknown>)[k],
    };
    return {
      service: new OtpService(redis as never, config as unknown as ConfigService),
      store,
    };
  }

  it("환경변수 문자열 'false'를 켜짐으로 읽지 않는다", async () => {
    // ConfigService.get은 팩토리보다 process.env를 먼저 봅니다. 그래서 이 키에
    // 문자열이 들어올 수 있고, 'false'는 truthy라 그대로 쓰면 끈 것이 켜집니다.
    // 실제로 AUTH_EXPOSE_OTP_CODE=false로 띄운 API가 코드를 내보냈습니다.
    const { service } = build('false' as unknown as boolean);
    expect((await service.issue('01011110001')).devCode).toBeUndefined();
  });

  it("환경변수 문자열 'true'는 켜짐으로 읽는다", async () => {
    const { service } = build('true' as unknown as boolean);
    expect((await service.issue('01011110001')).devCode).toMatch(/^\d{6}$/);
  });

  it('열려 있으면 발급된 코드를 그대로 돌려준다', async () => {
    const { service, store } = build(true);
    const res = await service.issue('01011110001');
    expect(res.devCode).toBe(store.get('otp:code:01011110001'));
    expect(res.devCode).toMatch(/^\d{6}$/);
  });

  it('닫혀 있으면 코드를 응답에 싣지 않는다', async () => {
    const { service, store } = build(false);
    const res = await service.issue('01011110001');
    expect(res.devCode).toBeUndefined();
    // 발급 자체는 되어야 합니다 — 운영에서는 SMS로 나갑니다.
    expect(store.get('otp:code:01011110001')).toMatch(/^\d{6}$/);
  });
});
