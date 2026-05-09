-- 17-vip-movement-creator.sql
-- Adds an explicit `created_by` to palaro.vip_movements so movement mutations
-- (log arrival / set ETD / log departure / cancel) can be gated to the
-- creator. The existing `protocol_officer_id` is set only when the creator
-- holds the protocol_officer role, which leaves it null for Command Center
-- creators — too narrow to use for ownership.
--
-- Idempotent. Apply via the Supabase SQL editor.

BEGIN;

ALTER TABLE palaro.vip_movements
  ADD COLUMN IF NOT EXISTS created_by UUID
    REFERENCES palaro.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_vip_movements_created_by
  ON palaro.vip_movements(created_by);

-- Backfill: if updated_by is set but created_by is not, assume the same user
-- created the row. Keeps existing rows actionable after this migration.
UPDATE palaro.vip_movements
   SET created_by = updated_by
 WHERE created_by IS NULL
   AND updated_by IS NOT NULL;

COMMIT;
