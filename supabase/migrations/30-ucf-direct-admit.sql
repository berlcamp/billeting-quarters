-- 30-ucf-direct-admit.sql
-- Adds the ucf_admit level to the referral_level enum so walk-ins arriving
-- straight at a UCF (without coming through the field) can be logged the
-- same way hospitals already log direct admits. The history and
-- physical_examination columns added in 29 are reused.

ALTER TYPE palaro.referral_level ADD VALUE IF NOT EXISTS 'ucf_admit';
