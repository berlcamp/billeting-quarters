import { z } from "zod";

const optionalText = z.string().trim().max(2000).optional();
const optionalShortText = z.string().trim().max(200).optional();

export const garbageStatusSchema = z.enum([
  "scheduled",
  "collected",
  "missed",
  "special_request",
]);

const fields = z.object({
  site_id: z.string().uuid("Pick a site."),
  scheduled_at: z
    .string()
    .min(1, "Scheduled time is required")
    .refine((s) => !isNaN(Date.parse(s)), "Invalid time"),
  is_special_request: z.boolean().optional(),
  collector_name: optionalShortText,
  notes: optionalText,
});

export const createGarbageSchema = fields;
export type CreateGarbageInput = z.infer<typeof createGarbageSchema>;

export const updateGarbageSchema = fields.extend({
  id: z.string().uuid(),
});
export type UpdateGarbageInput = z.infer<typeof updateGarbageSchema>;

export const markGarbageCollectedSchema = z.object({
  id: z.string().uuid(),
  collector_name: optionalShortText,
  notes: optionalText,
});
export type MarkGarbageCollectedInput = z.infer<
  typeof markGarbageCollectedSchema
>;

export const markGarbageMissedSchema = z.object({
  id: z.string().uuid(),
  reason: z.string().trim().max(500).optional(),
});
export type MarkGarbageMissedInput = z.infer<typeof markGarbageMissedSchema>;

export const deleteGarbageSchema = z.object({ id: z.string().uuid() });
