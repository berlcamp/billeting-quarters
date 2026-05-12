import { z } from "zod";

const optionalText = z.string().trim().max(4000).optional();
const optionalShortText = z.string().trim().max(200).optional();

// --- Site Monitoring Visits ---

export const createVisitSchema = z.object({
  site_id: z.string().uuid(),
  visit_title: z.string().trim().min(1, "Title is required").max(200),
  // Comma- or newline-separated when typed; the form splits before submitting.
  individuals: z.array(z.string().trim().min(1).max(200)).max(50),
  visited_at: z.string().min(1, "Date and time required"),
  observations: optionalText,
  notes_to_admin: optionalText,
});
export type CreateVisitInput = z.infer<typeof createVisitSchema>;

export const updateVisitSchema = createVisitSchema.extend({
  id: z.string().uuid(),
});
export type UpdateVisitInput = z.infer<typeof updateVisitSchema>;

export const deleteVisitSchema = z.object({ id: z.string().uuid() });

// --- External Personnel Logs ---

export const externalPersonnelStatusSchema = z.enum(["active", "inactive"]);

export const createExternalPersonnelSchema = z.object({
  site_id: z.string().uuid().nullable().optional(),
  full_name: z.string().trim().min(1, "Name is required").max(200),
  position: z.string().trim().min(1, "Position is required").max(200),
  organization: optionalShortText,
  logged_at: z.string().min(1, "Date and time required"),
  status: externalPersonnelStatusSchema,
  notes: optionalText,
});
export type CreateExternalPersonnelInput = z.infer<
  typeof createExternalPersonnelSchema
>;

export const updateExternalPersonnelSchema = createExternalPersonnelSchema.extend({
  id: z.string().uuid(),
});

export const setExternalPersonnelStatusSchema = z.object({
  id: z.string().uuid(),
  status: externalPersonnelStatusSchema,
});

export const deleteExternalPersonnelSchema = z.object({ id: z.string().uuid() });

// --- End-of-Day Reports ---

export const createEndOfDaySchema = z.object({
  site_id: z.string().uuid(),
  report_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD"),
  all_accounted_for: z.boolean(),
  outside_athletes: z.number().int().min(0).max(10000),
  outside_personnel: z.number().int().min(0).max(10000),
  outside_officials: z.number().int().min(0).max(10000),
  outside_details: optionalText,
  reporting_officer_name: z.string().trim().min(1, "Reporting officer is required").max(200),
  reporting_officer_position: optionalShortText,
  notes: optionalText,
});
export type CreateEndOfDayInput = z.infer<typeof createEndOfDaySchema>;

export const updateEndOfDaySchema = createEndOfDaySchema.extend({
  id: z.string().uuid(),
});

export const deleteEndOfDaySchema = z.object({ id: z.string().uuid() });
