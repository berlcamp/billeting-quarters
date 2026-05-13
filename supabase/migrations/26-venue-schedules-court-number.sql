-- 26-venue-schedules-court-number.sql
-- Adds a court_number (1..10) to palaro.venue_schedules so a single venue can
-- host multiple simultaneous practices on different courts. Backfills existing
-- rows to court 1, makes the column NOT NULL, and re-scopes the helpful index
-- so conflict lookups can hit court-level granularity.

ALTER TABLE palaro.venue_schedules
  ADD COLUMN IF NOT EXISTS court_number INTEGER;

UPDATE palaro.venue_schedules
  SET court_number = 1
  WHERE court_number IS NULL;

ALTER TABLE palaro.venue_schedules
  ALTER COLUMN court_number SET NOT NULL;

ALTER TABLE palaro.venue_schedules
  DROP CONSTRAINT IF EXISTS venue_schedule_court_check;

ALTER TABLE palaro.venue_schedules
  ADD CONSTRAINT venue_schedule_court_check
    CHECK (court_number BETWEEN 1 AND 10);

DROP INDEX IF EXISTS palaro.idx_venue_schedules_venue_time;
CREATE INDEX IF NOT EXISTS idx_venue_schedules_venue_court_time
  ON palaro.venue_schedules(venue_id, court_number, scheduled_start);
