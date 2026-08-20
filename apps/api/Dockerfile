# ── build ───────────────────────────────────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /repo

RUN corepack enable

# 워크스페이스 매니페스트만 먼저 복사해 의존성 레이어를 캐시합니다.
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api/package.json apps/api/
RUN pnpm install --frozen-lockfile --filter @carelink/api...

COPY apps/api apps/api
RUN pnpm --filter @carelink/api exec tsc -p tsconfig.json

# 실행에 필요한 것만 남깁니다.
RUN pnpm install --frozen-lockfile --prod --filter @carelink/api...

# ── runtime ─────────────────────────────────────────────────────────────────
FROM node:22-alpine
WORKDIR /app

# root로 돌리지 않습니다. 컨테이너가 뚫렸을 때 호스트로 넘어갈 여지를 줄입니다.
RUN addgroup -S carelink && adduser -S carelink -G carelink

COPY --from=build --chown=carelink:carelink /repo/node_modules /app/node_modules
COPY --from=build --chown=carelink:carelink /repo/apps/api/node_modules /app/apps/api/node_modules
COPY --from=build --chown=carelink:carelink /repo/apps/api/dist /app/apps/api/dist
COPY --from=build --chown=carelink:carelink /repo/apps/api/package.json /app/apps/api/

USER carelink
WORKDIR /app/apps/api
ENV NODE_ENV=production PORT=3000
EXPOSE 3000

# 헬스체크는 실제 라우트를 칩니다. 프로세스 살아있음만 보면
# DB 연결이 끊긴 상태로 '정상'이 됩니다.
HEALTHCHECK --interval=15s --timeout=5s --start-period=30s --retries=5 \
  CMD node -e "require('http').get('http://127.0.0.1:3000/api/v1/tracks',r=>process.exit(r.statusCode<500?0:1)).on('error',()=>process.exit(1))"

CMD ["node", "dist/main.js"]
