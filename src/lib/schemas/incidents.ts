import { z } from "zod";
import { PATIENT_GENDERS } from "@/lib/labels";

export const incidentCategorySchema = z.enum([
  "medical",
  "utility",
  "vip_status",
  "security",
  "facility",
  "other",
]);

export const incidentSeveritySchema = z.enum([
  "low",
  "medium",
  "high",
  "critical",
]);

const optionalText = z.string().trim().max(2000).optional();
const optionalShortText = z.string().trim().max(200).optional();
const optionalLongText = z.string().trim().max(4000).optional();

// Mirrors the printable Patient Consultation/Referral Form. Only collected
// when category === 'medical' — stored as a JSONB blob on incidents.medical_data.
export const medicalDataSchema = z.object({
  patient_birthdate: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
    .optional()
    .or(z.literal("").transform(() => undefined)),
  patient_sex: z.enum(PATIENT_GENDERS).optional(),
  patient_address: optionalText,
  patient_contact_number: optionalShortText,
  division: optionalShortText,
  sports_event: optionalShortText,
  chief_complaint: optionalText,
  pe_findings: optionalLongText,
  allergies: optionalText,
  current_medications: optionalText,
  past_medical_history: optionalLongText,
  last_meal: optionalShortText,
  vital_bp: optionalShortText,
  vital_hr: z.number().int().min(0).max(400).optional(),
  vital_rr: z.number().int().min(0).max(120).optional(),
  vital_temp: z.number().min(20).max(50).optional(),
  vital_spo2: z.number().int().min(0).max(100).optional(),
  vital_notes: optionalText,
  treatment: optionalLongText,
  diagnosis: optionalLongText,
  remarks: optionalText,
});
export type MedicalData = z.infer<typeof medicalDataSchema>;

export const createIncidentSchema = z.object({
  category: incidentCategorySchema,
  severity: incidentSeveritySchema,
  title: z.string().trim().min(1, "Title is required").max(200),
  description: optionalText,
  site_id: z.string().uuid().nullable().optional(),
  location_details: optionalText,
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  delegation_id: z.string().uuid().nullable().optional(),
  affected_person_name: optionalShortText,
  affected_person_age: z.number().int().min(0).max(150).optional(),
  affected_person_role: optionalShortText,
  reporting_officer_name: optionalShortText,
  reporting_officer_position: optionalShortText,
  photo_paths: z.array(z.string()).max(5).optional(),
  // Only persisted when category === 'medical'; the action drops it otherwise.
  medical_data: medicalDataSchema.optional(),
});
export type CreateIncidentInput = z.infer<typeof createIncidentSchema>;
