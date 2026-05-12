-- 25-garbage-cancelled-status.sql
-- Adds "cancelled" to palaro.garbage_collection_status so a logger or
-- information hub officer can cancel a specific venue's scheduled pickup
-- (with one-click undo back to "scheduled").
--
-- ALTER TYPE ... ADD VALUE cannot be wrapped in a transaction in older
-- Postgres versions, so this migration intentionally has no BEGIN/COMMIT.
-- Idempotent — IF NOT EXISTS guards the add.

ALTER TYPE palaro.garbage_collection_status
  ADD VALUE IF NOT EXISTS 'cancelled';
