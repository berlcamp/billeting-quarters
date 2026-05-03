-- Phase 1 tables that the UI subscribes to via Supabase Realtime but
-- weren't in the supabase_realtime publication (verified via
-- pg_publication_tables on 2026-05-03).
--
-- Run in Supabase SQL Editor. If a table is already a member, the ALTER
-- errors with `relation "..." is already member of publication`. Safe to ignore.

ALTER PUBLICATION supabase_realtime ADD TABLE palaro.incidents;
ALTER PUBLICATION supabase_realtime ADD TABLE palaro.referrals;
ALTER PUBLICATION supabase_realtime ADD TABLE palaro.notifications;
