#!/usr/bin/env bash
#
# 로컬에서 전체 스택을 띄우고 데모 데이터까지 넣습니다.
#
#   bash infra/local/start.sh              웹 4종 (빠름)
#   bash infra/local/start.sh --mobile     + 후보자·간병사 앱 (Flutter 빌드, 오래 걸림)
#
# 맥·리눅스 공통입니다. 호스트에 필요한 것은 **Docker 하나뿐**입니다 —
# psql·redis-cli·node·flutter 전부 컨테이너 안에 있습니다.
set -uo pipefail
cd "$(dirname "$0")/../.."

MOBILE=""
[ "${1:-}" = "--mobile" ] && MOBILE="--profile mobile"

say() { printf '\n\033[1m%s\033[0m\n' "$1"; }
bad() { printf '\033[31m%s\033[0m\n' "$1"; }

if ! docker info >/dev/null 2>&1; then
  bad "Docker가 실행 중이 아닙니다."
  echo "  맥: Docker Desktop을 실행한 뒤 다시 시도하세요."
  echo "  https://www.docker.com/products/docker-desktop/"
  exit 1
fi

say "1/3 이미지 빌드 · 컨테이너 기동"
# 첫 실행은 오래 걸립니다. Flutter 이미지는 2GB대입니다.
# shellcheck disable=SC2086
docker compose $MOBILE up -d --build || { bad "빌드 실패"; exit 1; }

say "2/3 API 기동 대기"
for i in $(seq 1 60); do
  state=$(docker compose ps --format json api 2>/dev/null | python3 -c "
import sys, json
raw = sys.stdin.read().strip()
if not raw: print(''); raise SystemExit
try: d = json.loads(raw)
except Exception:
    d = [json.loads(l) for l in raw.splitlines() if l.strip()]
if isinstance(d, list): d = d[0] if d else {}
print(d.get('Health') or d.get('State') or '')
" 2>/dev/null)
  [ "$state" = "healthy" ] && break
  printf '.'
  sleep 3
done
echo
if [ "$state" != "healthy" ]; then
  bad "API가 뜨지 않았습니다. 로그를 보세요:"
  echo "  docker compose logs api --tail 50"
  exit 1
fi

say "3/3 데모 데이터"
docker compose run --rm tools demo

say "확인"
cat <<TXT
  http://localhost:3100   운영 콘솔
  http://localhost:3200   기관 웹
  http://localhost:3400   보호자 웹
TXT
if [ -n "$MOBILE" ]; then
  cat <<TXT
  http://localhost:3300   후보자 앱 (웹 빌드)
  http://localhost:3500   간병사 앱 (웹 빌드)
TXT
else
  echo "  (후보자·간병사 앱은 --mobile 로 함께 띄웁니다)"
fi
cat <<'TXT'

  게이트 검사:  docker compose run --rm tools smoke
  DB 접속:      docker compose run --rm tools psql
  정리:         docker compose down -v
TXT
