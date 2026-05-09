-- 16-vip-protocol-officer-and-logs.sql
-- Implements the Protocol Officers Assignment + VIP Tracking spec:
--   1. Each VIP is assigned to exactly one Protocol Officer (1 VIP : 1 PO).
--      The assignment is stored on palaro.vip_persons.protocol_officer_id and
--      is UNIQUE so no two VIPs can share the same officer.
--   2. New palaro.vip_logs table captures whereabouts (from→to), free-form
--      requests/concerns, a request status that Command Center can update,
--      and remarks. The logged_at column auto-stamps system time per the spec.
--
-- Idempotent. Apply via the Supabase SQL editor.

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Request-status enum for VIP log entries.
--    Command Center transitions: pending → in_progress → completed | denied.
-- ----------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE palaro.vip_log_request_status AS ENUM (
    'pending',
    'in_progress',
    'completed',
    'denied'
  );
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

-- ----------------------------------------------------------------------------
-- 2. 1-to-1 Protocol Officer assignment on the VIP record.
--    A profile (the auth-bound system user) is the assignment target so the
--    app can auto-detect the signed-in officer's VIP.
-- ----------------------------------------------------------------------------
ALTER TABLE palaro.vip_persons
  ADD COLUMN IF NOT EXISTS protocol_officer_id UUID
    REFERENCES palaro.profiles(id) ON DELETE SET NULL;

-- UNIQUE on the column would forbid multiple NULLs in older Postgres; in 9.0+
-- multiple NULLs are allowed by default, so a plain UNIQUE index is correct
-- and keeps the 1-VIP-to-1-PO invariant.
DROP INDEX IF EXISTS palaro.idx_vip_persons_protocol_officer_unique;
CREATE UNIQUE INDEX idx_vip_persons_protocol_officer_unique
  ON palaro.vip_persons (protocol_officer_id)
  WHERE protocol_officer_id IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 3. VIP log table — one row per request / whereabouts entry.
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS palaro.vip_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vip_id UUID NOT NULL REFERENCES palaro.vip_persons(id) ON DELETE CASCADE,
  protocol_officer_id UUID REFERENCES palaro.profiles(id),  -- the profile that wrote the entry
  from_location TEXT,
  to_location TEXT,
  logged_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),  -- system time per spec
  request TEXT,
  request_status palaro.vip_log_request_status NOT NULL DEFAULT 'pending',
  remarks TEXT,
  status_updated_by UUID REFERENCES palaro.profiles(id),  -- command center user
  status_updated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vip_logs_vip
  ON palaro.vip_logs (vip_id, logged_at DESC);

CREATE INDEX IF NOT EXISTS idx_vip_logs_request_status
  ON palaro.vip_logs (request_status);

-- updated_at trigger reuses the schema's existing helper.
DROP TRIGGER IF EXISTS trg_vip_logs_updated ON palaro.vip_logs;
CREATE TRIGGER trg_vip_logs_updated
  BEFORE UPDATE ON palaro.vip_logs
  FOR EACH ROW EXECUTE FUNCTION palaro.update_updated_at_column();

COMMIT;

-- ----------------------------------------------------------------------------
-- 4. Realtime — must run outside the transaction.
-- ----------------------------------------------------------------------------
DO $$ BEGIN
  EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE palaro.vip_logs';
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;
