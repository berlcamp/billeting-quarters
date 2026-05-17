-- 29-referrals-history-pe.sql
-- Adds per-referral narrative fields used by Hospital → Direct Admit:
-- interval history and physical examination findings. Existing columns
-- (chief_complaint, initial_diagnosis, treatment_given) already cover the
-- rest of the requested form.
--
-- These fields also apply to UCF and field referrals, but the Direct Admit
-- form is the first surface that exposes them. The Hospital module displays
-- a running list of prior visits (matched by patient_name) so clinicians
-- can see the patient's narrative history across admissions.

ALTER TABLE palaro.referrals
  ADD COLUMN IF NOT EXISTS history TEXT,
  ADD COLUMN IF NOT EXISTS physical_examination TEXT;

COMMENT ON COLUMN palaro.referrals.history IS
  'Interval history captured at this referral/admission. Prior referrals for the same patient remain visible on the Direct Admit form.';
COMMENT ON COLUMN palaro.referrals.physical_examination IS
  'Physical examination findings for this referral/admission.';
