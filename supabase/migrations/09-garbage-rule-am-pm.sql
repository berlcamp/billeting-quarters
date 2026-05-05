-- Garbage refactor follow-up.
--
-- 1. Drop the partial unique index on (schedule_rule_id, scheduled_at).
--    supabase-js's .upsert(onConflict: …) cannot pass the partial WHERE
--    predicate, so Postgres can't infer the index for ON CONFLICT and the
--    insert errors. Week generation now dedupes in application code via a
--    SELECT-then-INSERT, so the DB-level guard is no longer needed.
--
-- 2. Add an optional second pickup time per rule. Operations crew often
--    runs two passes a day (AM + PM) for the same site/collector — having
--    one rule with two times is friendlier than forcing two rules.

DROP INDEX IF EXISTS palaro.uq_garbage_collections_rule_time;

ALTER TABLE palaro.garbage_schedule_rules
  ADD COLUMN IF NOT EXISTS time_of_day_pm TIME;
