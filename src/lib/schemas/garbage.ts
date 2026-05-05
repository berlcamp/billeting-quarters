import { z } from "zod";

const optionalText = z.string().trim().max(2000).optional();
const optionalShortText = z.string().trim().max(200).optional();

export const garbageStatusSchema = z.enum([
  "scheduled",
  "collected",
  "missed",
  "special_request",
]);

// ---------- Concrete pickup rows (palaro.garbage_collections) ----------

const collectionFields = z.object({
  site_id: z.string().uuid("Pick a site."),
  collector_id: z.string().uuid("Pick a collector.").nullable().optional(),
  scheduled_at: z
    .string()
    .min(1, "Scheduled time is required")
    .refine((s) => !isNaN(Date.parse(s)), "Invalid time"),
  is_special_request: z.boolean().optional(),
  collector_name: optionalShortText,
  notes: optionalText,
});

export const createGarbageSchema = collectionFields;
export type CreateGarbageInput = z.infer<typeof createGarbageSchema>;

export const updateGarbageSchema = collectionFields.extend({
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

// Toggling a checkbox in the weekly grid: marks scheduled <-> collected.
export const toggleGarbageCollectedSchema = z.object({
  id: z.string().uuid(),
  collected: z.boolean(),
});
export type ToggleGarbageCollectedInput = z.infer<
  typeof toggleGarbageCollectedSchema
>;

export const deleteGarbageSchema = z.object({ id: z.string().uuid() });

// ---------- Collectors registry (palaro.garbage_collectors) ----------

const collectorFields = z.object({
  coordinator_name: z.string().trim().min(1, "Coordinator name is required").max(200),
  vehicle_description: z.string().trim().max(300).nullable().optional(),
  contact_number: z.string().trim().max(50).nullable().optional(),
  is_active: z.boolean().optional(),
});

export const createGarbageCollectorSchema = collectorFields;
export type CreateGarbageCollectorInput = z.infer<
  typeof createGarbageCollectorSchema
>;

export const updateGarbageCollectorSchema = collectorFields.extend({
  id: z.string().uuid(),
});
export type UpdateGarbageCollectorInput = z.infer<
  typeof updateGarbageCollectorSchema
>;

export const deleteGarbageCollectorSchema = z.object({
  id: z.string().uuid(),
});

// ---------- Weekly schedule rules (palaro.garbage_schedule_rules) ----------

// HH:MM (00:00 .. 23:59). Stored in Postgres as TIME WITHOUT TIME ZONE in
// Asia/Manila local wall time. The week-generator combines this with each
// week's date to produce a UTC scheduled_at.
const timeOfDay = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM (24h)");

const ruleFields = z.object({
  collector_id: z.string().uuid("Pick a collector."),
  site_id: z.string().uuid("Pick a site."),
  // ISO day-of-week: 1 = Monday … 7 = Sunday.
  day_of_week: z
    .number()
    .int()
    .min(1, "Pick a day")
    .max(7, "Pick a day"),
  time_of_day: timeOfDay,
  is_active: z.boolean().optional(),
  notes: optionalText,
});

export const createGarbageRuleSchema = ruleFields;
export type CreateGarbageRuleInput = z.infer<typeof createGarbageRuleSchema>;

export const updateGarbageRuleSchema = ruleFields.extend({
  id: z.string().uuid(),
});
export type UpdateGarbageRuleInput = z.infer<typeof updateGarbageRuleSchema>;

export const deleteGarbageRuleSchema = z.object({ id: z.string().uuid() });

// ---------- Week generation ----------

// Manila-local YYYY-MM-DD of the week's Monday.
export const generateGarbageWeekSchema = z.object({
  week_start: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD"),
});
export type GenerateGarbageWeekInput = z.infer<
  typeof generateGarbageWeekSchema
>;
