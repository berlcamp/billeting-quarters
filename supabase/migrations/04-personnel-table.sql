-- Personnel module refactor.
--
-- Background: until now `attendance_logs.personnel_id` and
-- `duty_schedules.personnel_id` referenced palaro.profiles, which conflated
-- system users (auth-bound, can sign in) with the people we issue ID cards to
-- for QR scan-in. The latter are not auth users — they only exist to be
-- printed and scanned. This migration introduces palaro.personnel as the
-- canonical record for that population and re-points attendance + duty FKs.
--
-- Run in Supabase SQL editor. Existing attendance_logs / duty_schedules rows
-- are dropped because their personnel_id values reference profiles that are no
-- longer the valid target. Re-seed personnel afterwards via the new CRUD UI.

-- 1. Personnel table
CREATE TABLE palaro.personnel (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  designation TEXT,                              -- job title, e.g. "Lifeguard"
  committee TEXT NOT NULL,                       -- e.g. "Medical Committee"
  area_assigned TEXT,                            -- free-text granular detail
  site_id UUID REFERENCES palaro.sites(id),     -- structured site assignment
  agency TEXT,
  contact_number TEXT,
  photo_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES palaro.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_personnel_committee ON palaro.personnel(committee);
CREATE INDEX idx_personnel_site ON palaro.personnel(site_id);
CREATE INDEX idx_personnel_active ON palaro.personnel(is_active);
CREATE INDEX idx_personnel_full_name ON palaro.personnel(full_name);

-- 2. Re-point attendance + duty FKs at palaro.personnel.
-- Drop+recreate is simpler and safe here because no production scan data
-- exists yet (early-stage project, no event data captured). If that ever
-- changes, replace this block with a data migration.
DROP TABLE IF EXISTS palaro.attendance_logs;
DROP TABLE IF EXISTS palaro.duty_schedules;

CREATE TABLE palaro.duty_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  personnel_id UUID NOT NULL REFERENCES palaro.personnel(id) ON DELETE CASCADE,
  site_id UUID REFERENCES palaro.sites(id),
  duty_start TIMESTAMPTZ NOT NULL,
  duty_end TIMESTAMPTZ NOT NULL,
  shift_label TEXT,
  notes TEXT,
  created_by UUID REFERENCES palaro.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_duty_personnel_time ON palaro.duty_schedules(personnel_id, duty_start);

CREATE TABLE palaro.attendance_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  personnel_id UUID NOT NULL REFERENCES palaro.personnel(id) ON DELETE CASCADE,
  site_id UUID REFERENCES palaro.sites(id),
  type palaro.attendance_type NOT NULL,
  scanned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  scanned_by UUID REFERENCES palaro.profiles(id),  -- still a system user
  notes TEXT
);

CREATE INDEX idx_attendance_personnel ON palaro.attendance_logs(personnel_id, scanned_at DESC);

-- 3. updated_at trigger for personnel
CREATE OR REPLACE FUNCTION palaro.touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_personnel_touch ON palaro.personnel;
CREATE TRIGGER trg_personnel_touch
BEFORE UPDATE ON palaro.personnel
FOR EACH ROW EXECUTE FUNCTION palaro.touch_updated_at();

-- 4. Realtime: attendance_logs subscription is needed for live scan UI.
-- Re-add since we just dropped + recreated the table.
ALTER PUBLICATION supabase_realtime ADD TABLE palaro.attendance_logs;
