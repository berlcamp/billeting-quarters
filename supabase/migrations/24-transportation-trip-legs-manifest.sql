-- 24-transportation-trip-legs-manifest.sql
-- Reshapes the Transportation module to model real terminal-to-terminal trips:
--
--   * A `vehicle_dispatches` row becomes the umbrella TRIP for a single bus
--     journey, with multiple legs and multiple passenger groups.
--   * `vehicle_trip_legs` records each departure→arrival segment with its own
--     timestamps. A trip is in_transit while any leg has no arrival.
--   * `vehicle_trip_manifest` carries the delegation/team passenger groups on
--     the trip. Counts drain across legs as groups drop off.
--   * `vehicle_trip_dropoffs` is the per-leg per-group event log used for
--     reports and history.
--
-- Legacy fields on `vehicle_dispatches` (sport / team_count / expected_pax /
-- delegation_id) are dropped because each trip now carries N delegations and
-- N teams via the manifest. Existing dispatch rows are wiped (per user
-- decision); vehicle_logs.dispatch_id is ON DELETE SET NULL so raw scans
-- survive but lose the link to deleted dispatches.
--
-- The script is idempotent.

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. Wipe legacy dispatches
-- ----------------------------------------------------------------------------
-- vehicle_logs.dispatch_id FK is ON DELETE SET NULL, so this is safe.
DELETE FROM palaro.vehicle_dispatches;

-- ----------------------------------------------------------------------------
-- 2. Drop legacy dispatch columns (replaced by manifest)
-- ----------------------------------------------------------------------------
ALTER TABLE palaro.vehicle_dispatches
  DROP COLUMN IF EXISTS sport,
  DROP COLUMN IF EXISTS team_count,
  DROP COLUMN IF EXISTS expected_pax,
  DROP COLUMN IF EXISTS delegation_id;

-- Add trip closure tracking
ALTER TABLE palaro.vehicle_dispatches
  ADD COLUMN IF NOT EXISTS closed_by UUID REFERENCES palaro.profiles(id),
  ADD COLUMN IF NOT EXISTS force_closed_reason TEXT;

-- ----------------------------------------------------------------------------
-- 3. One-open-trip-per-vehicle invariant
-- ----------------------------------------------------------------------------
-- A vehicle can only have one trip in scheduled or in_transit status at a
-- time. The action layer also enforces this, but the partial unique index is
-- the durable backstop.
DROP INDEX IF EXISTS palaro.vehicle_dispatches_one_open_per_vehicle;
CREATE UNIQUE INDEX vehicle_dispatches_one_open_per_vehicle
  ON palaro.vehicle_dispatches(vehicle_id)
  WHERE status IN ('scheduled', 'in_transit');

-- ----------------------------------------------------------------------------
-- 4. Trip legs — one row per departure→arrival segment
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS palaro.vehicle_trip_legs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispatch_id UUID NOT NULL REFERENCES palaro.vehicle_dispatches(id) ON DELETE CASCADE,
  leg_order INTEGER NOT NULL CHECK (leg_order >= 1),
  from_site_id UUID REFERENCES palaro.sites(id),
  from_label TEXT,
  to_site_id UUID REFERENCES palaro.sites(id),
  to_label TEXT,
  departed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  departed_by UUID REFERENCES palaro.profiles(id),
  arrived_at TIMESTAMPTZ,
  arrived_by UUID REFERENCES palaro.profiles(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT vehicle_trip_legs_order_uq UNIQUE (dispatch_id, leg_order),
  CONSTRAINT vehicle_trip_legs_from_site_or_label CHECK (from_site_id IS NOT NULL OR from_label IS NOT NULL),
  CONSTRAINT vehicle_trip_legs_to_site_or_label CHECK (to_site_id IS NOT NULL OR to_label IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_vehicle_trip_legs_dispatch
  ON palaro.vehicle_trip_legs(dispatch_id, leg_order);
CREATE INDEX IF NOT EXISTS idx_vehicle_trip_legs_departed_at
  ON palaro.vehicle_trip_legs(departed_at DESC);

-- At most one open (un-arrived) leg per dispatch.
DROP INDEX IF EXISTS palaro.vehicle_trip_legs_one_open_per_dispatch;
CREATE UNIQUE INDEX vehicle_trip_legs_one_open_per_dispatch
  ON palaro.vehicle_trip_legs(dispatch_id)
  WHERE arrived_at IS NULL;

-- ----------------------------------------------------------------------------
-- 5. Manifest — passenger groups carried by a trip
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS palaro.vehicle_trip_manifest (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dispatch_id UUID NOT NULL REFERENCES palaro.vehicle_dispatches(id) ON DELETE CASCADE,
  delegation_id UUID REFERENCES palaro.delegations(id),
  team_name TEXT NOT NULL,
  total_passengers INTEGER NOT NULL CHECK (total_passengers >= 1),
  dropped_off INTEGER NOT NULL DEFAULT 0 CHECK (dropped_off >= 0 AND dropped_off <= total_passengers),
  boarded_at_leg_id UUID REFERENCES palaro.vehicle_trip_legs(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vehicle_trip_manifest_dispatch
  ON palaro.vehicle_trip_manifest(dispatch_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_trip_manifest_delegation
  ON palaro.vehicle_trip_manifest(delegation_id);

DROP TRIGGER IF EXISTS trg_vehicle_trip_manifest_updated ON palaro.vehicle_trip_manifest;
CREATE TRIGGER trg_vehicle_trip_manifest_updated
  BEFORE UPDATE ON palaro.vehicle_trip_manifest
  FOR EACH ROW EXECUTE FUNCTION palaro.update_updated_at_column();

-- ----------------------------------------------------------------------------
-- 6. Dropoff events — per-leg per-group history
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS palaro.vehicle_trip_dropoffs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  leg_id UUID NOT NULL REFERENCES palaro.vehicle_trip_legs(id) ON DELETE CASCADE,
  manifest_id UUID NOT NULL REFERENCES palaro.vehicle_trip_manifest(id) ON DELETE CASCADE,
  count INTEGER NOT NULL CHECK (count >= 1),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  recorded_by UUID REFERENCES palaro.profiles(id),
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_vehicle_trip_dropoffs_leg
  ON palaro.vehicle_trip_dropoffs(leg_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_trip_dropoffs_manifest
  ON palaro.vehicle_trip_dropoffs(manifest_id);

COMMIT;
