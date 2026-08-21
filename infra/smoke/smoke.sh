#!/usr/bin/env bash
#
# CARELINK 스모크 테스트.
#
#   bash infra/smoke/smoke.sh [API_URL] [DATABASE_URL]
#
# 게이트가 살아 있는지를 확인합니다. 기능이 되는지가 아니라 **막혀야 할 것이
# 막히는지**가 목적입니다 — 기능은 단위 테스트가 보지만, 게이트는 여러 모듈이
# 맞물려야 성립해서 실환경에서만 드러납니다.
#
# 실제로 여기서 잡힌 것들:
#   · 간병사에게 배정이 빈 객체로 나감 (scope가 과하게 닫힘)
#   · 클리어런스 6종 중 하나만 빠져도 매칭에서 빠지는지
#   · 업무범위 감지가 거절이 아니라 검토로 가는지
#
# 종료 코드 0이면 전부 통과입니다. CI에 걸어 두세요.
set -uo pipefail

B="${1:-http://127.0.0.1:3000/api/v1}"
DB="${2:-postgres://carelink:carelink@127.0.0.1:5432/carelink}"

PASS=0; FAIL=0
ok()   { PASS=$((PASS+1)); printf '  \033[32m✓\033[0m %s\n' "$1"; }
bad()  { FAIL=$((FAIL+1)); printf '  \033[31m✗\033[0m %s\n' "$1"; [ $# -gt 1 ] && printf '      %s\n' "$2"; }
head_() { printf '\n\033[1m%s\033[0m\n' "$1"; }

J() { python3 -c "import sys,json;d=json.load(sys.stdin);print(d$1)" 2>/dev/null; }
# 코드만 뽑습니다. 성공 응답이면 빈 문자열입니다.
code() { python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('code','') if isinstance(d,dict) else '')" 2>/dev/null; }

# OTP는 번호당 30초 쿨다운이 있습니다. 시드가 OTP를 쓰면 브라우저 로그인이
# 막히므로, 스모크는 매번 새 번호를 씁니다.
phone() { echo "010$(printf '%08d' $((RANDOM * 32768 + RANDOM)))" | cut -c1-11; }

login() {
  local p="$1" c
  c=$(curl -sS -X POST "$B/auth/otp/send" -H 'content-type: application/json' -d "{\"phone\":\"$p\"}" | J "['devCode']")
  [ -z "$c" ] && { echo "" ; return 1; }
  curl -sS -X POST "$B/auth/otp/verify" -H 'content-type: application/json' \
    -d "{\"phone\":\"$p\",\"code\":\"$c\",\"consents\":[{\"code\":\"TOS\",\"version\":\"v1\",\"agreed\":true},{\"code\":\"PRIVACY\",\"version\":\"v1\",\"agreed\":true}]}" \
    | python3 -c "import sys,json;d=json.load(sys.stdin);print(d['accessToken'],d['refreshToken'],d['me']['id'])" 2>/dev/null
}
reissue() { curl -sS -X POST "$B/auth/refresh" -H 'content-type: application/json' -d "{\"refreshToken\":\"$1\"}" | J "['accessToken']"; }

printf '\033[1mCARELINK 스모크\033[0m  %s\n' "$B"

# ── 0. 살아 있는가 ──────────────────────────────────────────────────────
head_ "0. 기동"
if curl -sS -m 5 "$B/tracks" -o /dev/null -w '%{http_code}' | grep -qE '^(200|401)$'; then
  ok "API 응답"
else
  bad "API가 응답하지 않습니다" "$B"
  echo; echo "통과 $PASS · 실패 $FAIL"; exit 1
fi

# ── 1. 인증 ─────────────────────────────────────────────────────────────
head_ "1. 인증 · 역할"
AP=$(phone)
read -r AT AR AU <<<"$(login "$AP")"
[ -n "${AT:-}" ] && ok "OTP 로그인" || bad "OTP 로그인 실패"
psql "$DB" -q -c "INSERT INTO user_roles (user_id, role, is_primary, approved_at) VALUES ('$AU','ADMIN',true,now());" 2>/dev/null
AT=$(reissue "$AR")
A=(-H "authorization: Bearer $AT" -H 'content-type: application/json')

C=$(curl -sS "$B/admin/candidates" "${A[@]}" -o /dev/null -w '%{http_code}')
[ "$C" = "200" ] && ok "역할 부여 후 운영자 경로 열림" || bad "운영자 경로가 열리지 않음" "http=$C"

# 역할 없는 사용자는 막혀야 합니다.
read -r NT NR NU <<<"$(login "$(phone)")"
C=$(curl -sS "$B/admin/candidates" -H "authorization: Bearer $NT" -o /dev/null -w '%{http_code}')
[ "$C" = "403" ] && ok "역할 없는 사용자는 403" || bad "역할 없이 운영자 경로가 열림" "http=$C"

# ── 2. 클리어런스 게이트 (§5.11) ────────────────────────────────────────
head_ "2. 배치 전 클리어런스 — 6종 전부 PASS여야 함"
read -r CT CR CU <<<"$(login "$(phone)")"
curl -sS -X POST "$B/auth/roles" -H "authorization: Bearer $CT" -H 'content-type: application/json' \
  -d '{"role":"CAREGIVER","makePrimary":true}' >/dev/null
CG=$(psql "$DB" -tAqc "INSERT INTO caregivers (user_id, display_code, experience_yrs) VALUES ('$CU','CG-SM$RANDOM',5) RETURNING id;" | tr -d '[:space:]')
psql "$DB" -q -c "INSERT INTO caregiver_availability (caregiver_id, starts_at, ends_at) VALUES ('$CG','2020-01-01','2030-12-31');"

# 5종만 통과시킵니다 — 하나가 빠지면 후보에서 제외돼야 합니다.
for t in IDENTITY_VERIFIED CRIMINAL_RECORD_CLEAR HEALTH_CHECK VISA_ELIGIBLE MANDATORY_TRAINING; do
  curl -sS -X POST "$B/admin/clearances/workers/$CU/$t" "${A[@]}" -d '{"result":"PASS"}' >/dev/null
done

HOSP=$(psql "$DB" -tAqc "INSERT INTO hospitals (name, region, is_partner) VALUES ('스모크병원$RANDOM','서울',true) RETURNING id;" | tr -d '[:space:]')
read -r GT GR GU <<<"$(login "$(phone)")"
curl -sS -X POST "$B/auth/roles" -H "authorization: Bearer $GT" -H 'content-type: application/json' \
  -d '{"role":"PATIENT_GUARDIAN","makePrimary":true}' >/dev/null
GT=$(reissue "$GR"); G=(-H "authorization: Bearer $GT" -H 'content-type: application/json')

mkreq() {
  curl -sS -X POST "$B/care-requests" "${G[@]}" -d "{\"hospitalId\":\"$HOSP\",\"ward\":\"$1\",\"serviceType\":\"DAY\",\"shiftPatternCode\":\"${2:-H8_3SHIFT}\",\"startAt\":\"2026-12-01T00:00:00Z\",\"supportItems\":[\"MEAL_SUPPORT\"]${3:-}}"
}

R1=$(mkreq "101호" | J "['id']")
curl -sS -X PATCH "$B/care-requests/$R1/status" "${A[@]}" -d '{"status":"MATCHING"}' >/dev/null
FOUND=$(curl -sS -X POST "$B/care-requests/$R1/match" "${A[@]}" | python3 -c "
import sys,json;d=json.load(sys.stdin)
print('yes' if any(c['caregiverId']=='$CG' for c in d.get('candidates',[])) else 'no')")
[ "$FOUND" = "no" ] && ok "클리어런스 5/6인 인력은 후보에서 제외" || bad "클리어런스 미완 인력이 후보에 들어옴"

curl -sS -X POST "$B/admin/clearances/workers/$CU/SCOPE_TRAINING" "${A[@]}" -d '{"result":"PASS"}' >/dev/null
FOUND=$(curl -sS -X POST "$B/care-requests/$R1/match" "${A[@]}" | python3 -c "
import sys,json;d=json.load(sys.stdin)
print('yes' if any(c['caregiverId']=='$CG' for c in d.get('candidates',[])) else 'no')")
[ "$FOUND" = "yes" ] && ok "6종 전부 PASS면 후보에 들어옴" || bad "6종을 채웠는데도 후보에 없음"

# ── 3. 간병사 카드에 국적이 없는가 (§6-21) ──────────────────────────────
head_ "3. 간병사 카드 — 국적·실명 비노출"
CARD=$(curl -sS -X POST "$B/care-requests/$R1/match" "${A[@]}")
LEAK=$(echo "$CARD" | python3 -c "
import sys,json
s=json.load(sys.stdin)
bad=[k for c in s.get('candidates',[]) for k in c
     if k.lower() in ('nationality','name','fullname','phone','visastatuscode','visa')]
print(','.join(sorted(set(bad))) or 'none')")
[ "$LEAK" = "none" ] && ok "카드에 국적·실명·연락처 필드 없음" || bad "카드에 노출된 필드" "$LEAK"

# ── 4. 업무범위 — 감지는 거절이 아니다 (§6-15) ──────────────────────────
head_ "4. 업무범위 — 감지 시 OPS_REVIEW (자동 거절 아님)"
R2=$(mkreq "202호" "H8_3SHIFT" ',"cautions":"인슐린 주사를 놓아주세요"')
S=$(echo "$R2" | J "['status']"); RID2=$(echo "$R2" | J "['id']")
[ "$S" = "OPS_REVIEW" ] && ok "의료행위 요구가 OPS_REVIEW로" || bad "감지되지 않음" "status=$S"
[ -n "$RID2" ] && ok "요청이 취소되지 않고 남음" || bad "요청이 생성되지 않음"

# 카탈로그에 의료행위 항목 자체가 없어야 합니다 (§6-2).
MED=$(curl -sS "$B/care-services/catalog" "${A[@]}" | python3 -c "
import sys,json
b=('MEDICATION','INJECTION','SUCTION','WOUND_CARE','BLOOD_SUGAR','ENEMA')
print(','.join(i['code'] for i in json.load(sys.stdin) if i['code'] in b) or 'none')")
[ "$MED" = "none" ] && ok "카탈로그에 의료행위 항목 없음" || bad "카탈로그에 의료행위" "$MED"

# ── 5. 24시간 상주는 승인 없이 매칭에 들어가지 않는다 (§5.12) ───────────
head_ "5. 24시간 상주 — 운영자 승인 게이트"
R3=$(mkreq "303호" "H24_LIVE_IN" | J "['id']")
E=$(curl -sS -X PATCH "$B/care-requests/$R3/status" "${A[@]}" -d '{"status":"MATCHING"}' | code)
[ "$E" = "QUALITY_SHIFT_NEEDS_APPROVAL" ] && ok "승인 없는 24시간은 매칭 차단" || bad "24시간이 승인 없이 통과" "code=$E"

# ── 6. 3단계 확정 (§6-4) ────────────────────────────────────────────────
head_ "6. 배정 확정 — 보호자 선택 → 간병사 수락 → 운영자 확인"
AID=$(curl -sS -X POST "$B/care-requests/$R1/assign" "${G[@]}" -d "{\"caregiverId\":\"$CG\"}" | J "['id']")
[ -n "$AID" ] && ok "1단계 제안 생성" || bad "제안 생성 실패"
CT2=$(reissue "$CR"); CH=(-H "authorization: Bearer $CT2" -H 'content-type: application/json')
curl -sS -X PATCH "$B/care-assignments/$AID/status" "${CH[@]}" -d '{"status":"ACCEPTED"}' >/dev/null
E=$(curl -sS -X PATCH "$B/care-assignments/$AID/status" "${CH[@]}" -d '{"status":"ASSIGNED"}' | code)
[ "$E" = "IAM_ROLE_FORBIDDEN" ] && ok "간병사는 스스로 확정할 수 없음" || bad "간병사가 확정함" "code=$E"
ST=$(curl -sS -X PATCH "$B/care-assignments/$AID/status" "${A[@]}" -d '{"status":"ASSIGNED"}' | J "['status']")
[ "$ST" = "ASSIGNED" ] && ok "운영자 확인으로 확정" || bad "운영자도 확정하지 못함" "status=$ST"

# ── 7. 간병사에게 환자 신원이 나가지 않는가 (docs/11 §3.2) ──────────────
head_ "7. 간병사 뷰 — 환자 실명·진단명 비노출"
V=$(curl -sS "$B/care-assignments/$AID/caregiver-view" "${CH[@]}")
LEAK=$(echo "$V" | python3 -c "
import sys,json
d=json.load(sys.stdin)
bad=[k for k in d if k.lower() in ('patientname','diagnosis','age','gender','requestername','birthdate')]
print(','.join(bad) or 'none')")
[ "$LEAK" = "none" ] && ok "환자 신원 필드 없음" || bad "간병사 뷰에 노출" "$LEAK"
WARD=$(echo "$V" | J "['ward']")
[ -n "$WARD" ] && ok "병실은 나감 (일하려면 필요)" || bad "병실이 안 나감"

# 배정 목록이 빈 객체로 나가지 않아야 합니다 — scope가 과하게 닫히면
# role 가드는 통과하고 직렬화에서 전부 잘립니다.
N=$(curl -sS "$B/caregivers/me/assignments" "${CH[@]}" | python3 -c "
import sys,json;d=json.load(sys.stdin);print(sum(1 for a in d if a.get('id')))")
[ "${N:-0}" -gt 0 ] && ok "간병사가 자기 배정을 볼 수 있음" || bad "배정이 빈 객체로 나감 (scope 확인)"

# ── 8. QR 체크인 (§6-3) ─────────────────────────────────────────────────
head_ "8. 출퇴근 — 병실 QR"
E=$(curl -sS -X POST "$B/care-assignments/$AID/start" "${CH[@]}" -d '{"checkMethod":"QR"}' | code)
[ "$E" = "CARE_QR_TOKEN_REQUIRED" ] && ok "토큰 없는 QR 체크인 거부" || bad "토큰 없이 체크인됨" "code=$E"
E=$(curl -sS -X POST "$B/care-assignments/$AID/start" "${CH[@]}" -d '{"checkMethod":"QR","qrToken":"틀린값:999호"}' | code)
[ "$E" = "CARE_QR_TOKEN_MISMATCH" ] && ok "다른 병실 QR 거부" || bad "다른 병실 QR로 체크인됨" "code=$E"
LOG=$(curl -sS -X POST "$B/care-assignments/$AID/start" "${CH[@]}" -d "{\"checkMethod\":\"QR\",\"qrToken\":\"$HOSP:101호\"}" | J "['logType']")
[ "$LOG" = "SHIFT_START" ] && ok "올바른 QR로 근무 시작" || bad "올바른 QR인데 실패" "$LOG"

# ── 9. append-only (§5.4) ───────────────────────────────────────────────
head_ "9. service_logs · audit_logs — append-only"
OUT=$(psql "$DB" -c "UPDATE service_logs SET occurred_at = now() WHERE assignment_id='$AID';" 2>&1)
echo "$OUT" | grep -q "append-only" && ok "service_logs UPDATE를 DB가 막음" || bad "service_logs가 수정됨"
OUT=$(psql "$DB" -c "DELETE FROM audit_logs WHERE id = (SELECT id FROM audit_logs LIMIT 1);" 2>&1)
echo "$OUT" | grep -q "append-only" && ok "audit_logs DELETE를 DB가 막음" || bad "audit_logs가 삭제됨"

# ── 10. 파견 2년 한도 (§5.7-1) ──────────────────────────────────────────
head_ "10. 파견 — 허가번호 · 2년 한도"
IND=$(psql "$DB" -tAqc "SELECT id FROM industries WHERE code='CARE';" | tr -d '[:space:]')
TRK=$(psql "$DB" -tAqc "SELECT id FROM tracks WHERE code='HOSPITAL_CAREGIVER';" | tr -d '[:space:]')
ORG=$(curl -sS -X POST "$B/organizations" "${A[@]}" -d "{\"name\":\"스모크기관$RANDOM\",\"industryId\":\"$IND\",\"orgType\":\"HOSPITAL\",\"businessRegNo\":\"$RANDOM-11-2\"}" | J "['id']")
E=$(curl -sS -X POST "$B/engagements" "${A[@]}" -d "{\"workerUserId\":\"$CU\",\"organizationId\":\"$ORG\",\"trackId\":\"$TRK\",\"model\":\"DELEGATION\",\"isDispatch\":true,\"startedOn\":\"2026-01-01\"}" | code)
[ "$E" = "ENGAGEMENT_DISPATCH_PERMIT_MISSING" ] && ok "허가번호 없는 파견 차단 (파견법 §7)" || bad "허가번호 없이 파견 생성됨" "code=$E"

# ── 11. 트랙 — 요건 없이 열 수 없다 (SCR-507) ──────────────────────────
head_ "11. 트랙 공개 — 요건 게이트"
S=$RANDOM
IID=$(curl -sS -X POST "$B/admin/industries" "${A[@]}" -d "{\"code\":\"SMOKE$S\",\"labelKo\":\"스모크\"}" | J "['id']")
TID=$(curl -sS -X POST "$B/admin/tracks" "${A[@]}" -d "{\"industryId\":\"$IID\",\"code\":\"SMOKE_TRACK$S\",\"labelKo\":\"스모크트랙\",\"qualificationType\":\"NONE\"}" | J "['id']")
E=$(curl -sS -X PATCH "$B/admin/tracks/$TID/active" "${A[@]}" -d '{"isActive":true}' | code)
[ "$E" = "TRACK_NO_REQUIREMENTS" ] && ok "요건 없는 트랙은 열리지 않음" || bad "요건 없이 트랙이 열림" "code=$E"
curl -sS -X PUT "$B/admin/tracks/$TID/requirements" "${A[@]}" -d '{"requirements":[{"kind":"DOCUMENT","refCode":"IDENTITY"}]}' >/dev/null
ACT=$(curl -sS -X PATCH "$B/admin/tracks/$TID/active" "${A[@]}" -d '{"isActive":true}' | J "['isActive']")
[ "$ACT" = "True" ] && ok "요건을 정의하면 열림 — 배포 없이" || bad "요건이 있는데 열리지 않음" "$ACT"
psql "$DB" -q -c "DELETE FROM tracks WHERE id='$TID'; DELETE FROM industries WHERE id='$IID';" 2>/dev/null

# ── 12. 급여 계산 차단 (§6-8) ───────────────────────────────────────────
head_ "12. 24시간 상주 근무 기록 — U5로 차단"
psql "$DB" -q -c "UPDATE care_requests SET shift_pattern_code='H24_LIVE_IN' WHERE id='$R1';"
curl -sS -X POST "$B/care-assignments/$AID/end" "${CH[@]}" -d "{\"checkMethod\":\"QR\",\"qrToken\":\"$HOSP:101호\"}" >/dev/null
OUT=$(curl -sS -X POST "$B/admin/jobs/work-record-aggregate/run" "${A[@]}")
echo "$OUT" | grep -q '"skipped"' && ok "집계 잡이 24시간 건을 건너뜀" || bad "잡 응답이 예상과 다름" "$OUT"

# ── 결과 ────────────────────────────────────────────────────────────────
printf '\n\033[1m통과 %d · 실패 %d\033[0m\n' "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ] || exit 1
