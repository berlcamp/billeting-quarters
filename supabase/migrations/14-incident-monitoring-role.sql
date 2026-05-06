-- 14-incident-monitoring-role.sql
-- Adds the `incident_monitoring` role. Holders of this role can only see the
-- Command Center dashboard and the Incidents module (read-only).
--
-- Note: ALTER TYPE ... ADD VALUE cannot be combined with other DDL inside the
-- same transaction in some Postgres versions, so this migration is intentionally
-- not wrapped in BEGIN/COMMIT. It is idempotent — IF NOT EXISTS guards the add.

ALTER TYPE palaro.user_role ADD VALUE IF NOT EXISTS 'incident_monitoring';
