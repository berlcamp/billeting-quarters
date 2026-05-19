-- 40-command-center-viewer-role.sql
-- Adds the `command_center_viewer` role. View-only access to the Command
-- Center dashboard and nothing else — every outbound link from the dashboard
-- is rendered as plain (non-clickable) content because the role grants no
-- module-level permissions.
--
-- Note: ALTER TYPE ... ADD VALUE cannot be combined with usage of the new
-- value inside the same transaction in some Postgres versions, so this
-- migration is intentionally not wrapped in BEGIN/COMMIT. It is idempotent.

ALTER TYPE palaro.user_role ADD VALUE IF NOT EXISTS 'command_center_viewer';
