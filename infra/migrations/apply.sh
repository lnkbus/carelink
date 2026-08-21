#!/bin/sh
# 스키마·시드 적용. **여러 번 돌려도 안전해야 합니다.**
#
# 이유: `docker compose run --rm tools ...`는 의존 서비스를 다시 띄웁니다.
# tools → api → migrate 체인이라 tools를 부를 때마다 migrate가 재실행됩니다.
# 0001_init.sql은 CREATE TABLE이라 두 번째 실행에서 그대로 죽고(exit 3),
# 그러면 tools도 함께 죽습니다 — 스택은 멀쩡한데 데모가 안 뜹니다.
#
# 그래서 '이미 적용됐는지'를 먼저 확인하고 건너뜁니다. 마이그레이션 버전
# 테이블을 두지 않은 것은 지금 마이그레이션이 init 하나뿐이기 때문입니다.
# 파일이 늘어나면 그때 schema_migrations 테이블로 바꾸세요.
set -e

# 마이그레이션 파일은 이 스크립트 옆에 있습니다. 절대경로를 박으면
# 컨테이너 밖(로컬 검증)에서 돌려볼 수 없습니다.
DIR="$(dirname "$0")"
PSQL="psql -h ${PGHOST:-db} -U ${PGUSER:-carelink} -d ${PGDATABASE:-carelink}"

applied() {
  # to_regclass는 없는 테이블에 대해 예외 대신 NULL을 돌려줍니다.
  # information_schema 조회보다 짧고, 검색 경로를 그대로 따릅니다.
  [ -n "$($PSQL -tAc "SELECT to_regclass('public.users')" 2>/dev/null | tr -d '[:space:]')" ]
}

if applied; then
  echo "스키마가 이미 적용돼 있습니다 — 건너뜁니다."
  echo "처음부터 다시 만들려면: docker compose down -v"
  exit 0
fi

$PSQL -v ON_ERROR_STOP=1 -f "$DIR/0001_init.sql"
$PSQL -v ON_ERROR_STOP=1 -f "$DIR/0002_seed.sql"
echo "스키마·시드 적용 완료"
