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
  // Each VIP must be assigned to a Protocol Officer at creation. The picker
  // is shown only to Command Center / Super Admin (the only roles allowed to
  // create VIPs); Protocol Officers receive the VIPs assigned to them.
  protocol_officer_id: z
    .string()
    .uuid("Select a Protocol Officer"),
});
export type CreateVipInput = z.infer<typeof createVipSchema>;

export const updateVipSchema = createVipSchema.extend({
  id: z.string().uuid(),
});
export type UpdateVipInput = z.infer<typeof updateVipSchema>;

// ETA at creation is required — a movement without an ETA isn't trackable.
// The from/to/request/remarks fields used to live on the separate "Logs"
// tab; they are now folded directly into the movement record.
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
  from_location: optionalShortText,
  to_location: optionalShortText,
  request: optionalText,
  remarks: optionalText,
});
export type CreateMovementInput = z.infer<typeof createMovementSchema>;

export const logArrivalSchema = z.object({
  movement_id: z.string().uuid(),
  // Optional override; defaults to NOW() server-side.
  actual_arrival: z.string().optional(),
  remarks: optionalText,
});
export type LogArrivalInput = z.infer<typeof logArrivalSchema>;

export const setEtdSchema = z.object({
  movement_id: z.string().uuid(),
  estimated_departure: z
    .string()
    .min(1, "Estimated departure is required")
    .refine((s) => !isNaN(Date.parse(s)), "Invalid date"),
  remarks: optionalText,
});
export type SetEtdInput = z.infer<typeof setEtdSchema>;

export const logDepartureSchema = z.object({
  movement_id: z.string().uuid(),
  actual_departure: z.string().optional(),
  remarks: optionalText,
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

