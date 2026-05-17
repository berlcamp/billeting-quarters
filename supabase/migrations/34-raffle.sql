-- 34-raffle.sql
-- Electronic Raffle module. Self-contained from palaro.delegations — raffles
-- target groupings (staff, agencies, sponsors, etc.) which are unrelated to
-- the 17 regional athletic delegations.
--
-- Model:
--   raffles            ← one raffle event (e.g. "Welcome Night 2026")
--   raffle_departments ← groups within a raffle that own entries
--   raffle_entries     ← one row per name (= one ticket)
--   raffle_winners     ← persisted draw outcomes; session_id groups winners
--                        of one operator session so the chromeless Draw page
--                        can exclude them on subsequent spins.

CREATE TABLE IF NOT EXISTS palaro.raffles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES palaro.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_raffles_active_created
  ON palaro.raffles(is_active, created_at DESC);

DROP TRIGGER IF EXISTS trg_raffles_updated ON palaro.raffles;
CREATE TRIGGER trg_raffles_updated BEFORE UPDATE ON palaro.raffles
  FOR EACH ROW EXECUTE FUNCTION palaro.update_updated_at_column();

CREATE TABLE IF NOT EXISTS palaro.raffle_departments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  raffle_id UUID NOT NULL REFERENCES palaro.raffles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT raffle_departments_name_unique UNIQUE (raffle_id, name)
);

CREATE INDEX IF NOT EXISTS idx_raffle_departments_raffle
  ON palaro.raffle_departments(raffle_id);

DROP TRIGGER IF EXISTS trg_raffle_departments_updated ON palaro.raffle_departments;
CREATE TRIGGER trg_raffle_departments_updated BEFORE UPDATE ON palaro.raffle_departments
  FOR EACH ROW EXECUTE FUNCTION palaro.update_updated_at_column();

CREATE TABLE IF NOT EXISTS palaro.raffle_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  raffle_id UUID NOT NULL REFERENCES palaro.raffles(id) ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES palaro.raffle_departments(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_raffle_entries_raffle_dept
  ON palaro.raffle_entries(raffle_id, department_id);

CREATE INDEX IF NOT EXISTS idx_raffle_entries_department
  ON palaro.raffle_entries(department_id);

CREATE TABLE IF NOT EXISTS palaro.raffle_winners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  raffle_id UUID NOT NULL REFERENCES palaro.raffles(id) ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES palaro.raffle_departments(id) ON DELETE CASCADE,
  entry_id UUID NOT NULL REFERENCES palaro.raffle_entries(id) ON DELETE CASCADE,
  entry_name TEXT NOT NULL,
  department_name TEXT NOT NULL,
  prize_label TEXT,
  session_id UUID NOT NULL,
  draw_index INTEGER NOT NULL,
  drawn_by UUID REFERENCES palaro.profiles(id) ON DELETE SET NULL,
  drawn_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_raffle_winners_raffle_drawn
  ON palaro.raffle_winners(raffle_id, drawn_at DESC);

CREATE INDEX IF NOT EXISTS idx_raffle_winners_session
  ON palaro.raffle_winners(session_id);

CREATE INDEX IF NOT EXISTS idx_raffle_winners_entry
  ON palaro.raffle_winners(entry_id);

COMMENT ON TABLE palaro.raffles IS
  'Top-level raffle event. Soft-delete via is_active.';
COMMENT ON TABLE palaro.raffle_departments IS
  'Department/group within a raffle. Departments scope entries; the Draw page can filter to one department or pool across all.';
COMMENT ON TABLE palaro.raffle_entries IS
  'One row per raffle ticket. Created via paste or CSV upload (1 name per line). raffle_id is denormalised from department for fast pool queries.';
COMMENT ON TABLE palaro.raffle_winners IS
  'Persisted draws. entry_name/department_name are frozen at draw time so renames or deletions do not rewrite history. session_id groups winners drawn in one Draw-page session.';
