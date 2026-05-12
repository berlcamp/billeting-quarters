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
// TRIPS / DISPATCHES — multi-leg, multi-group passenger trips
// ---------------------------------------------------------------------------

// One passenger group on a trip (delegation + team + headcount).
export const manifestRowSchema = z.object({
  delegation_id: z.string().uuid().nullable().optional(),
  team_name: z
    .string()
    .trim()
    .min(1, "Team name is required.")
    .max(120),
  total_passengers: z
    .number()
    .int()
    .min(1, "At least one passenger.")
    .max(500),
  notes: optionalText,
});
export type ManifestRowInput = z.infer<typeof manifestRowSchema>;

// Either a site_id or a free-text label must be set for a terminal.
const terminalRefinement = <
  T extends { site_id?: string | null; label?: string | null },
>(
  obj: T,
) =>
  Boolean(obj.site_id) || (typeof obj.label === "string" && obj.label.trim().length > 0);

const fromTerminal = z.object({
  from_site_id: z.string().uuid().nullable().optional(),
  from_label: z.string().trim().max(200).optional(),
});
const toTerminal = z.object({
  to_site_id: z.string().uuid().nullable().optional(),
  to_label: z.string().trim().max(200).optional(),
});

// Open a brand-new trip from a "Scan for Departure" action.
export const openTripFromDepartureSchema = z
  .object({
    scanned_value: z.string().trim().min(1, "Scan value is empty.").max(500),
    route_id: z.string().uuid().nullable().optional(),
    scheduled_at: z
      .string()
      .refine((s) => !s || !isNaN(Date.parse(s)), "Invalid date/time")
      .optional(),
    manifest: z
      .array(manifestRowSchema)
      .min(1, "Add at least one passenger group.")
      .max(50),
    notes: optionalText,
  })
  .merge(fromTerminal)
  .merge(toTerminal)
  .refine((d) => terminalRefinement({ site_id: d.from_site_id, label: d.from_label }), {
    message: "Pick or label the origin terminal.",
    path: ["from_site_id"],
  })
  .refine((d) => terminalRefinement({ site_id: d.to_site_id, label: d.to_label }), {
    message: "Pick or label the destination terminal.",
    path: ["to_site_id"],
  });
export type OpenTripFromDepartureInput = z.infer<
  typeof openTripFromDepartureSchema
>;

// Continue an active trip — dispatcher scanned for departure again at a
// terminal the bus arrived at earlier. Adds a new leg and optionally adjusts
// the manifest (board new groups; tweak existing totals if needed).
export const continueDepartureSchema = z
  .object({
    dispatch_id: z.string().uuid(),
    add_manifest: z.array(manifestRowSchema).max(50).optional(),
    adjust_manifest: z
      .array(
        z.object({
          manifest_id: z.string().uuid(),
          total_passengers: z.number().int().min(1).max(500),
        }),
      )
      .max(50)
      .optional(),
    notes: optionalText,
  })
  .merge(toTerminal)
  .refine((d) => terminalRefinement({ site_id: d.to_site_id, label: d.to_label }), {
    message: "Pick or label the next terminal.",
    path: ["to_site_id"],
  });
export type ContinueDepartureInput = z.infer<typeof continueDepartureSchema>;

// Record arrival of the currently-open leg, with per-group drop-off counts.
export const recordArrivalSchema = z.object({
  dispatch_id: z.string().uuid(),
  leg_id: z.string().uuid(),
  dropoffs: z
    .array(
      z.object({
        manifest_id: z.string().uuid(),
        count: z.number().int().min(0).max(500),
      }),
    )
    .max(50),
  arrival_notes: optionalText,
});
export type RecordArrivalInput = z.infer<typeof recordArrivalSchema>;

// Close a trip. Requires force=true + reason when any manifest row has
// remaining > 0.
export const closeTripSchema = z
  .object({
    dispatch_id: z.string().uuid(),
    force: z.boolean().optional(),
    reason: z.string().trim().max(500).optional(),
  })
  .refine((d) => !d.force || (d.reason && d.reason.length > 0), {
    message: "Force-close requires a reason.",
    path: ["reason"],
  });
export type CloseTripInput = z.infer<typeof closeTripSchema>;

// QR lookup helper used by both scan dialogs before showing the right form.
export const scanLookupSchema = z.object({
  scanned_value: z.string().trim().min(1, "Scan value is empty.").max(500),
});
export type ScanLookupInput = z.infer<typeof scanLookupSchema>;

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
