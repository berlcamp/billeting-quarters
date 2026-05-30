-- 43-event-attendance.sql
-- Event Attendance module (under the Personnel menu). Separate from the global
-- daily Attendance (time-in/out) feature: here each *event* owns its own
-- time-in-only log.
--
-- Model:
--   events                 ← one named event (e.g. "Opening Ceremony")
--   event_attendance_logs  ← one row per time-in. Either references an existing
--                            personnel record (scanned QR) OR carries free-text
--                            guest_* fields (manual entry for someone not yet in
--                            the system). No time-out — time-in only.
--
-- Duplicate time-ins are intentionally allowed (no per-person dedup); the scan
-- UI only debounces identical reads client-side.

CREATE TABLE IF NOT EXISTS palaro.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  location TEXT,                              -- free-text venue (events are not site-scoped)
  event_date TIMESTAMPTZ,                     -- optional scheduled date/time
  is_active BOOLEAN NOT NULL DEFAULT TRUE,    -- soft-delete
  created_by UUID REFERENCES palaro.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_events_active_created
  ON palaro.events(is_active, created_at DESC);

DROP TRIGGER IF EXISTS trg_events_updated ON palaro.events;
CREATE TRIGGER trg_events_updated BEFORE UPDATE ON palaro.events
  FOR EACH ROW EXECUTE FUNCTION palaro.update_updated_at_column();

CREATE TABLE IF NOT EXISTS palaro.event_attendance_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES palaro.events(id) ON DELETE CASCADE,
  -- NULL for guests not yet in the personnel table. SET NULL (not CASCADE) so a
  -- later personnel soft/hard delete never erases attendance history.
  personnel_id UUID REFERENCES palaro.personnel(id) ON DELETE SET NULL,
  guest_name TEXT,                            -- set when personnel_id is NULL
  guest_committee TEXT,                       -- optional manual details
  guest_designation TEXT,
  time_in TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  recorded_by UUID REFERENCES palaro.profiles(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT event_attendance_identity
    CHECK (personnel_id IS NOT NULL OR guest_name IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_event_attendance_event_time
  ON palaro.event_attendance_logs(event_id, time_in DESC);

CREATE INDEX IF NOT EXISTS idx_event_attendance_personnel
  ON palaro.event_attendance_logs(personnel_id);

COMMENT ON TABLE palaro.events IS
  'A named event under the Personnel > Event Attendance module. Soft-delete via is_active.';
COMMENT ON TABLE palaro.event_attendance_logs IS
  'Time-in-only attendance for one event. personnel_id (scanned QR) XOR guest_* fields (manual entry); the CHECK requires at least one identity. Duplicate time-ins are allowed by design.';
