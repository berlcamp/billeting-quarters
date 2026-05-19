-- 41-head-counter-technical-officials.sql
-- Adds a `technical_officials` value to the shared palaro.head_counter_role
-- enum. The Venue tab uses ONLY this role (single column), while the BQ tab
-- keeps its eight existing roles (athlete, chaperon, coach, delegation_twg,
-- rd, ard, sds, asds). Enforced in code via separate role lists per tab.
--
-- Note: ALTER TYPE ... ADD VALUE cannot be combined with usage of the new
-- value inside the same transaction in some Postgres versions, so this
-- migration is intentionally not wrapped in BEGIN/COMMIT. It is idempotent.

ALTER TYPE palaro.head_counter_role ADD VALUE IF NOT EXISTS 'technical_officials';
