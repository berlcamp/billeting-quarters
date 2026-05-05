-- Private storage bucket for personnel ID photos.
--
-- Photos are written by the personnel.manage server action via the service-role
-- client (bypassing RLS) and read back through 1-hour signed URLs. No anon
-- access is needed, so the bucket stays private and we don't define storage
-- policies — same model as `incident-photos`.

INSERT INTO storage.buckets (id, name, public)
VALUES ('personnel-photos', 'personnel-photos', false)
ON CONFLICT (id) DO NOTHING;
