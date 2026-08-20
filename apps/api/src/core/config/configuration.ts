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
});
