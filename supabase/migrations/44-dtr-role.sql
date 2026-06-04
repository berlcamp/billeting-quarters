-- 44-dtr-role.sql
-- Adds the `dtr` role. Holds a single dedicated permission (dtr.view) that
-- grants access to the Personnel → DTR module only. No other permissions —
-- DTR is the only module this role can reach. The dtr.view permission lives
-- in code (src/lib/permissions.ts); there is nothing else to migrate here.
--
-- Note: ALTER TYPE ... ADD VALUE cannot be combined with usage of the new
-- value inside the same transaction in some Postgres versions, so this
-- migration is intentionally not wrapped in BEGIN/COMMIT. It is idempotent.

ALTER TYPE palaro.user_role ADD VALUE IF NOT EXISTS 'dtr';
