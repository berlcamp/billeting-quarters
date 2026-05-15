-- 27-incidents-medical-data.sql
-- Adds a single JSONB column to palaro.incidents that holds the medical-only
-- fields collected on the create-incident form when category = 'medical'.
-- These fields mirror the printable Patient Consultation/Referral Form
-- (birthdate, sex, address, sports event, vital signs, allergies, current
-- medications, past medical history, last meal, chief complaint, PE findings,
-- treatment, diagnosis, remarks). Storing them as a single JSONB keeps the
-- incidents table from growing a long tail of medical-only columns.

ALTER TABLE palaro.incidents
  ADD COLUMN IF NOT EXISTS medical_data JSONB;

COMMENT ON COLUMN palaro.incidents.medical_data IS
  'Medical-only fields captured at incident creation for category = medical. Mirrors fields on the printable Patient Consultation/Referral Form.';
