import { z } from "zod";

const optionalText = z.string().trim().max(2000).optional();
const optionalShortText = z.string().trim().max(200).optional();

export const garbageStatusSchema = z.enum([
  "scheduled",
  "collected",
  "missed",
  "special_request",
  "no_collection_needed",
  "cancelled",
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

// Info Hub officer marking a BQ as "no collection needed today" — typically
// used on a day a rule would otherwise have generated a pickup.
export const markNoCollectionNeededSchema = z.object({
  id: z.string().uuid(),
  reason: z.string().trim().max(500).optional(),
});
export type MarkNoCollectionNeededInput = z.infer<
  typeof markNoCollectionNeededSchema
>;

// Cancel a specific pickup on the weekly grid (e.g. venue is closed today).
// Reversible — see unmarkGarbageCancelledSchema below for the undo path.
export const markGarbageCancelledSchema = z.object({
  id: z.string().uuid(),
  reason: z.string().trim().max(500).optional(),
});
export type MarkGarbageCancelledInput = z.infer<
  typeof markGarbageCancelledSchema
>;

export const unmarkGarbageCancelledSchema = z.object({
  id: z.string().uuid(),
});
export type UnmarkGarbageCancelledInput = z.infer<
  typeof unmarkGarbageCancelledSchema
>;

// Info Hub officer requesting an on-demand pickup for a BQ.
export const requestGarbageCollectionSchema = z.object({
  site_id: z.string().uuid("Pick a site."),
  requested_at: z
    .string()
    .min(1, "Time is required")
    .refine((s) => !isNaN(Date.parse(s)), "Invalid time"),
  notes: optionalText,
});
export type RequestGarbageCollectionInput = z.infer<
  typeof requestGarbageCollectionSchema
>;

// ---------- Collectors registry (palaro.garbage_collectors) ----------

const collectorFields = z.object({
  driver_name: z
    .string()
    .trim()
    .min(1, "Driver name is required")
    .max(200),
  swm_coordinator_name: z.string().trim().max(200).nullable().optional(),
  city_enro_coordinator_name: z.string().trim().max(200).nullable().optional(),
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

const optionalTimeOfDay = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM (24h)")
  .nullable()
  .optional()
  .or(z.literal("").transform(() => null));

const ruleFields = z.object({
  collector_id: z.string().uuid("Pick a collector."),
  site_id: z.string().uuid("Pick a site."),
  // ISO days-of-week: 1 = Monday … 7 = Sunday. One rule can cover multiple
  // days that share the same time slots (e.g. Mon/Wed/Fri 06:00).
  days_of_week: z
    .array(z.number().int().min(1).max(7))
    .min(1, "Pick at least one day"),
  // Primary (AM) pickup time — required.
  time_of_day: timeOfDay,
  // Optional second (PM) pickup time on the same day.
  time_of_day_pm: optionalTimeOfDay,
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
