-- 42-raffle-manager-role.sql
-- Adds the `raffle_manager` role. Holds the full raffle permission set
-- (raffle.view, raffle.manage, raffle.draw) so it can run raffles end-to-end
-- without needing super admin. No other permissions — Raffle is the only
-- module this role can reach.
--
-- Note: ALTER TYPE ... ADD VALUE cannot be combined with usage of the new
-- value inside the same transaction in some Postgres versions, so this
-- migration is intentionally not wrapped in BEGIN/COMMIT. It is idempotent.

ALTER TYPE palaro.user_role ADD VALUE IF NOT EXISTS 'raffle_manager';
