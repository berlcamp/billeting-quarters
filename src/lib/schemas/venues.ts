import { z } from "zod";

const optionalText = z.string().trim().max(2000).optional();
const optionalShortText = z.string().trim().max(200).optional();

const baseFields = z.object({
  venue_id: z.string().uuid("Pick a playing venue."),
  delegation_id: z.string().uuid("Pick a delegation."),
  sport: optionalShortText,
  court_number: z
    .number({ error: "Pick a court." })
    .int()
    .min(1, "Court must be between 1 and 10.")
    .max(10, "Court must be between 1 and 10."),
  scheduled_start: z
    .string()
    .min(1, "Start time is required")
    .refine((s) => !isNaN(Date.parse(s)), "Invalid start time"),
  scheduled_end: z
    .string()
    .min(1, "End time is required")
    .refine((s) => !isNaN(Date.parse(s)), "Invalid end time"),
  is_special_request: z.boolean().optional(),
  special_request_reason: optionalText,
  notes: optionalText,
});

export const createScheduleSchema = baseFields
  .refine((d) => Date.parse(d.scheduled_end) > Date.parse(d.scheduled_start), {
    message: "End time must be after start time.",
    path: ["scheduled_end"],
  })
  .refine(
    (d) =>
      !d.is_special_request ||
      (d.special_request_reason && d.special_request_reason.trim().length > 0),
    {
      message: "Special requests must include a reason.",
      path: ["special_request_reason"],
    },
  );
export type CreateScheduleInput = z.infer<typeof createScheduleSchema>;

export const updateScheduleSchema = baseFields
  .extend({ id: z.string().uuid() })
  .refine((d) => Date.parse(d.scheduled_end) > Date.parse(d.scheduled_start), {
    message: "End time must be after start time.",
    path: ["scheduled_end"],
  });
export type UpdateScheduleInput = z.infer<typeof updateScheduleSchema>;

export const cancelScheduleSchema = z.object({
  id: z.string().uuid(),
  reason: z.string().trim().max(500).optional(),
});

export const deleteScheduleSchema = z.object({
  id: z.string().uuid(),
});

export const approveScheduleSchema = z.object({
  id: z.string().uuid(),
});

export const completeScheduleSchema = z.object({
  id: z.string().uuid(),
});
