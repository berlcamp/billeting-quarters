-- Split the single coordinator_name into the two real-world roles ops works with:
--   * SWM (Solid Waste Management) Coordinator — the crew-side contact
--   * City ENRO Coordinator — the city-side environment office contact
--
-- Existing coordinator_name values are migrated into swm_coordinator_name so we
-- don't lose any data; city_enro_coordinator_name starts NULL and is filled
-- in via the settings UI.
--
-- Run in Supabase SQL Editor.

ALTER TABLE palaro.garbage_collectors
  ADD COLUMN IF NOT EXISTS swm_coordinator_name TEXT,
  ADD COLUMN IF NOT EXISTS city_enro_coordinator_name TEXT;

UPDATE palaro.garbage_collectors
  SET swm_coordinator_name = coordinator_name
  WHERE swm_coordinator_name IS NULL;

ALTER TABLE palaro.garbage_collectors
  ALTER COLUMN swm_coordinator_name SET NOT NULL;

ALTER TABLE palaro.garbage_collectors
  DROP COLUMN IF EXISTS coordinator_name;
