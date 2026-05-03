-- Enable Supabase Realtime broadcasts for Phase 2 tables.
-- The supabase_realtime publication ships with Supabase; only tables
-- explicitly added to it can be subscribed to via postgres_changes.

-- Heat index (Task 10)
ALTER PUBLICATION supabase_realtime ADD TABLE palaro.heat_index_readings;

-- VIP tracking (Task 11)
ALTER PUBLICATION supabase_realtime ADD TABLE palaro.vip_persons;
ALTER PUBLICATION supabase_realtime ADD TABLE palaro.vip_movements;
