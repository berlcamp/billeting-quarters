-- 35-raffle-designation.sql
-- Adds an optional designation (role / title) to each raffle entry, and
-- freezes it on the winner row alongside entry_name so renames or deletes
-- don't rewrite history.

ALTER TABLE palaro.raffle_entries
  ADD COLUMN IF NOT EXISTS designation TEXT;

ALTER TABLE palaro.raffle_winners
  ADD COLUMN IF NOT EXISTS entry_designation TEXT;

COMMENT ON COLUMN palaro.raffle_entries.designation IS
  'Optional title / role shown alongside the entry name (e.g. "Coach", "Driver"). Free-text, nullable.';
COMMENT ON COLUMN palaro.raffle_winners.entry_designation IS
  'Frozen copy of the entry''s designation at draw time. Nullable.';
