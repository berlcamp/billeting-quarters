import { z } from "zod";

// =============================================================================
// EVENT ATTENDANCE (Personnel > Event Attendance)
// Events own a time-in-only attendance log. Time-in is recorded by scanning an
// existing personnel QR, or by manually entering a name for a non-system guest.
// =============================================================================

const optionalShortText = z
  .string()
  .trim()
  .max(200)
  .optional()
  .or(z.literal("").transform(() => undefined));

export const createEventSchema = z.object({
  name: z.string().trim().min(1, "Event name is required.").max(200),
  description: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .or(z.literal("").transform(() => undefined)),
  location: optionalShortText,
  // Optional scheduled date/time as an ISO string (empty normalises to undefined).
  event_date: z
    .string()
    .trim()
    .optional()
    .or(z.literal("").transform(() => undefined))
    .refine((s) => s === undefined || !isNaN(Date.parse(s)), "Invalid date"),
});
export type CreateEventInput = z.infer<typeof createEventSchema>;

export const updateEventSchema = createEventSchema.extend({
  id: z.string().uuid(),
});
export type UpdateEventInput = z.infer<typeof updateEventSchema>;

export const deleteEventSchema = z.object({ id: z.string().uuid() });

// QR scan: a single personnel id (UUID), parsed from the same envelope printed
// on ID cards ({"v":1,"id":"<uuid>"}) or a raw UUID.
export const scanEventAttendanceSchema = z.object({
  event_id: z.string().uuid("Select an event before scanning."),
  scanned_value: z.string().min(1, "Scan value is empty").max(500),
});
export type ScanEventAttendanceInput = z.infer<
  typeof scanEventAttendanceSchema
>;

// Manual entry for someone not yet in the personnel table.
export const manualEventAttendanceSchema = z.object({
  event_id: z.string().uuid(),
  full_name: z.string().trim().min(1, "Full name is required.").max(200),
  committee: optionalShortText,
  designation: optionalShortText,
});
export type ManualEventAttendanceInput = z.infer<
  typeof manualEventAttendanceSchema
>;
