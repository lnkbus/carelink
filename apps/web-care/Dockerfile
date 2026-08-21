FROM node:22-alpine AS build
WORKDIR /repo
RUN corepack enable

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/web-care/package.json apps/web-care/
COPY packages/ui/package.json packages/ui/
COPY packages/shared-types/package.json packages/shared-types/
RUN pnpm install --frozen-lockfile --filter @carelink/web-care...

COPY packages packages
COPY apps/web-care apps/web-care

# 빌드 시점에는 API를 부르지 않습니다 — 모든 페이지가 force-dynamic이라
# 요청 시점에 서버가 호출합니다. 그래서 여기서 URL을 넣을 필요가 없습니다.
RUN pnpm --filter @carelink/web-care build

FROM node:22-alpine
WORKDIR /app
RUN addgroup -S carelink && adduser -S carelink -G carelink

COPY --from=build --chown=carelink:carelink /repo/node_modules /app/node_modules
COPY --from=build --chown=carelink:carelink /repo/packages /app/packages
COPY --from=build --chown=carelink:carelink /repo/apps/web-care /app/apps/web-care

USER carelink
WORKDIR /app/apps/web-care
ENV NODE_ENV=production
EXPOSE 3400
CMD ["npx", "next", "start", "-p", "3400", "-H", "0.0.0.0"]
