-- Make the auth.users → palaro.profiles linker tolerant of email casing
-- and stray whitespace. Also normalize existing rows so the unique index
-- and the trigger agree.
--
-- Why: production users were hitting "Database error saving new user" on
-- first Google sign-in because their invited profile.email was stored
-- mixed-case (admin paste / CSV import / older form path) while
-- auth.users.email arrives lowercase from Google. The case-sensitive
-- equality check rejected legitimate invitees and Supabase surfaces the
-- generic GoTrue error.

-- 1. Backfill: lowercase + trim every profile email. The form schema
--    already does this for new rows, but legacy rows need a one-shot.
UPDATE palaro.profiles
SET email = LOWER(TRIM(email))
WHERE email <> LOWER(TRIM(email));

-- 2. Replace the trigger function with a case-insensitive, trimmed match
--    and split the rejection paths so admins can tell from the audit logs
--    why a sign-in failed.
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

  IF matched_profile.id IS NULL THEN
    RAISE EXCEPTION 'Email % is not on the PPDMS access list. Contact your administrator to request an invitation.', NEW.email
      USING ERRCODE = 'insufficient_privilege';
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
