-- Add a driver_name field to the collectors registry.
--
-- Background: a collector entry already carries a coordinator (the crew lead
-- the desk talks to) and a vehicle. Operations also wants the actual driver
-- on record so the weekly view shows who is behind the wheel for each pickup.
--
-- Run in Supabase SQL Editor.

ALTER TABLE palaro.garbage_collectors
  ADD COLUMN IF NOT EXISTS driver_name TEXT;
