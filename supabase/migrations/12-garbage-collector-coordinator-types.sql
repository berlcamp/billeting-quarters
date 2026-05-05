-- Split the single coordinator_name into the two real-world roles ops works with:
--   * SWM (Solid Waste Management) Coordinator — the crew-side contact
--   * City ENRO Coordinator — the city-side environment office contact
--
-- Existing coordinator_name values are migrated into swm_coordinator_name so we
-- don't lose any data; both new columns are nullable. The driver name (added
-- in migration 11) is the only required identifier on a collector now —
-- enforced at the application layer to keep migrations from blocking on
-- pre-existing rows that have no driver on file yet.
--
-- Run in Supabase SQL Editor.

ALTER TABLE palaro.garbage_collectors
  ADD COLUMN IF NOT EXISTS swm_coordinator_name TEXT,
  ADD COLUMN IF NOT EXISTS city_enro_coordinator_name TEXT;

UPDATE palaro.garbage_collectors
  SET swm_coordinator_name = coordinator_name
  WHERE swm_coordinator_name IS NULL;

ALTER TABLE palaro.garbage_collectors
  DROP COLUMN IF EXISTS coordinator_name;
