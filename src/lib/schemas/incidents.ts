import { z } from "zod";

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
  photo_paths: z.array(z.string()).max(5).optional(),
});
export type CreateIncidentInput = z.infer<typeof createIncidentSchema>;
