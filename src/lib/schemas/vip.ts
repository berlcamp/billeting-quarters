import { z } from "zod";

const optionalText = z.string().trim().max(500).optional();
const optionalShortText = z.string().trim().max(200).optional();

export const createVipSchema = z.object({
  full_name: z.string().trim().min(1, "Name is required").max(200),
  title: optionalShortText,
  organization: optionalShortText,
  delegation_id: z.string().uuid().nullable().optional(),
  contact_number: optionalShortText,
  notes: optionalText,
});
export type CreateVipInput = z.infer<typeof createVipSchema>;

export const updateVipSchema = createVipSchema.extend({
  id: z.string().uuid(),
});
export type UpdateVipInput = z.infer<typeof updateVipSchema>;

// ETA at creation is required — a movement without an ETA isn't trackable.
export const createMovementSchema = z.object({
  vip_id: z.string().uuid(),
  destination_site_id: z.string().uuid().nullable().optional(),
  estimated_arrival: z
    .string()
    .min(1, "Estimated arrival is required")
    .refine((s) => !isNaN(Date.parse(s)), "Invalid date"),
  purpose: optionalShortText,
  vehicle_info: optionalShortText,
  escort_count: z.number().int().min(0).max(200).optional(),
  notes: optionalText,
});
export type CreateMovementInput = z.infer<typeof createMovementSchema>;

export const logArrivalSchema = z.object({
  movement_id: z.string().uuid(),
  // Optional override; defaults to NOW() server-side.
  actual_arrival: z.string().optional(),
  notes: optionalText,
});
export type LogArrivalInput = z.infer<typeof logArrivalSchema>;

export const setEtdSchema = z.object({
  movement_id: z.string().uuid(),
  estimated_departure: z
    .string()
    .min(1, "Estimated departure is required")
    .refine((s) => !isNaN(Date.parse(s)), "Invalid date"),
  notes: optionalText,
});
export type SetEtdInput = z.infer<typeof setEtdSchema>;

export const logDepartureSchema = z.object({
  movement_id: z.string().uuid(),
  actual_departure: z.string().optional(),
  notes: optionalText,
});
export type LogDepartureInput = z.infer<typeof logDepartureSchema>;

export const cancelMovementSchema = z.object({
  movement_id: z.string().uuid(),
  reason: z.string().trim().min(1, "Reason is required").max(500),
});
export type CancelMovementInput = z.infer<typeof cancelMovementSchema>;

// =============================================================================
// PROTOCOL OFFICER ASSIGNMENT (1 VIP : 1 Protocol Officer)
// =============================================================================

export const assignProtocolOfficerSchema = z.object({
  vip_id: z.string().uuid(),
  // null clears the assignment.
  protocol_officer_id: z.string().uuid().nullable(),
});
export type AssignProtocolOfficerInput = z.infer<
  typeof assignProtocolOfficerSchema
>;

// =============================================================================
// VIP LOGS (whereabouts / requests / remarks)
// =============================================================================

export const vipLogRequestStatusValues = [
  "pending",
  "in_progress",
  "completed",
  "denied",
] as const;

// Per spec: "From / To / Date and Time (autodetect system time) / Request /
// Status of Request (triggered by Command Center) / Remarks". The protocol
// officer enters everything except status; status is set by command center.
// At least one of from / to / request must be provided so a row carries
// information.
export const createVipLogSchema = z
  .object({
    vip_id: z.string().uuid(),
    from_location: optionalShortText,
    to_location: optionalShortText,
    // Optional override; defaults to NOW() server-side.
    logged_at: z
      .string()
      .optional()
      .refine(
        (s) => !s || !isNaN(Date.parse(s)),
        "Invalid date",
      ),
    request: optionalText,
    remarks: optionalText,
  })
  .refine(
    (v) =>
      Boolean(v.from_location?.trim()) ||
      Boolean(v.to_location?.trim()) ||
      Boolean(v.request?.trim()),
    {
      message: "Provide at least a from/to location or a request.",
      path: ["request"],
    },
  );
export type CreateVipLogInput = z.infer<typeof createVipLogSchema>;

export const updateVipLogRequestStatusSchema = z.object({
  log_id: z.string().uuid(),
  request_status: z.enum(vipLogRequestStatusValues),
  remarks: optionalText,
});
export type UpdateVipLogRequestStatusInput = z.infer<
  typeof updateVipLogRequestStatusSchema
>;
