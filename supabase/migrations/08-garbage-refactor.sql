-- Garbage module refactor.
--
-- Background: garbage_collections used to carry a free-text collector_name and
-- a single one-off scheduled_at per row. The desk wants a registry of
-- collectors (coordinator + vehicle + contact) and a recurring weekly
-- schedule (which collector covers which site on which day, at what time)
-- that auto-materializes into garbage_collections rows the user ticks off.
--
-- This migration adds:
--   * palaro.garbage_collectors          — registry
--   * palaro.garbage_schedule_rules      — recurring weekly rules
--   * collector_id + schedule_rule_id columns on garbage_collections
--   * a partial unique index so weekly generation is idempotent
--
-- Run in Supabase SQL Editor.

-- 1. Collectors registry
CREATE TABLE palaro.garbage_collectors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coordinator_name TEXT NOT NULL,
  vehicle_description TEXT,
  contact_number TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by UUID REFERENCES palaro.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_garbage_collectors_active ON palaro.garbage_collectors(is_active);

DROP TRIGGER IF EXISTS trg_garbage_collectors_touch ON palaro.garbage_collectors;
CREATE TRIGGER trg_garbage_collectors_touch
BEFORE UPDATE ON palaro.garbage_collectors
FOR EACH ROW EXECUTE FUNCTION palaro.touch_updated_at();

-- 2. Weekly schedule rules.
-- day_of_week is ISO: 1 = Monday … 7 = Sunday.
-- time_of_day is the local Asia/Manila wall-clock time the pickup happens.
CREATE TABLE palaro.garbage_schedule_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collector_id UUID NOT NULL REFERENCES palaro.garbage_collectors(id) ON DELETE CASCADE,
  site_id UUID NOT NULL REFERENCES palaro.sites(id),
  day_of_week SMALLINT NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
  time_of_day TIME NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  notes TEXT,
  created_by UUID REFERENCES palaro.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_garbage_schedule_rules_collector ON palaro.garbage_schedule_rules(collector_id);
CREATE INDEX idx_garbage_schedule_rules_site ON palaro.garbage_schedule_rules(site_id);
CREATE INDEX idx_garbage_schedule_rules_dow ON palaro.garbage_schedule_rules(day_of_week);

DROP TRIGGER IF EXISTS trg_garbage_schedule_rules_touch ON palaro.garbage_schedule_rules;
CREATE TRIGGER trg_garbage_schedule_rules_touch
BEFORE UPDATE ON palaro.garbage_schedule_rules
FOR EACH ROW EXECUTE FUNCTION palaro.touch_updated_at();

-- 3. Wire concrete collections back to the registry + originating rule.
ALTER TABLE palaro.garbage_collections
  ADD COLUMN IF NOT EXISTS collector_id UUID REFERENCES palaro.garbage_collectors(id),
  ADD COLUMN IF NOT EXISTS schedule_rule_id UUID REFERENCES palaro.garbage_schedule_rules(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_garbage_collections_collector ON palaro.garbage_collections(collector_id);
CREATE INDEX IF NOT EXISTS idx_garbage_collections_rule ON palaro.garbage_collections(schedule_rule_id);

-- Idempotent week generation: one row per (rule, scheduled_at) pair so the
-- generator can upsert without producing duplicates when run multiple times.
CREATE UNIQUE INDEX IF NOT EXISTS uq_garbage_collections_rule_time
  ON palaro.garbage_collections(schedule_rule_id, scheduled_at)
  WHERE schedule_rule_id IS NOT NULL;

-- 4. Realtime: weekly grid subscribes to garbage_collections so checkbox flips
-- propagate to other sessions. ALTER PUBLICATION errors if already a member —
-- safe to ignore on re-runs.
ALTER PUBLICATION supabase_realtime ADD TABLE palaro.garbage_collections;
