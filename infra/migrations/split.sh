#!/usr/bin/env bash
# docs/03_schema.sql → 0001_init.sql (DDL) + 0002_seed.sql (시드)
set -euo pipefail
cd "$(dirname "$0")/../.."
python3 - <<'PY'
s = open('docs/03_schema.sql').read()
i = s.index("-- 9. 시드 데이터 (개발용 최소 세트)")
head_start = s.rindex("-- =========", 0, i)
banner = ("-- 이 파일은 docs/03_schema.sql에서 생성됩니다. 직접 편집하지 마세요.\n"
          "-- 스키마의 단일 출처는 docs/03_schema.sql입니다 (docs/02 서두).\n"
          "-- 재생성: pnpm db:split\n\n")
open('infra/migrations/0001_init.sql','w').write(banner + s[:head_start])
open('infra/migrations/0002_seed.sql','w').write(banner + s[head_start:])
PY
