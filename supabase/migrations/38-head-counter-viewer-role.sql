-- 38-head-counter-viewer-role.sql
-- Adds the `head_counter_viewer` role. View-only access to the Head Counter
-- module (across all delegations) and the consolidated print sheet — no
-- encoding, no other modules. Implemented by granting `head_count.view_all`
-- with no other permissions in code.
--
-- Note: ALTER TYPE ... ADD VALUE cannot be combined with usage of the new
-- value inside the same transaction in some Postgres versions, so this
-- migration is intentionally not wrapped in BEGIN/COMMIT. It is idempotent.

ALTER TYPE palaro.user_role ADD VALUE IF NOT EXISTS 'head_counter_viewer';
