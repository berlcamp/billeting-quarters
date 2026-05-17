import { z } from "zod";

export const vitalsSchema = z
  .object({
    bp: z.string().trim().max(20).optional(),
    hr: z.number().int().min(0).max(300).optional(),
    temp: z.number().min(0).max(50).optional(),
    rr: z.number().int().min(0).max(80).optional(),
    spo2: z.number().int().min(0).max(100).optional(),
  })
  .optional();
export type Vitals = z.infer<typeof vitalsSchema>;

export const patientGenderSchema = z
  .enum(["male", "female", "other"])
  .optional();

export const acceptReferralSchema = z.object({
  id: z.string().uuid(),
});

export const submitUcfAssessmentSchema = z.object({
  id: z.string().uuid(),
  initial_diagnosis: z.string().trim().max(2000).optional(),
  treatment_plan: z.string().trim().max(2000).optional(),
  assessment_notes: z.string().trim().max(2000).optional(),
  vitals_on_arrival: vitalsSchema,
});
export type SubmitUcfAssessmentInput = z.infer<typeof submitUcfAssessmentSchema>;

export const dischargeReferralSchema = z.object({
  id: z.string().uuid(),
  discharge_notes: z
    .string()
    .trim()
    .min(1, "Discharge notes are required")
    .max(2000),
});
export type DischargeReferralInput = z.infer<typeof dischargeReferralSchema>;

export const submitHospitalAssessmentSchema = z.object({
  id: z.string().uuid(),
  initial_diagnosis: z.string().trim().max(2000).optional(),
  treatment_plan: z.string().trim().max(2000).optional(),
  assessment_notes: z.string().trim().max(2000).optional(),
  vitals_on_arrival: vitalsSchema,
});
export type SubmitHospitalAssessmentInput = z.infer<
  typeof submitHospitalAssessmentSchema
>;

export const admitReferralSchema = z.object({
  id: z.string().uuid(),
  admission_notes: z.string().trim().max(2000).optional(),
});
export type AdmitReferralInput = z.infer<typeof admitReferralSchema>;

export const rejectReferralSchema = z.object({
  id: z.string().uuid(),
  reason: z.string().trim().min(1, "Rejection reason is required").max(2000),
});
export type RejectReferralInput = z.infer<typeof rejectReferralSchema>;

export const createHospitalAdmitSchema = z.object({
  to_site_id: z.string().uuid({ message: "Pick a hospital" }),
  patient_name: z
    .string()
    .trim()
    .min(1, "Patient name is required")
    .max(200),
  patient_age: z.number().int().min(0).max(150).optional(),
  patient_gender: patientGenderSchema,
  delegation_id: z.string().uuid().nullable().optional(),
  chief_complaint: z.string().trim().max(2000).optional(),
  history: z.string().trim().max(2000).optional(),
  physical_examination: z.string().trim().max(2000).optional(),
  initial_diagnosis: z.string().trim().max(2000).optional(),
  treatment_given: z.string().trim().max(2000).optional(),
  allergies: z.string().trim().max(2000).optional(),
  notes: z.string().trim().max(2000).optional(),
  vital_signs: vitalsSchema,
});
export type CreateHospitalAdmitInput = z.infer<
  typeof createHospitalAdmitSchema
>;

export const createUcfAdmitSchema = z.object({
  to_site_id: z.string().uuid({ message: "Pick a UCF" }),
  patient_name: z
    .string()
    .trim()
    .min(1, "Patient name is required")
    .max(200),
  patient_age: z.number().int().min(0).max(150).optional(),
  patient_gender: patientGenderSchema,
  delegation_id: z.string().uuid().nullable().optional(),
  chief_complaint: z.string().trim().max(2000).optional(),
  history: z.string().trim().max(2000).optional(),
  physical_examination: z.string().trim().max(2000).optional(),
  initial_diagnosis: z.string().trim().max(2000).optional(),
  treatment_given: z.string().trim().max(2000).optional(),
  allergies: z.string().trim().max(2000).optional(),
  notes: z.string().trim().max(2000).optional(),
  vital_signs: vitalsSchema,
});
export type CreateUcfAdmitInput = z.infer<typeof createUcfAdmitSchema>;

export const createUcfToHospitalReferralSchema = z.object({
  source_ucf_referral_id: z.string().uuid(),
  to_site_id: z.string().uuid({ message: "Pick a target hospital" }),
  escalation_notes: z.string().trim().max(2000).optional(),
});
export type CreateUcfToHospitalReferralInput = z.infer<
  typeof createUcfToHospitalReferralSchema
>;

export const createFieldReferralSchema = z.object({
  incident_id: z.string().uuid().nullable().optional(),
  patient_name: z
    .string()
    .trim()
    .min(1, "Patient name is required")
    .max(200),
  patient_age: z.number().int().min(0).max(150).optional(),
  patient_gender: patientGenderSchema,
  delegation_id: z.string().uuid().nullable().optional(),
  chief_complaint: z.string().trim().max(2000).optional(),
  treatment_given: z.string().trim().max(2000).optional(),
  vital_signs: vitalsSchema,
  to_site_id: z.string().uuid({ message: "Pick a target UCF" }),
  from_site_id: z.string().uuid().nullable().optional(),
});
export type CreateFieldReferralInput = z.infer<typeof createFieldReferralSchema>;
