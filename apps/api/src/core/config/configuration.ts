export interface AppConfig {
  DATABASE_URL: string;
  REDIS_URL: string;
  JWT_SECRET: string;
  /** docs/02 §2 — Access 15m / Refresh 14d. 값을 바꾸려면 문서를 먼저 고칠 것. */
  ACCESS_TOKEN_TTL: string;
  REFRESH_TOKEN_TTL_DAYS: number;
  OTP_TTL_SECONDS: number;
  OTP_MAX_ATTEMPTS: number;
  OTP_RESEND_COOLDOWN_SECONDS: number;
  /**
   * 발급된 인증번호를 응답에 그대로 실어 보낼지.
   *
   * **인증 우회 스위치입니다.** 켜면 전화번호만 아는 사람이 남의 계정으로
   * 로그인할 수 있습니다. 데모·로컬 스택 전용입니다.
   *
   * NODE_ENV로 판단하지 않는 이유: 도커 이미지는 프로덕션 빌드라
   * NODE_ENV=production이고, 그러면 데모 스택에서 아무도 로그인할 수
   * 없습니다. 반대로 이걸 열려고 NODE_ENV를 development로 낮추면
   * 에러 상세·로깅 같은 무관한 동작까지 함께 바뀝니다.
   * 의도가 하나면 스위치도 하나여야 합니다.
   */
  AUTH_EXPOSE_OTP_CODE: boolean;
}

export default (): AppConfig => ({
  DATABASE_URL: process.env.DATABASE_URL ?? 'postgres://carelink:carelink@127.0.0.1:5432/carelink',
  REDIS_URL: process.env.REDIS_URL ?? 'redis://127.0.0.1:6379',
  JWT_SECRET: process.env.JWT_SECRET ?? 'dev-only-change-me',
  ACCESS_TOKEN_TTL: process.env.ACCESS_TOKEN_TTL ?? '15m',
  REFRESH_TOKEN_TTL_DAYS: Number(process.env.REFRESH_TOKEN_TTL_DAYS ?? 14),
  OTP_TTL_SECONDS: Number(process.env.OTP_TTL_SECONDS ?? 180),
  OTP_MAX_ATTEMPTS: Number(process.env.OTP_MAX_ATTEMPTS ?? 5),
  OTP_RESEND_COOLDOWN_SECONDS: Number(process.env.OTP_RESEND_COOLDOWN_SECONDS ?? 30),
  // 기본값은 '켜짐'이 아닙니다. 명시적으로 'true'라고 써야 열립니다 —
  // 빈 문자열·1·yes 전부 닫힌 것으로 봅니다.
  AUTH_EXPOSE_OTP_CODE:
    process.env.AUTH_EXPOSE_OTP_CODE === 'true' ||
    (process.env.AUTH_EXPOSE_OTP_CODE === undefined && process.env.NODE_ENV !== 'production'),
});
