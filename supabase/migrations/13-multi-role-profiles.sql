-- 13-multi-role-profiles.sql
-- Convert palaro.profiles.role (single user_role) → palaro.profiles.roles (user_role[]).
-- Updates the auth-link trigger and the RLS helpers/policies that referenced the
-- single-role column so a user can hold any combination of roles at once.

BEGIN;

-- 1. Add the array column with a safe empty default so the migration can run
--    on a populated table without violating NOT NULL.
ALTER TABLE palaro.profiles
  ADD COLUMN IF NOT EXISTS roles palaro.user_role[] NOT NULL DEFAULT '{}';

-- 2. Backfill: every existing single role becomes a one-element array.
UPDATE palaro.profiles
   SET roles = ARRAY[role]::palaro.user_role[]
 WHERE role IS NOT NULL
   AND cardinality(roles) = 0;

-- 3. Swap the index. GIN supports the ANY()/&& operators we'll use in RLS.
DROP INDEX IF EXISTS palaro.idx_profiles_role;
CREATE INDEX IF NOT EXISTS idx_profiles_roles
  ON palaro.profiles USING GIN (roles);

-- 4. Auth-link trigger: a profile is "invitable" once it has at least one role.
CREATE OR REPLACE FUNCTION palaro.handle_new_auth_user()
RETURNS TRIGGER AS $$
DECLARE
  existing_profile_id UUID;
BEGIN
  SELECT id INTO existing_profile_id
  FROM palaro.profiles
  WHERE email = NEW.email
    AND auth_user_id IS NULL
    AND status = 'active'
    AND cardinality(roles) > 0
  LIMIT 1;

  IF existing_profile_id IS NULL THEN
    RAISE EXCEPTION 'Email % is not authorized for PPDMS. Contact your administrator to request access.', NEW.email
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  UPDATE palaro.profiles
  SET auth_user_id = NEW.id,
      activated_at = NOW(),
      full_name = COALESCE(full_name, NEW.raw_user_meta_data->>'full_name'),
      avatar_url = COALESCE(avatar_url, NEW.raw_user_meta_data->>'avatar_url')
  WHERE id = existing_profile_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = palaro, public;

-- 5. Replace the single-role RLS helper with an array-returning one plus a
--    convenience predicate so policies stay readable.
CREATE OR REPLACE FUNCTION palaro.current_user_roles()
RETURNS palaro.user_role[] AS $$
  SELECT roles FROM palaro.profiles
  WHERE auth_user_id = auth.uid() AND status = 'active';
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = palaro, public;

CREATE OR REPLACE FUNCTION palaro.current_user_has_role(target palaro.user_role)
RETURNS BOOLEAN AS $$
  SELECT target = ANY(palaro.current_user_roles());
$$ LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = palaro, public;

-- 6. Rebuild every policy that referenced the old single-role helper.
DROP POLICY IF EXISTS "Super admin reads all profiles" ON palaro.profiles;
CREATE POLICY "Super admin reads all profiles" ON palaro.profiles
  FOR SELECT USING (palaro.current_user_has_role('super_admin'));

DROP POLICY IF EXISTS "Command center reads all profiles" ON palaro.profiles;
CREATE POLICY "Command center reads all profiles" ON palaro.profiles
  FOR SELECT USING (palaro.current_user_has_role('command_center'));

DROP POLICY IF EXISTS "Admins update incidents" ON palaro.incidents;
CREATE POLICY "Admins update incidents" ON palaro.incidents FOR UPDATE USING (
  palaro.current_user_roles() && ARRAY[
    'super_admin', 'command_center',
    'medical_field', 'medical_ucf', 'medical_hospital'
  ]::palaro.user_role[]
);

DROP POLICY IF EXISTS "User sees own notifications" ON palaro.notifications;
CREATE POLICY "User sees own notifications" ON palaro.notifications FOR SELECT USING (
  recipient_id = palaro.current_profile_id()
  OR recipient_role = ANY(palaro.current_user_roles())
);

-- 7. Drop the now-unused single-role helper. Anything still calling it will
--    error loudly instead of silently returning the wrong answer.
DROP FUNCTION IF EXISTS palaro.current_user_role();

-- 8. Drop the old column last, after every dependency is gone.
ALTER TABLE palaro.profiles DROP COLUMN IF EXISTS role;

COMMIT;
