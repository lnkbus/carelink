# 시드·스모크를 **컨테이너 안에서** 돌리기 위한 이미지.
#
# 맥에서 테스트하려면 호스트에 psql·redis-cli·GNU 도구가 있어야 하는데,
# 그걸 요구하면 "먼저 brew로 다섯 개를 깔라"는 안내가 됩니다. 그 단계에서
# 대부분 멈춥니다.
#
# 스크립트 자체는 호스트에서도 그대로 돌아갑니다 — 이건 의존성을 없애는
# 쪽이지 실행 경로를 나누는 것이 아닙니다.
FROM alpine:3.20

RUN apk add --no-cache bash curl python3 postgresql16-client redis

WORKDIR /repo
COPY infra/smoke /repo/infra/smoke
COPY infra/tools/run.sh /repo/infra/tools/run.sh

# api·db·redis는 컴포즈 네트워크 안의 서비스 이름입니다.
# 호스트 포트(55432 등)가 아니라 컨테이너 포트를 씁니다.
ENV API_URL=http://api:3000/api/v1 \
    DATABASE_URL=postgres://carelink:carelink@db:5432/carelink \
    REDIS_HOST=redis

ENTRYPOINT ["/bin/bash", "/repo/infra/tools/run.sh"]
CMD ["demo"]
