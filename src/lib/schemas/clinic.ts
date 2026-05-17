import { z } from "zod";

const optionalText = z.string().trim().max(2000).optional();
const optionalShortText = z.string().trim().max(200).optional();

export const PATIENT_GENDERS = ["male", "female", "other"] as const;
export type PatientGender = (typeof PATIENT_GENDERS)[number];

export const createPatientSchema = z.object({
  full_name: z.string().trim().min(1, "Name is required").max(200),
  age: z.number().int().min(0).max(150).optional(),
  gender: z.enum(PATIENT_GENDERS).optional(),
  delegation_id: z.string().uuid().nullable().optional(),
  phone: optionalShortText,
  emergency_contact: optionalShortText,
});
export type CreatePatientInput = z.infer<typeof createPatientSchema>;

export const updatePatientSchema = createPatientSchema.extend({
  id: z.string().uuid(),
});
export type UpdatePatientInput = z.infer<typeof updatePatientSchema>;

// Vitals: same structured fields as referrals so rendering can be shared.
export const vitalSignsSchema = z
  .object({
    bp: z.string().trim().max(20).optional(),
    hr: z.union([z.number(), z.string()]).optional(),
    temp_c: z.union([z.number(), z.string()]).optional(),
    rr: z.union([z.number(), z.string()]).optional(),
    spo2: z.union([z.number(), z.string()]).optional(),
    weight_kg: z.union([z.number(), z.string()]).optional(),
    height_cm: z.union([z.number(), z.string()]).optional(),
  })
  .optional();

export const createVisitSchema = z.object({
  patient_id: z.string().uuid("Pick a patient."),
  site_id: z.string().uuid("Pick a clinic site."),
  vital_signs: vitalSignsSchema,
  chief_complaint: optionalText,
  history: optionalText,
  physical_examination: optionalText,
  diagnosis: optionalText,
  treatment_given: optionalText,
  allergies: optionalText,
  notes: optionalText,
});
export type CreateVisitInput = z.infer<typeof createVisitSchema>;
