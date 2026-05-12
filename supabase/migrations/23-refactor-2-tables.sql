-- 22-refactor-2-tables.sql
-- FOR REFACTOR 2 (part 2 of 2): tables, columns, indexes, triggers.
--
-- Apply AFTER 21-refactor-2-enums.sql, then run `npm run gen:types`.

SET LOCAL search_path = palaro, public;

-- ---------------------------------------------------------------------------
-- Incidents: capture reporting officer (security category in particular)
-- ---------------------------------------------------------------------------
ALTER TABLE palaro.incidents
  ADD COLUMN IF NOT EXISTS reporting_officer_name TEXT,
  ADD COLUMN IF NOT EXISTS reporting_officer_position TEXT;

-- ---------------------------------------------------------------------------
-- Food supplier ↔ delegation pre-assignment. Auto-routes food requests
-- from a BQ to the suppliers covering that delegation.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS palaro.food_supplier_delegations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_id UUID NOT NULL REFERENCES palaro.food_suppliers(id) ON DELETE CASCADE,
  delegation_id UUID NOT NULL REFERENCES palaro.delegations(id) ON DELETE CASCADE,
  priority INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES palaro.profiles(id),
  UNIQUE(supplier_id, delegation_id)
);
CREATE INDEX IF NOT EXISTS idx_food_supplier_delegations_delegation
  ON palaro.food_supplier_delegations(delegation_id);
CREATE INDEX IF NOT EXISTS idx_food_supplier_delegations_supplier
  ON palaro.food_supplier_delegations(supplier_id);

-- ---------------------------------------------------------------------------
-- Site Monitoring — visits / non-incident activity log
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS palaro.site_monitoring_visits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES palaro.sites(id) ON DELETE CASCADE,
  visit_title TEXT NOT NULL,
  -- Array of names of individuals who came on this visit.
  individuals JSONB NOT NULL DEFAULT '[]'::jsonb,
  visited_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  observations TEXT,
  notes_to_admin TEXT,
  logged_by UUID NOT NULL REFERENCES palaro.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_site_monitoring_visits_site
  ON palaro.site_monitoring_visits(site_id);
CREATE INDEX IF NOT EXISTS idx_site_monitoring_visits_visited_at
  ON palaro.site_monitoring_visits(visited_at DESC);

-- ---------------------------------------------------------------------------
-- External Personnel Logs — BLGU / AFP / etc presence tracking
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS palaro.external_personnel_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID REFERENCES palaro.sites(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  position TEXT NOT NULL,
  organization TEXT,
  logged_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  notes TEXT,
  logged_by UUID NOT NULL REFERENCES palaro.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_external_personnel_logs_site
  ON palaro.external_personnel_logs(site_id);
CREATE INDEX IF NOT EXISTS idx_external_personnel_logs_logged_at
  ON palaro.external_personnel_logs(logged_at DESC);

-- ---------------------------------------------------------------------------
-- End-of-Day Reports — BQ headcount status per night
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS palaro.end_of_day_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  site_id UUID NOT NULL REFERENCES palaro.sites(id) ON DELETE CASCADE,
  report_date DATE NOT NULL,
  all_accounted_for BOOLEAN NOT NULL DEFAULT true,
  outside_athletes INT NOT NULL DEFAULT 0,
  outside_personnel INT NOT NULL DEFAULT 0,
  outside_officials INT NOT NULL DEFAULT 0,
  outside_details TEXT,
  reporting_officer_name TEXT NOT NULL,
  reporting_officer_position TEXT,
  notes TEXT,
  logged_by UUID NOT NULL REFERENCES palaro.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(site_id, report_date)
);
CREATE INDEX IF NOT EXISTS idx_end_of_day_reports_date
  ON palaro.end_of_day_reports(report_date DESC);
CREATE INDEX IF NOT EXISTS idx_end_of_day_reports_site
  ON palaro.end_of_day_reports(site_id);

-- ---------------------------------------------------------------------------
-- updated_at triggers for the new tables
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION palaro.refactor2_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS smv_updated_at ON palaro.site_monitoring_visits;
CREATE TRIGGER smv_updated_at BEFORE UPDATE ON palaro.site_monitoring_visits
  FOR EACH ROW EXECUTE FUNCTION palaro.refactor2_set_updated_at();

DROP TRIGGER IF EXISTS epl_updated_at ON palaro.external_personnel_logs;
CREATE TRIGGER epl_updated_at BEFORE UPDATE ON palaro.external_personnel_logs
  FOR EACH ROW EXECUTE FUNCTION palaro.refactor2_set_updated_at();

DROP TRIGGER IF EXISTS eod_updated_at ON palaro.end_of_day_reports;
CREATE TRIGGER eod_updated_at BEFORE UPDATE ON palaro.end_of_day_reports
  FOR EACH ROW EXECUTE FUNCTION palaro.refactor2_set_updated_at();
