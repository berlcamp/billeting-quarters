-- 19-vip-many-vips-per-officer.sql
-- VIP creation moves to Command Center / Super Admin, who assigns each VIP to
-- a Protocol Officer at creation. One Protocol Officer may now be assigned
-- multiple VIPs, so the previous 1-VIP-to-1-PO unique index is dropped and
-- replaced with a plain (non-unique) index that still keeps lookups fast.
--
-- Idempotent. Apply via the Supabase SQL editor.

BEGIN;

DROP INDEX IF EXISTS palaro.idx_vip_persons_protocol_officer_unique;

CREATE INDEX IF NOT EXISTS idx_vip_persons_protocol_officer
  ON palaro.vip_persons (protocol_officer_id)
  WHERE protocol_officer_id IS NOT NULL;

COMMIT;
