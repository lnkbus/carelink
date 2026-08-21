#!/usr/bin/env bash
#
# 로컬에서 전체 스택을 띄우고 데모 데이터까지 넣습니다.
#
#   bash infra/local/start.sh              API + 웹 (빠름)
#   bash infra/local/start.sh --mobile     + 앱 (Flutter 빌드, 오래 걸림)
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
#
# --remove-orphans가 필요한 이유: compose는 파일에서 **사라진 서비스**의
# 컨테이너를 알아서 지우지 않습니다. 서비스 이름이 바뀌면(web-admin → web)
# 옛 컨테이너가 계속 떠서 포트를 쥐고 있고, 새 컨테이너는
# 'Bind for 0.0.0.0:3100 failed: port is already allocated'로 죽습니다.
# 원인이 포트 충돌로 보여서 로컬 Postgres 같은 엉뚱한 곳을 뒤지게 됩니다.
# shellcheck disable=SC2086
if ! docker compose $MOBILE up -d --build --remove-orphans; then
  bad "빌드·기동에 실패했습니다."
  # 포트를 누가 쥐고 있는지까지 알려 줍니다. 'port is already allocated'만
  # 보면 무엇을 지워야 하는지 알 수 없습니다.
  for port in 3000 3100 3300; do
    holder=$(docker ps --filter "publish=$port" --format '{{.Names}}' | head -1)
    [ -n "$holder" ] && echo "  :$port 를 컨테이너 '$holder' 가 쓰고 있습니다"
  done
  echo
  echo "  전부 내리고 다시:  docker compose --profile mobile --profile tools down --remove-orphans"
  echo "  로그:              docker compose logs --tail 50"
  exit 1
fi

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
# 실패를 삼키면 안 됩니다. 아래 URL 목록이 그대로 찍혀서 '다 됐다'로 읽히고,
# 정작 화면은 비어 있습니다.
if ! docker compose run --rm tools demo; then
  bad "데모 데이터 주입에 실패했습니다. 스택은 떠 있으니 로그를 보세요:"
  echo "  docker compose logs api --tail 50"
  echo "  docker compose logs migrate"
  exit 1
fi

say "확인"
cat <<TXT
  http://localhost:3100   웹 — 로그인하면 역할이 갈라 줍니다
                          운영자 → /admin · 기관 담당자 → /org
TXT
if [ -n "$MOBILE" ]; then
  cat <<TXT
  http://localhost:3300   앱 (웹 빌드) — 후보자 · 간병사 · 보호자
TXT
else
  echo "  (앱은 --mobile 로 함께 띄웁니다)"
fi
cat <<'TXT'

  게이트 검사:  docker compose run --rm tools smoke
  DB 접속:      docker compose run --rm tools psql
  정리:         docker compose down -v
TXT
