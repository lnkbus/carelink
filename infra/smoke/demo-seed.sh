#!/usr/bin/env bash
#
# 데모 데이터. 화면을 눌러 보려면 데이터가 있어야 합니다.
#
#   bash infra/smoke/demo-seed.sh [API_URL] [DATABASE_URL]
#
# 고정 번호를 씁니다 — 매번 새 번호를 만들면 로그인할 때마다 찾아야 합니다.
# 인증번호는 개발 환경에서 화면에 표시됩니다.
#
#   01011110001  운영자
#   01022220001  기관 담당자 (검증 완료)
#   01022220002  기관 담당자 (검증 대기 — 개인정보 게이트 확인용)
#   01033330001  후보자
#   01044440001~3  간병사 3명
#   01055550001  보호자
#
# **운영 DB에 돌리지 마세요.** 이 스크립트는 계정을 만듭니다.
set -uo pipefail

B="${1:-http://127.0.0.1:3000/api/v1}"
DB="${2:-postgres://carelink:carelink@127.0.0.1:5432/carelink}"

J() { python3 -c "import sys,json;d=json.load(sys.stdin);print(d$1)" 2>/dev/null; }
say() { printf '\033[1m%s\033[0m\n' "$1"; }

# OTP 쿨다운은 번호당 30초입니다. 시드가 로그인을 여러 번 하므로 미리 지웁니다.
redis-cli --scan --pattern 'otp:cooldown:*' 2>/dev/null | xargs -r redis-cli DEL >/dev/null 2>&1

login() {
  local p="$1" c
  c=$(curl -sS -X POST "$B/auth/otp/send" -H 'content-type: application/json' -d "{\"phone\":\"$p\"}" | J "['devCode']")
  [ -z "$c" ] && { redis-cli DEL "otp:cooldown:$p" >/dev/null 2>&1
                   c=$(curl -sS -X POST "$B/auth/otp/send" -H 'content-type: application/json' -d "{\"phone\":\"$p\"}" | J "['devCode']"); }
  curl -sS -X POST "$B/auth/otp/verify" -H 'content-type: application/json' \
    -d "{\"phone\":\"$p\",\"code\":\"$c\",\"consents\":[{\"code\":\"TOS\",\"version\":\"v1\",\"agreed\":true},{\"code\":\"PRIVACY\",\"version\":\"v1\",\"agreed\":true}]}" \
    | python3 -c "import sys,json;d=json.load(sys.stdin);print(d['accessToken'],d['refreshToken'],d['me']['id'])" 2>/dev/null
}
reissue() { curl -sS -X POST "$B/auth/refresh" -H 'content-type: application/json' -d "{\"refreshToken\":\"$1\"}" | J "['accessToken']"; }
role() { curl -sS -X POST "$B/auth/roles" -H "authorization: Bearer $1" -H 'content-type: application/json' -d "$2" >/dev/null; }

say "1/6 운영자"
read -r AT AR AU <<<"$(login 01011110001)"
psql "$DB" -q -c "INSERT INTO user_roles (user_id, role, is_primary, approved_at) VALUES ('$AU','ADMIN',true,now()) ON CONFLICT DO NOTHING;"
AT=$(reissue "$AR"); A=(-H "authorization: Bearer $AT" -H 'content-type: application/json')

say "2/6 기관 2곳"
IND=$(psql "$DB" -tAqc "SELECT id FROM industries WHERE code='CARE';" | tr -d '[:space:]')
TRK=$(psql "$DB" -tAqc "SELECT id FROM tracks WHERE code='HOSPITAL_CAREGIVER';" | tr -d '[:space:]')
ORG_V=$(psql "$DB" -tAqc "INSERT INTO organizations (name, industry_id, org_type, business_reg_no, region, verification_status, e7_sponsor_status)
  VALUES ('서울중앙요양병원','$IND','HOSPITAL','111-22-33333','서울','VERIFIED','ELIGIBLE') RETURNING id;" | tr -d '[:space:]')
ORG_P=$(psql "$DB" -tAqc "INSERT INTO organizations (name, industry_id, org_type, business_reg_no, region, verification_status)
  VALUES ('분당실버케어','$IND','NURSING_HOME','444-55-66666','경기','PENDING') RETURNING id;" | tr -d '[:space:]')

read -r OT OR OU <<<"$(login 01022220001)"
role "$OT" "{\"role\":\"ORG_MEMBER\",\"organizationId\":\"$ORG_V\",\"makePrimary\":true}"
psql "$DB" -q -c "UPDATE user_roles SET approved_at = now() WHERE user_id='$OU' AND role='ORG_MEMBER';"
read -r PT PR PU <<<"$(login 01022220002)"
role "$PT" "{\"role\":\"ORG_MEMBER\",\"organizationId\":\"$ORG_P\",\"makePrimary\":true}"
psql "$DB" -q -c "UPDATE user_roles SET approved_at = now() WHERE user_id='$PU' AND role='ORG_MEMBER';"

say "3/6 채용 요청"
OT=$(reissue "$OR"); O=(-H "authorization: Bearer $OT" -H 'content-type: application/json')
JOB=$(curl -sS -X POST "$B/jobs" "${O[@]}" -d "{\"title\":\"병원 간병사 (3교대)\",\"trackId\":\"$TRK\",\"region\":\"서울\",\"headcount\":3,\"minExperienceYrs\":1,\"employmentType\":\"FULL_TIME\",\"dormProvided\":true,\"salaryMin\":2800000,\"salaryMax\":3200000,\"salaryVisibility\":\"AFTER_MATCH\"}" | J "['id']")
curl -sS -X PATCH "$B/jobs/$JOB/status" "${O[@]}" -d '{"status":"OPEN"}' >/dev/null

say "4/6 후보자 2명 (트랙·서류·지원까지)"
# 후보자를 만들기만 하면 대시보드가 전부 0으로 보입니다. 트랙·서류·지원까지
# 넣어야 파이프라인이 실제로 그려집니다.
mkcand() {
  local phone="$1" code="$2" name="$3" nat="$4" visa="$5" st="$6" exp="$7"
  local t r u cid
  read -r t r u <<<"$(login "$phone")"
  role "$t" '{"role":"CANDIDATE","makePrimary":true}'
  cid=$(psql "$DB" -tAqc \
    "INSERT INTO candidates (user_id, display_code, name, nationality, visa_status_code,
                             visa_expires_on, current_location, preferred_regions,
                             employment_types, dorm_required, available_from, status)
     VALUES ('$u', '$code', '$name', '$nat', NULLIF('$visa',''), NULLIF('$exp','')::date,
             '서울', ARRAY['서울','경기'], ARRAY['FULL_TIME'], true, current_date, '$st')
     ON CONFLICT (user_id) DO UPDATE SET status = EXCLUDED.status
     RETURNING id;" | tr -d '[:space:]')
  psql "$DB" -q -c \
    "INSERT INTO candidate_tracks (candidate_id, track_id, is_primary)
     VALUES ('$cid', '$TRK', true) ON CONFLICT DO NOTHING;"
  echo "$cid"
}

# 세 사람이 '취업 가능' 세 상태를 각각 보여줍니다. 이 구분이 화면에서
# 뭉개지면 판정 전인 후보자가 취업 불가로 보입니다.
#   E-9  × 병원간병 → NOT_ALLOWED  (비전문취업은 지정 업종만)
#   무비자(내국인)   → PENDING      (아직 확인 전 — 불가가 아님)
#   H-2  × 병원간병 → ALLOWED      (방문취업. 고려인 세그먼트 · docs/08)
C1=$(mkcand 01033330001 CD-1001 "응우옌 티 흐엉" 베트남 E-9 READY 2027-06-30)
C2=$(mkcand 01033330002 CD-1002 "김민서" 대한민국 "" DOC_REVIEW "")
C3=$(mkcand 01033330003 CD-1003 "박 스베틀라나" 우즈베키스탄 H-2 READY 2028-03-31)
psql "$DB" -q -c "UPDATE users SET locale = 'ru' WHERE phone = '01033330003';"

# 서류 — 하나는 검증 완료, 하나는 만료 임박(D-20)이라 카운트다운이 보입니다.
psql "$DB" -q -c \
  "INSERT INTO documents (candidate_id, doc_type, file_key, file_name, status,
                          reviewed_at, expires_at, verdict)
   VALUES ('$C1','IDENTITY','demo/id1','외국인등록증.pdf','VERIFIED', now(), current_date + 400, NULL),
          ('$C1','HEALTH',  'demo/h1', '건강진단서.pdf',  'VERIFIED', now(), current_date + 20, 'FIT'),
          ('$C2','IDENTITY','demo/id2','주민등록증.pdf',  'UNDER_REVIEW', NULL, NULL, NULL),
          ('$C3','IDENTITY','demo/id3','외국인등록증.pdf','VERIFIED', now(), current_date + 500, NULL);"

# 지원 1건 — 기관 웹에서 후보자 검색·매칭 근거가 보입니다.
psql "$DB" -q -c \
  "INSERT INTO applications (job_id, candidate_id, status)
   VALUES ('$JOB', '$C1', 'APPLIED') ON CONFLICT DO NOTHING;"

say "5/6 간병사 3명 (클리어런스 통과)"
CGS=()
for i in 1 2 3; do
  P="0104444000$i"
  U=$(psql "$DB" -tAqc "SELECT id FROM users WHERE phone='$P';" | tr -d '[:space:]')
  if [ -z "$U" ]; then
    U=$(psql "$DB" -tAqc "INSERT INTO users (phone, locale, status) VALUES ('$P','ko','ACTIVE') RETURNING id;" | tr -d '[:space:]')
    psql "$DB" -q -c "INSERT INTO user_roles (user_id, role, is_primary, approved_at) VALUES ('$U','CAREGIVER',true,now());"
  fi
  CG=$(psql "$DB" -tAqc "INSERT INTO caregivers (user_id, display_code, experience_yrs, rating_avg, completed_count)
    VALUES ('$U','CG-100$i', $((i*2+1)), 4.$((i+4)), $((i*11)))
    ON CONFLICT (user_id) DO UPDATE SET experience_yrs = EXCLUDED.experience_yrs RETURNING id;" | tr -d '[:space:]')
  psql "$DB" -q -c "INSERT INTO caregiver_availability (caregiver_id, starts_at, ends_at) VALUES ('$CG','2020-01-01','2030-12-31');"
  # 3번은 클리어런스 하나를 일부러 비워 둡니다 — 매칭에서 빠지는 것을 보여주려고.
  LIST="IDENTITY_VERIFIED CRIMINAL_RECORD_CLEAR HEALTH_CHECK VISA_ELIGIBLE MANDATORY_TRAINING SCOPE_TRAINING"
  [ "$i" = "3" ] && LIST="IDENTITY_VERIFIED CRIMINAL_RECORD_CLEAR HEALTH_CHECK VISA_ELIGIBLE MANDATORY_TRAINING"
  for t in $LIST; do
    curl -sS -X POST "$B/admin/clearances/workers/$U/$t" "${A[@]}" -d '{"result":"PASS"}' >/dev/null
  done
  CGS+=("$CG")
done

say "6/6 병원 · 보호자 · 간병 요청"
H1=$(psql "$DB" -tAqc "INSERT INTO hospitals (name, region, is_partner) VALUES ('서울성모병원','서울',true) RETURNING id;" | tr -d '[:space:]')
psql "$DB" -q -c "INSERT INTO hospitals (name, region, is_partner) VALUES ('분당서울대병원','경기',true),('강남세브란스병원','서울',true);"
read -r GT GR GU <<<"$(login 01055550001)"
role "$GT" '{"role":"PATIENT_GUARDIAN","makePrimary":true}'
GT=$(reissue "$GR"); G=(-H "authorization: Bearer $GT" -H 'content-type: application/json')

# (a) 정상 요청 — 매칭까지 진행
R1=$(curl -sS -X POST "$B/care-requests" "${G[@]}" -d "{\"hospitalId\":\"$H1\",\"ward\":\"703호\",\"serviceType\":\"DAY\",\"shiftPatternCode\":\"H8_3SHIFT\",\"startAt\":\"$(date -u -d 'tomorrow 00:00' +%Y-%m-%dT%H:%M:%SZ)\",\"endAt\":\"$(date -u -d 'tomorrow 08:00' +%Y-%m-%dT%H:%M:%SZ)\",\"supportItems\":[\"MEAL_SUPPORT\",\"MOBILITY\"],\"mobilityLevel\":\"PARTIAL_ASSIST\",\"cautions\":\"밤에 자주 깨십니다. 화장실 이동을 도와주세요.\"}" | J "['id']")
curl -sS -X PATCH "$B/care-requests/$R1/status" "${A[@]}" -d '{"status":"MATCHING"}' >/dev/null

# (b) 업무범위 감지 요청 — OPS_REVIEW 큐에 남습니다
curl -sS -X POST "$B/care-requests" "${G[@]}" -d "{\"hospitalId\":\"$H1\",\"ward\":\"502호\",\"serviceType\":\"DAY\",\"shiftPatternCode\":\"H8_3SHIFT\",\"startAt\":\"$(date -u -d 'tomorrow 09:00' +%Y-%m-%dT%H:%M:%SZ)\",\"supportItems\":[\"HYGIENE\"],\"mobilityLevel\":\"FULL_ASSIST\",\"cautions\":\"인슐린 주사를 하루 두 번 놓아주시고 욕창 소독도 부탁드립니다.\"}" >/dev/null

# (c) 간병사 1번에게 제안 → 수락 → 운영자 확인까지
A1=$(curl -sS -X POST "$B/care-requests/$R1/assign" "${G[@]}" -d "{\"caregiverId\":\"${CGS[0]}\",\"shiftStartTime\":\"09:00\",\"shiftEndTime\":\"17:00\"}" | J "['id']")
read -r c1t c1r _ <<<"$(login 01044440001)"
curl -sS -X PATCH "$B/care-assignments/$A1/status" -H "authorization: Bearer $c1t" -H 'content-type: application/json' -d '{"status":"ACCEPTED"}' >/dev/null
curl -sS -X PATCH "$B/care-assignments/$A1/status" "${A[@]}" -d '{"status":"ASSIGNED"}' >/dev/null

# 시드가 로그인하면서 남긴 쿨다운을 지웁니다. 안 지우면 시드 직후 30초 동안
# 브라우저에서 로그인이 막히고, 처음 써 보는 사람은 그걸 고장으로 읽습니다.
redis-cli --scan --pattern 'otp:cooldown:*' 2>/dev/null | xargs -r redis-cli DEL >/dev/null 2>&1

echo
say "완료. 로그인 번호 (인증번호는 화면에 표시됩니다)"
cat <<TXT

  운영자         01011110001   :3100
  기관 (검증완료) 01022220001   :3200
  기관 (검증대기) 01022220002   :3200   ← 개인정보 게이트 비교용
  후보자         01033330001   :3300   ← 배치 준비 · 서류 2건 (1건 D-20)
                 01033330002           서류 검토 중 · 취업 가능 '확인 중'
                 01033330003           H-2 · 취업 '가능' · 러시아어 (고려인)
  보호자         01055550001   :3400
  간병사         01044440001   :3500   ← 오늘 근무 1건 배정됨
                 01044440002           비어 있음
                 01044440003           클리어런스 5/6 (매칭에서 빠짐)

  병실 QR 토큰   $H1:703호

TXT
