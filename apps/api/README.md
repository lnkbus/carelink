# @carelink/api

NestJS Modular Monolith. 모듈 경계는 `docs/02_ARCHITECTURE.md` §4 표를 따릅니다.

## 실행

```bash
# PostgreSQL 15+ / Redis 기동 후
cp ../../.env.example .env
pnpm --filter @carelink/api exec nest build
DATABASE_URL=... REDIS_URL=... node dist/main.js
```

마이그레이션은 리포 루트에서 `pnpm db:reset` (init → seed).

## 구조

```
src/
  core/
    scope/     @Scope 데코레이터 + 직렬화 인터셉터  ← 개인정보 통제의 핵심
    state/     상태머신 기반 클래스
    errors/    도메인 에러 코드 (docs/02 §9.1)
    db/        PostgreSQL 풀 · Redis
  modules/
    iam/       인증·사용자·역할·동의            ← 구현 완료
    ops/       감사 로그 (AuditService는 @Global)
    talent org matching tracks recruiting
    quality engagement care payroll             ← 개발 순서대로 추가
```

## 지켜야 할 것

- **응답 필드는 `@Scope`로만 자릅니다.** 컨트롤러 if 문 금지 (docs/02 §5.2).
  `@Scope` 선언이 없는 필드는 아무에게도 나가지 않습니다 (deny by default).
- **상태 전이는 `state/`의 상태머신을 통합니다.** `if (status === 'X')` 분기 금지.
  전이 단위 테스트는 필수입니다 (docs/02 §13).
- **`service_logs` · `audit_logs`는 append-only.** UPDATE/DELETE 경로를 만들지 마세요.
- **모듈 간 호출은 서비스 인터페이스로만.** 다른 모듈의 repository·테이블 직접 접근 금지.

## 로그인 — 비밀번호가 없습니다

S1 확정에 따라 로그인 경로는 OTP 하나뿐입니다. `users.password_hash`는 채우지 않습니다.
그래서 `SCREENS` SCR-002에 있던 `INVALID_CREDENTIAL` / `LOCKED(5회 실패)` 상태도 없고,
대신 OTP 시도 제한(`IAM_OTP_TOO_MANY_ATTEMPTS`)과 재발송 쿨다운
(`IAM_OTP_RATE_LIMITED`)이 같은 역할을 합니다.
