-- 33-head-counter.sql
-- Head Counter module for the Palaro 2026 event window (May 16 – Jun 15).
-- Each delegation's Delegation Head encodes per-day IN/OUT counts across
-- eight role columns and ten row slots (DELEGATION + Delegate 1..9). Cells
-- are normalized one-row-per-cell so totals/aggregations are straightforward.
-- Profiles gain delegation_id so encoders can be scoped to their own
-- delegation.

ALTER TABLE palaro.profiles
  ADD COLUMN IF NOT EXISTS delegation_id UUID
    REFERENCES palaro.delegations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_delegation_id
  ON palaro.profiles(delegation_id) WHERE delegation_id IS NOT NULL;

COMMENT ON COLUMN palaro.profiles.delegation_id IS
  'Optional delegation the profile is scoped to. Used by Head Counter to gate delegation_head encoders to their own delegation. Other modules may later use this to scope delegation-bound dashboards.';

DO $$ BEGIN
  CREATE TYPE palaro.head_counter_direction AS ENUM ('in', 'out');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE palaro.head_counter_role AS ENUM (
    'athlete', 'chaperon', 'coach', 'delegation_twg',
    'rd', 'ard', 'sds', 'asds'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS palaro.head_counter_cells (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  delegation_id UUID NOT NULL REFERENCES palaro.delegations(id) ON DELETE CASCADE,
  count_date    DATE NOT NULL,
  direction     palaro.head_counter_direction NOT NULL,
  -- 0 = DELEGATION (total) row, 1..9 = Delegate 1..9
  row_index     SMALLINT NOT NULL CHECK (row_index BETWEEN 0 AND 9),
  role          palaro.head_counter_role NOT NULL,
  count         INTEGER NOT NULL DEFAULT 0 CHECK (count >= 0),
  updated_by    UUID REFERENCES palaro.profiles(id) ON DELETE SET NULL,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (delegation_id, count_date, direction, row_index, role)
);

CREATE INDEX IF NOT EXISTS idx_head_counter_cells_dele_date
  ON palaro.head_counter_cells(delegation_id, count_date);

CREATE INDEX IF NOT EXISTS idx_head_counter_cells_date
  ON palaro.head_counter_cells(count_date);

COMMENT ON TABLE palaro.head_counter_cells IS
  'One row per cell in the daily IN/OUT tally grid. row_index=0 is the DELEGATION total row; 1..9 are Delegate 1..9. Cells are deleted (not written as 0) when blanked.';
