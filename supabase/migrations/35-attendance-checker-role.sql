-- 35-attendance-checker-role.sql
-- Adds the `attendance_checker` role. Holders can only access the Attendance
-- module (time-in / time-out logging) — no personnel CRUD, no other modules.
--
-- Note: ALTER TYPE ... ADD VALUE cannot be combined with other DDL inside the
-- same transaction in some Postgres versions, so this migration is intentionally
-- not wrapped in BEGIN/COMMIT. It is idempotent — IF NOT EXISTS guards the add.

ALTER TYPE palaro.user_role ADD VALUE IF NOT EXISTS 'attendance_checker';
