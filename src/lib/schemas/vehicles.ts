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

export const dispatchStatusSchema = z.enum([
  "scheduled",
  "in_transit",
  "completed",
  "cancelled",
]);
export type DispatchStatus = z.infer<typeof dispatchStatusSchema>;

// ---------------------------------------------------------------------------
// VEHICLES
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// VEHICLE LOGS (per-venue arrival/departure scans)
// ---------------------------------------------------------------------------

// Manual log entry — operator picks vehicle + direction. dispatch_id and the
// snapshot fields are optional so ad-hoc logs (no dispatch in the system yet)
// still record cleanly.
export const logVehicleSchema = z.object({
  vehicle_id: z.string().uuid("Pick a vehicle."),
  site_id: z.string().uuid("Pick a site."),
  direction: z.enum(["in", "out"]),
  dispatch_id: z.string().uuid().nullable().optional(),
  delegation_id: z.string().uuid().nullable().optional(),
  sport: optionalShortText,
  team_count: z.number().int().min(0).max(50).optional(),
  passenger_count: z.number().int().min(0).max(500).optional(),
  from_site_id: z.string().uuid().nullable().optional(),
  to_site_id: z.string().uuid().nullable().optional(),
  notes: optionalText,
});
export type LogVehicleInput = z.infer<typeof logVehicleSchema>;

// QR scan — auto-decides direction (last log was 'in' → next is 'out', else 'in').
// The dispatcher can attach the active dispatch + per-scan snapshot fields.
export const scanVehicleSchema = z.object({
  scanned_value: z.string().trim().min(1, "Scan value is empty").max(500),
  site_id: z.string().uuid("Pick a site."),
  dispatch_id: z.string().uuid().nullable().optional(),
  delegation_id: z.string().uuid().nullable().optional(),
  sport: optionalShortText,
  team_count: z.number().int().min(0).max(50).optional(),
  passenger_count: z.number().int().min(0).max(500).optional(),
  from_site_id: z.string().uuid().nullable().optional(),
  to_site_id: z.string().uuid().nullable().optional(),
  notes: optionalText,
});
export type ScanVehicleInput = z.infer<typeof scanVehicleSchema>;

// ---------------------------------------------------------------------------
// ROUTES (multi-stop)
// ---------------------------------------------------------------------------

const routeStopSchema = z.object({
  site_id: z.string().uuid().nullable().optional(),
  label: z.string().trim().max(200).optional(),
  notes: optionalText,
});
export type RouteStopInput = z.infer<typeof routeStopSchema>;

const routeStopsSchema = z
  .array(routeStopSchema)
  .min(2, "A route needs at least two stops (origin and destination).")
  .max(40)
  .refine(
    (stops) => stops.every((s) => s.site_id || s.label?.trim().length),
    "Every stop needs a site or a label.",
  );

export const createRouteSchema = z.object({
  vehicle_id: z.string().uuid().nullable().optional(),
  route_name: z.string().trim().min(1, "Route name is required").max(120),
  scheduled_time: z
    .string()
    .min(1)
    .refine((s) => !isNaN(Date.parse(s)), "Invalid date/time")
    .optional(),
  delegation_id: z.string().uuid().nullable().optional(),
  notes: optionalText,
  stops: routeStopsSchema,
});
export type CreateRouteInput = z.infer<typeof createRouteSchema>;

export const deleteRouteSchema = z.object({ id: z.string().uuid() });

// ---------------------------------------------------------------------------
// DISPATCHES (the trip record before a vehicle leaves)
// ---------------------------------------------------------------------------

export const createDispatchSchema = z.object({
  vehicle_id: z.string().uuid("Pick a vehicle."),
  route_id: z.string().uuid().nullable().optional(),
  delegation_id: z.string().uuid("Pick a delegation."),
  sport: z.string().trim().min(1, "Pick or type the sport / team.").max(120),
  team_count: z.number().int().min(1, "At least one team.").max(50),
  expected_pax: z
    .number()
    .int()
    .min(1, "Headcount boarding at origin is required.")
    .max(500),
  origin_site_id: z.string().uuid("Pick the origin site."),
  destination_site_id: z.string().uuid("Pick the destination site."),
  scheduled_at: z
    .string()
    .refine((s) => !s || !isNaN(Date.parse(s)), "Invalid date/time")
    .optional(),
  notes: optionalText,
});
export type CreateDispatchInput = z.infer<typeof createDispatchSchema>;

export const updateDispatchStatusSchema = z.object({
  id: z.string().uuid(),
  status: dispatchStatusSchema,
});
export type UpdateDispatchStatusInput = z.infer<
  typeof updateDispatchStatusSchema
>;

// ---------------------------------------------------------------------------
// FUEL INVENTORY
// ---------------------------------------------------------------------------

export const createFuelLogSchema = z.object({
  vehicle_id: z.string().uuid("Pick a vehicle."),
  refilled_at: z
    .string()
    .min(1, "Pick a date/time")
    .refine((s) => !isNaN(Date.parse(s)), "Invalid date/time"),
  liters: z.number().min(0).max(2000),
  cost_php: z.number().min(0).max(1_000_000).optional(),
  odometer_km: z.number().int().min(0).max(2_000_000).optional(),
  station: optionalShortText,
  notes: optionalText,
});
export type CreateFuelLogInput = z.infer<typeof createFuelLogSchema>;

export const deleteFuelLogSchema = z.object({ id: z.string().uuid() });
