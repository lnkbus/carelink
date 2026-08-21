# 간병사 앱을 **웹으로 빌드**해 브라우저에서 확인할 수 있게 합니다.
#
# 이것은 배포용이 아니라 **검증용**입니다. 실제 배포는 스토어이고,
# FIELD 규격(터치 타깃·글꼴 크기)은 실기기에서 최종 확인해야 합니다.
# 다만 화면 흐름·번역·API 연동은 웹 빌드로 대부분 잡힙니다.
FROM ghcr.io/cirruslabs/flutter:3.24.5 AS build
WORKDIR /app

# 공용 FIELD 패키지가 path 의존이라 빌드 컨텍스트가 리포 루트입니다.
COPY packages/field_ui packages/field_ui
COPY apps/mobile-caregiver/pubspec.yaml apps/mobile-caregiver/pubspec.lock apps/mobile-caregiver/
WORKDIR /app/apps/mobile-caregiver
RUN flutter pub get

COPY apps/mobile-caregiver .

# API 주소는 빌드 시점에 박힙니다 (Dart의 const 환경변수).
# 그래서 주소가 바뀌면 다시 빌드해야 합니다 — 런타임 주입이 아닙니다.
ARG CARELINK_API_URL=http://localhost:3000/api/v1
# CanvasKit은 gstatic CDN에서 받아옵니다 — 폐쇄망에서 조용히 매달려 백지가 됩니다.
# HTML 렌더러는 외부 의존이 없어 이미지가 자기완결적입니다 (docs/13 D-11).
RUN flutter build web --release --web-renderer html --pwa-strategy=none \
      --dart-define=CARELINK_API_URL=$CARELINK_API_URL

FROM nginx:1.27-alpine
COPY --from=build /app/apps/mobile-caregiver/build/web /usr/share/nginx/html
COPY apps/mobile-caregiver/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
