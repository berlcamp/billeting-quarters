-- 28-clinic-visit-history-pe-treatment.sql
-- Adds per-visit narrative fields the clinic staff want to record on every
-- walk-in: interval history, physical examination findings, and the actual
-- treatment given (separate from the prescription, which is what the patient
-- takes home). Each visit's value is preserved so the Log Visit form can show
-- the prior values back as a running list across visits.

ALTER TABLE palaro.clinic_visits
  ADD COLUMN IF NOT EXISTS history TEXT,
  ADD COLUMN IF NOT EXISTS physical_examination TEXT,
  ADD COLUMN IF NOT EXISTS treatment_given TEXT;

COMMENT ON COLUMN palaro.clinic_visits.history IS
  'Interval history captured at this visit. Prior visits remain visible on the Log Visit form so the running record stays intact.';
COMMENT ON COLUMN palaro.clinic_visits.physical_examination IS
  'Physical examination findings for this visit. Prior visits remain visible on the Log Visit form.';
COMMENT ON COLUMN palaro.clinic_visits.treatment_given IS
  'Treatment actually administered at the clinic during this visit (distinct from prescription, which is for take-home medication).';
