-- 20-vip-movement-merge-logs.sql
-- Folds the previous "VIP Logs" tab into the unified Log Movement form.
-- The whereabouts/request fields now live directly on palaro.vip_movements,
-- and the standalone request_status workflow is retired (Command Center will
-- track the request inline with the movement instead).
--
-- Net schema deltas on palaro.vip_movements:
--   + from_location TEXT
--   + to_location   TEXT
--   + request       TEXT
--   + remarks       TEXT
--   - notes         (dropped — superseded by remarks/request)
--
-- Idempotent. Apply via the Supabase SQL editor.

BEGIN;

ALTER TABLE palaro.vip_movements
  ADD COLUMN IF NOT EXISTS from_location TEXT,
  ADD COLUMN IF NOT EXISTS to_location   TEXT,
  ADD COLUMN IF NOT EXISTS request       TEXT,
  ADD COLUMN IF NOT EXISTS remarks       TEXT;

ALTER TABLE palaro.vip_movements
  DROP COLUMN IF EXISTS notes;

COMMIT;
