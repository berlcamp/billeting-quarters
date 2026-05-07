-- 15-transportation-refactor.sql
-- Aligns the Transportation module with the Transportation 2 spec:
--
--   1. Two new roles  : transportation_head, transportation_driver
--   2. Multi-stop routes via palaro.vehicle_route_stops (route → ordered list of sites)
--   3. Per-trip dispatch records via palaro.vehicle_dispatches
--      (vehicle, route, delegation, sport, team_count, pax_total, from/to, status)
--   4. Fuel consumption inventory via palaro.vehicle_fuel_logs
--   5. Extended palaro.vehicle_logs with dispatch_id, delegation_id, sport,
--      from_site_id, to_site_id so every scan carries the spec's required
--      fields (delegation, team/s, pax/team, from, to).
--
-- Per Postgres rule: ALTER TYPE ... ADD VALUE cannot live inside a transaction
-- with other DDL on the new value. So enum additions are emitted standalone
-- before the BEGIN/COMMIT block. The whole script is idempotent.

-- ----------------------------------------------------------------------------
-- 1. Enum additions (must run outside the transaction)
-- ----------------------------------------------------------------------------
ALTER TYPE palaro.user_role ADD VALUE IF NOT EXISTS 'transportation_head';
ALTER TYPE palaro.user_role ADD VALUE IF NOT EXISTS 'transportation_driver';

-- New enum for dispatch lifecycle. Wrapped in a DO block so re-runs are safe.
DO $$ BEGIN
  CREATE TYPE palaro.dispatch_status AS ENUM (
    'scheduled',   -- created but vehicle hasn't moved yet
    'in_transit',  -- at least one log recorded, no destination scan yet
    'completed',   -- destination scan recorded
    'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ----------------------------------------------------------------------------
-- 2. Tables and column additions
-- ----------------------------------------------------------------------------
BEGIN;

-- Multi-stop routes ----------------------------------------------------------
-- Existing palaro.vehicle_routes keeps origin_site_id / destination_site_id as
-- denormalised summary columns (they remain nullable). The ordered stop list
-- lives in vehicle_route_stops. A route's first stop is the origin; the last
-- stop is the final destination — but mid-route stops are first-class so we
-- can match the 5-route loop pattern from the spec.
--
-- Routes are now templates: any vehicle from the dispatch pool can run them,
-- so vehicle_id becomes nullable. Existing rows are unaffected.
ALTER TABLE palaro.vehicle_routes
  ALTER COLUMN vehicle_id DROP NOT NULL;
CREATE TABLE IF NOT EXISTS palaro.vehicle_route_stops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_id UUID NOT NULL REFERENCES palaro.vehicle_routes(id) ON DELETE CASCADE,
  stop_order INTEGER NOT NULL,
  site_id UUID REFERENCES palaro.sites(id),
  label TEXT,           -- free-text fallback when site_id is null
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT vehicle_route_stops_route_order_uq UNIQUE (route_id, stop_order),
  CONSTRAINT vehicle_route_stops_site_or_label CHECK (site_id IS NOT NULL OR label IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_vehicle_route_stops_route
  ON palaro.vehicle_route_stops(route_id, stop_order);

-- Dispatches -----------------------------------------------------------------
-- A dispatch is the "trip" record created before the vehicle leaves.
-- The spec's "Fields to fill out before dispatch" map directly:
--   delegation, team(s)→sport, pax/team→pax_total, from, to.
-- expected_pax stores the boarded headcount so the missing-athlete report
-- can compare it against destination scans.
CREATE TABLE IF NOT EXISTS palaro.vehicle_dispatches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES palaro.vehicles(id) ON DELETE CASCADE,
  route_id UUID REFERENCES palaro.vehicle_routes(id) ON DELETE SET NULL,
  delegation_id UUID REFERENCES palaro.delegations(id),
  sport TEXT,                           -- e.g. 'Taekwondo' (free-text per the chosen team model)
  team_count INTEGER,                   -- how many distinct teams on this trip
  expected_pax INTEGER,                 -- pax boarded at origin (for missing-athlete check)
  origin_site_id UUID REFERENCES palaro.sites(id),
  destination_site_id UUID REFERENCES palaro.sites(id),
  scheduled_at TIMESTAMPTZ,
  dispatched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  dispatched_by UUID REFERENCES palaro.profiles(id),
  status palaro.dispatch_status NOT NULL DEFAULT 'scheduled',
  notes TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vehicle_dispatches_vehicle
  ON palaro.vehicle_dispatches(vehicle_id, dispatched_at DESC);
CREATE INDEX IF NOT EXISTS idx_vehicle_dispatches_status
  ON palaro.vehicle_dispatches(status);
CREATE INDEX IF NOT EXISTS idx_vehicle_dispatches_delegation
  ON palaro.vehicle_dispatches(delegation_id);

DROP TRIGGER IF EXISTS trg_vehicle_dispatches_updated ON palaro.vehicle_dispatches;
CREATE TRIGGER trg_vehicle_dispatches_updated
  BEFORE UPDATE ON palaro.vehicle_dispatches
  FOR EACH ROW EXECUTE FUNCTION palaro.update_updated_at_column();

-- Fuel consumption inventory -------------------------------------------------
-- The spec calls out "Transportation Committee Heads inputs the consumption
-- (fueled/refilled) of each vehicles." Cost is optional because not every
-- refill is paid for in-app.
CREATE TABLE IF NOT EXISTS palaro.vehicle_fuel_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id UUID NOT NULL REFERENCES palaro.vehicles(id) ON DELETE CASCADE,
  refilled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  liters NUMERIC(10, 2) NOT NULL CHECK (liters >= 0),
  cost_php NUMERIC(12, 2) CHECK (cost_php IS NULL OR cost_php >= 0),
  odometer_km INTEGER CHECK (odometer_km IS NULL OR odometer_km >= 0),
  station TEXT,
  logged_by UUID REFERENCES palaro.profiles(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vehicle_fuel_logs_vehicle
  ON palaro.vehicle_fuel_logs(vehicle_id, refilled_at DESC);

-- Extend vehicle_logs --------------------------------------------------------
-- Each scan is now bound to a dispatch (when known) and carries the per-scan
-- snapshot the spec requires. dispatch_id is nullable so casual ad-hoc scans
-- (e.g. before dispatch flow rolls out) still work.
ALTER TABLE palaro.vehicle_logs
  ADD COLUMN IF NOT EXISTS dispatch_id UUID REFERENCES palaro.vehicle_dispatches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS delegation_id UUID REFERENCES palaro.delegations(id),
  ADD COLUMN IF NOT EXISTS sport TEXT,
  ADD COLUMN IF NOT EXISTS team_count INTEGER,
  ADD COLUMN IF NOT EXISTS from_site_id UUID REFERENCES palaro.sites(id),
  ADD COLUMN IF NOT EXISTS to_site_id UUID REFERENCES palaro.sites(id);

CREATE INDEX IF NOT EXISTS idx_vehicle_logs_dispatch
  ON palaro.vehicle_logs(dispatch_id);
CREATE INDEX IF NOT EXISTS idx_vehicle_logs_delegation
  ON palaro.vehicle_logs(delegation_id);

COMMIT;
