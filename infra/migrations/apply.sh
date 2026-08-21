#!/bin/sh
# 스키마·시드 적용. **여러 번 돌려도 안전해야 합니다.**
#
# 이유: `docker compose run --rm tools ...`는 의존 서비스를 다시 띄웁니다.
# tools → api → migrate 체인이라 tools를 부를 때마다 migrate가 재실행됩니다.
# 적용된 파일을 다시 실행하면 CREATE TABLE에서 그대로 죽고(exit 3),
# 그러면 tools도 함께 죽습니다 — 스택은 멀쩡한데 데모가 안 뜹니다.
#
# 그래서 `schema_migrations`에 적용 이력을 남기고 안 돌린 파일만 돌립니다.
set -e

DIR="$(dirname "$0")"
PSQL="psql -h ${PGHOST:-db} -U ${PGUSER:-carelink} -d ${PGDATABASE:-carelink}"

$PSQL -v ON_ERROR_STOP=1 -q -c "
  CREATE TABLE IF NOT EXISTS schema_migrations (
    filename   text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
  );"

# 이력 테이블 없이 만들어진 기존 DB를 이어받습니다. users가 이미 있으면
# 0001·0002는 적용된 것으로 표시합니다 — 다시 돌리면 죽기 때문입니다.
if [ -n "$($PSQL -tAc "SELECT to_regclass('public.users')" | tr -d '[:space:]')" ]; then
  $PSQL -v ON_ERROR_STOP=1 -q -c "
    INSERT INTO schema_migrations (filename)
    VALUES ('0001_init.sql'), ('0002_seed.sql')
    ON CONFLICT DO NOTHING;"
fi

applied=0
for f in "$DIR"/[0-9]*.sql; do
  name="$(basename "$f")"
  done_already="$($PSQL -tAc "SELECT 1 FROM schema_migrations WHERE filename = '$name'" | tr -d '[:space:]')"
  [ -n "$done_already" ] && continue

  echo "적용: $name"
  $PSQL -v ON_ERROR_STOP=1 -f "$f"
  $PSQL -v ON_ERROR_STOP=1 -q -c "INSERT INTO schema_migrations (filename) VALUES ('$name');"
  applied=$((applied + 1))
done

if [ "$applied" -eq 0 ]; then
  echo "적용할 마이그레이션이 없습니다 — 최신 상태입니다."
  echo "처음부터 다시 만들려면: docker compose down -v"
else
  echo "마이그레이션 ${applied}건 적용 완료"
fi
