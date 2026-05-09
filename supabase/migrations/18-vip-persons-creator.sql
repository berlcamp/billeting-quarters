-- 18-vip-persons-creator.sql
-- Adds an explicit `created_by` to palaro.vip_persons so VIPs can be filtered
-- by their owning Protocol Officer. Per the new ownership rules:
--   - Only profiles with the protocol_officer role create VIPs.
--   - Each Protocol Officer only sees the VIPs they created.
--   - Command Center / super_admin see all VIPs (read-only).
--
-- Idempotent. Apply via the Supabase SQL editor.

BEGIN;

ALTER TABLE palaro.vip_persons
  ADD COLUMN IF NOT EXISTS created_by UUID
    REFERENCES palaro.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_vip_persons_created_by
  ON palaro.vip_persons(created_by);

-- Backfill: where a VIP already had a Protocol Officer assigned, treat that
-- officer as the original creator. Rows with neither assignment nor backfill
-- target stay NULL and remain visible only to Command Center / super_admin.
UPDATE palaro.vip_persons
   SET created_by = protocol_officer_id
 WHERE created_by IS NULL
   AND protocol_officer_id IS NOT NULL;

COMMIT;
