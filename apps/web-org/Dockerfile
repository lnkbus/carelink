FROM node:22-alpine AS build
WORKDIR /repo
RUN corepack enable

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/web-org/package.json apps/web-org/
COPY packages/ui/package.json packages/ui/
COPY packages/shared-types/package.json packages/shared-types/
RUN pnpm install --frozen-lockfile --filter @carelink/web-org...

COPY packages packages
COPY apps/web-org apps/web-org

# 빌드 시점에는 API를 부르지 않습니다 — 모든 페이지가 force-dynamic이라
# 요청 시점에 서버가 호출합니다. 그래서 여기서 URL을 넣을 필요가 없습니다.
RUN pnpm --filter @carelink/web-org build

FROM node:22-alpine
WORKDIR /app
RUN addgroup -S carelink && adduser -S carelink -G carelink

COPY --from=build --chown=carelink:carelink /repo/node_modules /app/node_modules
COPY --from=build --chown=carelink:carelink /repo/packages /app/packages
COPY --from=build --chown=carelink:carelink /repo/apps/web-org /app/apps/web-org

USER carelink
WORKDIR /app/apps/web-org
ENV NODE_ENV=production
EXPOSE 3200
CMD ["npx", "next", "start", "-p", "3200", "-H", "0.0.0.0"]
