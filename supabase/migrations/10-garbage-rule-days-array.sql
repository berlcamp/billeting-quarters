-- Garbage refactor follow-up #2: a single rule can cover multiple days at
-- the same AM/PM times (e.g. Mon/Wed/Fri 06:00). Replace the scalar
-- day_of_week with an array, backfilling existing rules.

ALTER TABLE palaro.garbage_schedule_rules
  ADD COLUMN IF NOT EXISTS days_of_week SMALLINT[];

UPDATE palaro.garbage_schedule_rules
SET days_of_week = ARRAY[day_of_week]
WHERE days_of_week IS NULL AND day_of_week IS NOT NULL;

-- Now make the new column the source of truth.
ALTER TABLE palaro.garbage_schedule_rules
  ALTER COLUMN days_of_week SET NOT NULL,
  ALTER COLUMN days_of_week SET DEFAULT '{}';

-- Drop the old scalar column and any index that referenced it.
DROP INDEX IF EXISTS palaro.idx_garbage_schedule_rules_dow;
ALTER TABLE palaro.garbage_schedule_rules
  DROP COLUMN IF EXISTS day_of_week;

-- Constraints: at least one day, all values in ISO range 1..7.
ALTER TABLE palaro.garbage_schedule_rules
  DROP CONSTRAINT IF EXISTS garbage_schedule_rules_days_nonempty,
  DROP CONSTRAINT IF EXISTS garbage_schedule_rules_days_iso;

ALTER TABLE palaro.garbage_schedule_rules
  ADD CONSTRAINT garbage_schedule_rules_days_nonempty
    CHECK (array_length(days_of_week, 1) >= 1),
  ADD CONSTRAINT garbage_schedule_rules_days_iso
    CHECK (days_of_week <@ ARRAY[1,2,3,4,5,6,7]::SMALLINT[]);

-- GIN index for cheap membership lookups (e.g. "rules running on Tuesday").
CREATE INDEX IF NOT EXISTS idx_garbage_schedule_rules_days
  ON palaro.garbage_schedule_rules USING GIN (days_of_week);
