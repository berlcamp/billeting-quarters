-- 36-bq-head-role.sql
-- Adds the `bq_head` (Billeting-Quarter Head) role. Like `delegation_head`,
-- it is scoped to one delegation, but it is the only role that may encode
-- the daily Head Counter for that delegation. The Head Counter module is
-- the only module a BQ Head can reach.
--
-- Note: ALTER TYPE ... ADD VALUE may not be combined with usage of the new
-- value inside the same transaction, so this migration is intentionally
-- isolated and not wrapped in BEGIN/COMMIT. It is idempotent.

ALTER TYPE palaro.user_role ADD VALUE IF NOT EXISTS 'bq_head';
