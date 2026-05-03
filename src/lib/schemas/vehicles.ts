import { z } from "zod";

const optionalText = z.string().trim().max(500).optional();
const optionalShortText = z.string().trim().max(200).optional();

export const vehicleTypeSchema = z.enum([
  "bus",
  "van",
  "multicab",
  "pedicab",
  "ambulance",
  "service_vehicle",
]);

const vehicleFields = z.object({
  vehicle_code: z
    .string()
    .trim()
    .min(2, "Code must be at least 2 characters")
    .max(40)
    .regex(/^[A-Za-z0-9-]+$/, "Use letters, digits, and dashes only"),
  plate_number: optionalShortText,
  vehicle_type: vehicleTypeSchema,
  make_model: optionalShortText,
  capacity: z.number().int().min(0).max(500).optional(),
  driver_name: optionalShortText,
  driver_contact: optionalShortText,
  current_assignment: optionalShortText,
  notes: optionalText,
});

export const createVehicleSchema = vehicleFields;
export type CreateVehicleInput = z.infer<typeof createVehicleSchema>;

export const updateVehicleSchema = vehicleFields.extend({
  id: z.string().uuid(),
});
export type UpdateVehicleInput = z.infer<typeof updateVehicleSchema>;

export const deleteVehicleSchema = z.object({ id: z.string().uuid() });

// Manual log entry — operator picks vehicle + direction.
export const logVehicleSchema = z.object({
  vehicle_id: z.string().uuid("Pick a vehicle."),
  site_id: z.string().uuid("Pick a site."),
  direction: z.enum(["in", "out"]),
  passenger_count: z.number().int().min(0).max(500).optional(),
  notes: optionalText,
});
export type LogVehicleInput = z.infer<typeof logVehicleSchema>;

// QR scan — auto-decides direction (last log was 'in' → next is 'out', else 'in').
export const scanVehicleSchema = z.object({
  scanned_value: z.string().trim().min(1, "Scan value is empty").max(500),
  site_id: z.string().uuid("Pick a site."),
  passenger_count: z.number().int().min(0).max(500).optional(),
  notes: optionalText,
});
export type ScanVehicleInput = z.infer<typeof scanVehicleSchema>;

export const createRouteSchema = z.object({
  vehicle_id: z.string().uuid("Pick a vehicle."),
  route_name: z.string().trim().min(1, "Route name is required").max(120),
  origin_site_id: z.string().uuid().nullable().optional(),
  destination_site_id: z.string().uuid().nullable().optional(),
  scheduled_time: z
    .string()
    .min(1)
    .refine((s) => !isNaN(Date.parse(s)), "Invalid date/time")
    .optional(),
  delegation_id: z.string().uuid().nullable().optional(),
  notes: optionalText,
});
export type CreateRouteInput = z.infer<typeof createRouteSchema>;

export const deleteRouteSchema = z.object({ id: z.string().uuid() });
