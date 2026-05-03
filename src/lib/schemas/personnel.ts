import { z } from "zod";

const optionalText = z.string().trim().max(500).optional();
const optionalShortText = z.string().trim().max(200).optional();

export const createDutySchema = z
  .object({
    personnel_id: z.string().uuid("Select personnel."),
    site_id: z.string().uuid().nullable().optional(),
    duty_start: z
      .string()
      .min(1, "Start time is required")
      .refine((s) => !isNaN(Date.parse(s)), "Invalid start time"),
    duty_end: z
      .string()
      .min(1, "End time is required")
      .refine((s) => !isNaN(Date.parse(s)), "Invalid end time"),
    shift_label: optionalShortText,
    notes: optionalText,
  })
  .refine((d) => Date.parse(d.duty_end) > Date.parse(d.duty_start), {
    message: "End time must be after start time.",
    path: ["duty_end"],
  });
export type CreateDutyInput = z.infer<typeof createDutySchema>;

export const updateDutySchema = z
  .object({
    id: z.string().uuid(),
    personnel_id: z.string().uuid(),
    site_id: z.string().uuid().nullable().optional(),
    duty_start: z
      .string()
      .min(1)
      .refine((s) => !isNaN(Date.parse(s)), "Invalid start time"),
    duty_end: z
      .string()
      .min(1)
      .refine((s) => !isNaN(Date.parse(s)), "Invalid end time"),
    shift_label: optionalShortText,
    notes: optionalText,
  })
  .refine((d) => Date.parse(d.duty_end) > Date.parse(d.duty_start), {
    message: "End time must be after start time.",
    path: ["duty_end"],
  });
export type UpdateDutyInput = z.infer<typeof updateDutySchema>;

export const deleteDutySchema = z.object({
  id: z.string().uuid(),
});

export const recordAttendanceSchema = z.object({
  personnel_id: z.string().uuid("Select personnel."),
  site_id: z.string().uuid().nullable().optional(),
  type: z.enum(["time_in", "time_out"]),
  notes: optionalText,
});
export type RecordAttendanceInput = z.infer<typeof recordAttendanceSchema>;

// QR scan: a single profile id (UUID); type is auto-decided server-side
// based on the personnel's most recent attendance log for the day.
export const scanAttendanceSchema = z.object({
  scanned_value: z
    .string()
    .min(1, "Scan value is empty")
    .max(500),
  site_id: z.string().uuid().nullable().optional(),
});
export type ScanAttendanceInput = z.infer<typeof scanAttendanceSchema>;
