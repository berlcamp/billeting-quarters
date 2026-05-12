-- 21-refactor-2-enums.sql
-- FOR REFACTOR 2 (part 1 of 2): enum additions only.
--
-- ALTER TYPE ... ADD VALUE cannot be combined with other DDL inside the same
-- transaction (Postgres restriction), so the enum changes live in their own
-- migration. Run this file first, then 22-refactor-2-tables.sql.
--
-- Idempotent — IF NOT EXISTS guards each ADD.

-- New role: Information Hub Officer (Garbage Incharge at billeting quarter)
ALTER TYPE palaro.user_role ADD VALUE IF NOT EXISTS 'information_hub_officer';

-- Garbage: "no_collection_needed" — Info Hub officer marks a BQ as not
-- needing pickup today. (Type is palaro.garbage_collection_status.)
ALTER TYPE palaro.garbage_collection_status
  ADD VALUE IF NOT EXISTS 'no_collection_needed';
