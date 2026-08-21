#!/usr/bin/env bash
# demo | smoke | psql | sh
set -uo pipefail

case "${1:-demo}" in
  demo)  exec bash /repo/infra/smoke/demo-seed.sh "$API_URL" "$DATABASE_URL" ;;
  smoke) exec bash /repo/infra/smoke/smoke.sh     "$API_URL" "$DATABASE_URL" ;;
  psql)  shift; exec psql "$DATABASE_URL" "$@" ;;
  sh)    exec bash ;;
  *)     echo "사용법: demo | smoke | psql | sh"; exit 2 ;;
esac
