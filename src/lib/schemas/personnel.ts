import { z } from "zod";

const optionalText = z.string().trim().max(500).optional();
const optionalShortText = z.string().trim().max(200).optional();
const optionalUuid = z
  .string()
  .uuid()
  .nullable()
  .optional()
  .or(z.literal("").transform(() => null));

// =============================================================================
// PERSONNEL RECORDS (the people we issue ID cards to and scan for attendance —
// NOT auth/system users)
// =============================================================================

export const createPersonnelSchema = z.object({
  full_name: z.string().trim().min(1, "Full name is required").max(200),
  designation: optionalShortText,
  committee: z.string().trim().min(1, "Committee is required").max(200),
  area_assigned: optionalShortText,
  site_id: optionalUuid,
  agency: optionalShortText,
  contact_number: z.string().trim().max(50).optional(),
  photo_url: z.string().url().max(1000).optional().or(z.literal("")),
  is_active: z.boolean().optional(),
});
export type CreatePersonnelInput = z.infer<typeof createPersonnelSchema>;

export const updatePersonnelSchema = createPersonnelSchema.extend({
  id: z.string().uuid(),
});
export type UpdatePersonnelInput = z.infer<typeof updatePersonnelSchema>;

export const deletePersonnelSchema = z.object({
  id: z.string().uuid(),
});

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

// QR scan: a single personnel id (UUID); type is auto-decided server-side
// based on the personnel's most recent attendance log for the day.
export const scanAttendanceSchema = z.object({
  scanned_value: z
    .string()
    .min(1, "Scan value is empty")
    .max(500),
  site_id: z.string().uuid().nullable().optional(),
});
export type ScanAttendanceInput = z.infer<typeof scanAttendanceSchema>;
