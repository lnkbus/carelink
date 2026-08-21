-- 전화번호를 E.164로 정규화한다 (2026-08-21 · 해외 거주 후보자 가입 개방).
--
-- 이 마이그레이션이 없으면 **기존 계정이 통째로 사라진 것처럼 보인다.**
-- 앱은 010…을 +8210…으로 정규화해 조회하는데 DB에는 010…이 그대로 있어서
-- 조회가 빗나가고, 서버는 "처음 오는 사람"으로 보고 새 계정을 만든다.
-- 새 계정에는 역할이 없으니 화면은 403을 받고 로그인으로 되돌아간다 —
-- 아무 오류도 없이. 실제로 그렇게 나왔다.

-- ── 1. 유령 계정에서 번호를 떼어 낸다 ───────────────────────────────────
--
-- 마이그레이션 전에 이미 로그인한 사람이 있으면 +8210…짜리 빈 계정이
-- 만들어져 있다. 그대로 두면 010…을 정규화할 때 유니크 제약에 부딪혀
-- **마이그레이션 전체가 실패**한다.
--
-- 지우지 않고 번호만 뗀다. 계정을 지우려 해도 audit_logs.actor_id가
-- NO ACTION이라 막히고, 무엇보다 **가입 시점의 감사 기록은 남아야 한다.**
-- 번호가 없으면 로그인 경로가 없으므로 계정은 사실상 닫힌다.
--
-- 대상을 좁게 잡는다: 이 충돌의 상대편이면서, 역할도 프로필도 소속도 없는
-- 계정만. 가입 부산물(동의 기록·감사 로그)은 판단에서 뺀다 — 그건 누구에게나
-- 생기는 것이라, 넣으면 정작 지워야 할 유령이 걸러지지 않는다.
UPDATE users ghost
   SET phone = NULL
 WHERE ghost.phone ~ '^\+82[0-9]+$'
   AND EXISTS (
     SELECT 1 FROM users old
      WHERE old.phone ~ '^0[0-9]{8,10}$'
        AND '+82' || substring(old.phone from 2) = ghost.phone
   )
   AND NOT EXISTS (SELECT 1 FROM user_roles         r WHERE r.user_id = ghost.id)
   AND NOT EXISTS (SELECT 1 FROM candidates         c WHERE c.user_id = ghost.id)
   AND NOT EXISTS (SELECT 1 FROM caregivers         g WHERE g.user_id = ghost.id)
   AND NOT EXISTS (SELECT 1 FROM organization_users o WHERE o.user_id = ghost.id);

-- ── 2. 국내 번호를 E.164로 ──────────────────────────────────────────────
--
-- 0으로 시작하는 국내 번호만 손댄다. 이미 +로 시작하는 값은 그대로 두고,
-- 그 밖의 형태는 사람이 봐야 하므로 건드리지 않는다.
-- 충돌이 남아 있는 행은 제외한다 — 한 건 때문에 전부 실패하면 안 된다.
UPDATE users old
   SET phone = '+82' || substring(old.phone from 2)
 WHERE old.phone ~ '^0[0-9]{8,10}$'
   AND NOT EXISTS (
     SELECT 1 FROM users other
      WHERE other.id <> old.id
        AND other.phone = '+82' || substring(old.phone from 2)
   );

-- ── 3. 남은 것을 말한다 ─────────────────────────────────────────────────
--
-- 조용히 넘어가면 그 계정 주인만 로그인이 안 되고 이유는 아무도 모른다.
DO $$
DECLARE left_over integer;
BEGIN
  SELECT count(*) INTO left_over
    FROM users WHERE phone IS NOT NULL AND phone NOT LIKE '+%';
  IF left_over > 0 THEN
    RAISE WARNING 'E.164로 옮기지 못한 전화번호 %건이 남았습니다. 같은 번호의 계정이 둘 있거나 형식이 예상과 다릅니다 — 확인이 필요합니다: SELECT id, phone FROM users WHERE phone NOT LIKE ''+%%'';', left_over;
  END IF;
END $$;
