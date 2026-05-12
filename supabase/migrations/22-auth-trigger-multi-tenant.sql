-- 22-auth-trigger-multi-tenant.sql
-- Make palaro.handle_new_auth_user safe to coexist with other apps that share
-- the same Supabase project (e.g. SUMMIT). Previously, ANY auth.users INSERT
-- triggered a hard RAISE if the email wasn't in palaro.profiles — which aborted
-- the entire insert and broke sign-up for co-tenant apps.
--
-- New behavior: when the email is NOT in palaro.profiles, the trigger returns
-- NEW silently. The user is created in auth.users; PPDMS access is still gated
-- at the app layer by checkAccess() (src/lib/auth/access-check.ts), which
-- returns `not_authorized` whenever no palaro profile exists.
--
-- The other RAISE branches (already linked / suspended / no role) are kept,
-- because those apply to users who ARE in palaro.profiles and we still want to
-- block them at the door with a useful message.

BEGIN;

CREATE OR REPLACE FUNCTION palaro.handle_new_auth_user()
RETURNS TRIGGER AS $$
DECLARE
  matched_profile RECORD;
  normalized_email TEXT := LOWER(TRIM(NEW.email));
BEGIN
  SELECT id, status, roles, auth_user_id
  INTO matched_profile
  FROM palaro.profiles
  WHERE LOWER(TRIM(email)) = normalized_email
  LIMIT 1;

  -- Not a PPDMS user. Let the auth.users insert proceed so other apps sharing
  -- this Supabase project can handle their own users. App-level checkAccess()
  -- will block them from PPDMS.
  IF matched_profile.id IS NULL THEN
    RETURN NEW;
  END IF;

  IF matched_profile.auth_user_id IS NOT NULL THEN
    RAISE EXCEPTION 'Email % is already linked to a different account. Contact your administrator.', NEW.email
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF matched_profile.status <> 'active' THEN
    RAISE EXCEPTION 'Account for % is %. Contact your administrator.', NEW.email, matched_profile.status
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF matched_profile.roles IS NULL OR cardinality(matched_profile.roles) = 0 THEN
    RAISE EXCEPTION 'Account for % has no role assigned. Contact your administrator.', NEW.email
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  UPDATE palaro.profiles
  SET auth_user_id = NEW.id,
      activated_at = NOW(),
      full_name = COALESCE(full_name, NEW.raw_user_meta_data->>'full_name'),
      avatar_url = COALESCE(avatar_url, NEW.raw_user_meta_data->>'avatar_url')
  WHERE id = matched_profile.id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = palaro, public;

COMMIT;
