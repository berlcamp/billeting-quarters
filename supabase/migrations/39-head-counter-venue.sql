-- 39-head-counter-venue.sql
-- Adds a parallel head-counter table scoped to playing venues (sites) instead
-- of delegations. The Head Counter module gains two tabs:
--   1. BQ     — existing head_counter_cells (per delegation)
--   2. Venue  — new head_counter_venue_cells (per playing-venue site)
-- Reuses the existing palaro.head_counter_direction and palaro.head_counter_role
-- enums so the role × direction matrix is identical to the BQ tab.
--
-- Encoders for this tab are venue_manager users; view-only access mirrors the
-- BQ tab (command_center, personnel_admin, head_counter_viewer, super_admin).

CREATE TABLE IF NOT EXISTS palaro.head_counter_venue_cells (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id       UUID NOT NULL REFERENCES palaro.sites(id) ON DELETE CASCADE,
  count_date    DATE NOT NULL,
  direction     palaro.head_counter_direction NOT NULL,
  role          palaro.head_counter_role NOT NULL,
  count         INTEGER NOT NULL DEFAULT 0 CHECK (count >= 0),
  updated_by    UUID REFERENCES palaro.profiles(id) ON DELETE SET NULL,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT head_counter_venue_cells_site_date_direction_role_key
    UNIQUE (site_id, count_date, direction, role)
);

CREATE INDEX IF NOT EXISTS idx_head_counter_venue_cells_site_date
  ON palaro.head_counter_venue_cells(site_id, count_date);

CREATE INDEX IF NOT EXISTS idx_head_counter_venue_cells_date
  ON palaro.head_counter_venue_cells(count_date);

COMMENT ON TABLE palaro.head_counter_venue_cells IS
  'Daily IN/OUT tally per playing-venue (site) — mirrors palaro.head_counter_cells but keyed on site_id. Cells are deleted (not written as 0) when blanked.';
