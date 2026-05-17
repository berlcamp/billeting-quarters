-- 31-referrals-allergies-notes.sql
-- Adds the last two narrative fields the medical forms need to be
-- consistent across Clinic, Hospital Direct Admit, and UCF Direct Admit:
-- per-referral allergies and free-form notes. The existing
-- assessment_notes column stays as the post-acceptance assessment
-- narrative; this notes column captures whatever the admitting clinician
-- writes at intake.

ALTER TABLE palaro.referrals
  ADD COLUMN IF NOT EXISTS allergies TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT;

COMMENT ON COLUMN palaro.referrals.allergies IS
  'Patient allergies recorded at intake. Free text, captured on Direct Admit forms.';
COMMENT ON COLUMN palaro.referrals.notes IS
  'Free-form notes at intake. Distinct from assessment_notes, which is captured after acceptance.';
