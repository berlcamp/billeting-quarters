"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth/session";
import { hasPermission, type Permission } from "@/lib/permissions";
import {
  closeTripSchema,
  continueDepartureSchema,
  createFuelLogSchema,
  createRouteSchema,
  createVehicleSchema,
  deleteFuelLogSchema,
  deleteRouteSchema,
  deleteVehicleSchema,
  openTripFromDepartureSchema,
  recordArrivalSchema,
  scanLookupSchema,
  updateDispatchStatusSchema,
  updateVehicleSchema,
} from "@/lib/schemas/vehicles";
import { recordAudit } from "./audit";
import { fail, ok, type ActionResult } from "./types";
import type { Database } from "@/types/database";

type Vehicle = Database["palaro"]["Tables"]["vehicles"]["Row"];
type VehicleRoute = Database["palaro"]["Tables"]["vehicle_routes"]["Row"];
type VehicleRouteStop =
  Database["palaro"]["Tables"]["vehicle_route_stops"]["Row"];
type VehicleDispatch =
  Database["palaro"]["Tables"]["vehicle_dispatches"]["Row"];
type VehicleTripLeg =
  Database["palaro"]["Tables"]["vehicle_trip_legs"]["Row"];
type VehicleTripManifest =
  Database["palaro"]["Tables"]["vehicle_trip_manifest"]["Row"];
type VehicleTripDropoff =
  Database["palaro"]["Tables"]["vehicle_trip_dropoffs"]["Row"];
type VehicleFuelLog =
  Database["palaro"]["Tables"]["vehicle_fuel_logs"]["Row"];

const VEHICLES_PATH = "/dashboard/transportation";

// ---------------------------------------------------------------------------
// Permission gates
// ---------------------------------------------------------------------------

async function requirePermission(perm: Permission, deniedMsg: string) {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false as const, error: "Not authenticated." };
  if (!hasPermission(profile, perm)) {
    return { ok: false as const, error: deniedMsg };
  }
  return { ok: true as const, profile };
}

async function requireAnyPermission(perms: Permission[], deniedMsg: string) {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false as const, error: "Not authenticated." };
  if (!perms.some((p) => hasPermission(profile, p))) {
    return { ok: false as const, error: deniedMsg };
  }
  return { ok: true as const, profile };
}

const requireVehicleManager = () =>
  requirePermission("vehicle.manage", "You can't manage vehicles.");
const requireVehicleScanner = () =>
  requireAnyPermission(
    ["vehicle.scan", "vehicle.manage"],
    "You can't scan vehicles.",
  );
const requireDispatcher = () =>
  requireAnyPermission(
    ["vehicle.dispatch", "vehicle.manage"],
    "You can't create dispatches.",
  );
const requireFuelLogger = () =>
  requireAnyPermission(
    ["vehicle.fuel", "vehicle.manage"],
    "You can't log fuel.",
  );

// =============================================================================
// VEHICLES
// =============================================================================

export async function getVehicles(
  includeInactive = false,
): Promise<ActionResult<Vehicle[]>> {
  const profile = await getCurrentProfile();
  if (!profile) return fail("Not authenticated.");

  const admin = createAdminClient();
  let q = admin
    .schema("palaro")
    .from("vehicles")
    .select("*")
    .order("vehicle_code", { ascending: true });
  if (!includeInactive) q = q.eq("is_active", true);

  const { data, error } = await q;
  if (error) return fail(error.message);
  return ok(data ?? []);
}

export async function createVehicle(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const auth = await requireVehicleManager();
  if (!auth.ok) return fail(auth.error);

  const parsed = createVehicleSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  const data = parsed.data;

  const admin = createAdminClient();
  const { data: inserted, error } = await admin
    .schema("palaro")
    .from("vehicles")
    .insert({
      vehicle_code: data.vehicle_code.trim().toUpperCase(),
      plate_number: data.plate_number || null,
      vehicle_type: data.vehicle_type,
      make_model: data.make_model || null,
      capacity: data.capacity ?? null,
      driver_name: data.driver_name || null,
      driver_contact: data.driver_contact || null,
      current_assignment: data.current_assignment || null,
      notes: data.notes || null,
    })
    .select("id")
    .single();
  if (error) {
    if (error.message.includes("vehicles_vehicle_code_key")) {
      return fail("That vehicle code is already in use.");
    }
    return fail(error.message);
  }

  await recordAudit({
    action: "create",
    entity_type: "vehicle",
    entity_id: inserted.id,
    changes: {
      vehicle_code: data.vehicle_code,
      vehicle_type: data.vehicle_type,
    },
    user_id: auth.profile.id,
  });

  revalidatePath(VEHICLES_PATH);
  return ok({ id: inserted.id });
}

export async function updateVehicle(
  input: unknown,
): Promise<ActionResult<void>> {
  const auth = await requireVehicleManager();
  if (!auth.ok) return fail(auth.error);

  const parsed = updateVehicleSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  const { id, ...data } = parsed.data;

  const admin = createAdminClient();
  const { error } = await admin
    .schema("palaro")
    .from("vehicles")
    .update({
      vehicle_code: data.vehicle_code.trim().toUpperCase(),
      plate_number: data.plate_number || null,
      vehicle_type: data.vehicle_type,
      make_model: data.make_model || null,
      capacity: data.capacity ?? null,
      driver_name: data.driver_name || null,
      driver_contact: data.driver_contact || null,
      current_assignment: data.current_assignment || null,
      notes: data.notes || null,
    })
    .eq("id", id);
  if (error) return fail(error.message);

  await recordAudit({
    action: "update",
    entity_type: "vehicle",
    entity_id: id,
    changes: {
      vehicle_code: data.vehicle_code,
      vehicle_type: data.vehicle_type,
    },
    user_id: auth.profile.id,
  });

  revalidatePath(VEHICLES_PATH);
  return ok();
}

// Soft delete — flips is_active=false. Logs are retained.
export async function deleteVehicle(
  input: unknown,
): Promise<ActionResult<void>> {
  const auth = await requireVehicleManager();
  if (!auth.ok) return fail(auth.error);

  const parsed = deleteVehicleSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }

  const admin = createAdminClient();
  const { error } = await admin
    .schema("palaro")
    .from("vehicles")
    .update({ is_active: false })
    .eq("id", parsed.data.id);
  if (error) return fail(error.message);

  await recordAudit({
    action: "delete",
    entity_type: "vehicle",
    entity_id: parsed.data.id,
    changes: { is_active: false },
    user_id: auth.profile.id,
  });

  revalidatePath(VEHICLES_PATH);
  return ok();
}

// =============================================================================
// VEHICLE ROUTES (multi-stop)
// =============================================================================

export type VehicleRouteWithStops = VehicleRoute & { stops: VehicleRouteStop[] };

export async function getVehicleRoutes(): Promise<
  ActionResult<VehicleRouteWithStops[]>
> {
  const auth = await requireVehicleScanner();
  if (!auth.ok) return fail(auth.error);

  const admin = createAdminClient();
  const { data: routes, error } = await admin
    .schema("palaro")
    .from("vehicle_routes")
    .select("*")
    .order("scheduled_time", { ascending: true, nullsFirst: false })
    .limit(500);
  if (error) return fail(error.message);

  const routeIds = (routes ?? []).map((r) => r.id);
  if (routeIds.length === 0) return ok([]);

  const { data: stops, error: stopsErr } = await admin
    .schema("palaro")
    .from("vehicle_route_stops")
    .select("*")
    .in("route_id", routeIds)
    .order("stop_order", { ascending: true });
  if (stopsErr) return fail(stopsErr.message);

  const stopsByRoute = new Map<string, VehicleRouteStop[]>();
  for (const s of stops ?? []) {
    const list = stopsByRoute.get(s.route_id) ?? [];
    list.push(s);
    stopsByRoute.set(s.route_id, list);
  }

  return ok(
    (routes ?? []).map((r) => ({
      ...r,
      stops: stopsByRoute.get(r.id) ?? [],
    })),
  );
}

export async function createRoute(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const auth = await requireVehicleManager();
  if (!auth.ok) return fail(auth.error);

  const parsed = createRouteSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  const data = parsed.data;

  // First and last stop double as denormalised origin/destination on the
  // route row — keeps the existing column-based queries working.
  const firstStop = data.stops[0];
  const lastStop = data.stops[data.stops.length - 1];

  const admin = createAdminClient();
  const { data: inserted, error } = await admin
    .schema("palaro")
    .from("vehicle_routes")
    .insert({
      vehicle_id: data.vehicle_id || null,
      route_name: data.route_name,
      origin_site_id: firstStop.site_id || null,
      destination_site_id: lastStop.site_id || null,
      scheduled_time: data.scheduled_time
        ? new Date(data.scheduled_time).toISOString()
        : null,
      delegation_id: data.delegation_id || null,
      notes: data.notes || null,
    })
    .select("id")
    .single();
  if (error) return fail(error.message);

  const stopRows = data.stops.map((stop, index) => ({
    route_id: inserted.id,
    stop_order: index + 1,
    site_id: stop.site_id || null,
    label: stop.label?.trim() || null,
    notes: stop.notes || null,
  }));

  const { error: stopsErr } = await admin
    .schema("palaro")
    .from("vehicle_route_stops")
    .insert(stopRows);
  if (stopsErr) {
    // Roll back the route — without stops it's not useful and would block
    // re-creation since vehicle_route_stops is the source of truth.
    await admin
      .schema("palaro")
      .from("vehicle_routes")
      .delete()
      .eq("id", inserted.id);
    return fail(stopsErr.message);
  }

  await recordAudit({
    action: "create",
    entity_type: "vehicle_route",
    entity_id: inserted.id,
    changes: {
      route_name: data.route_name,
      stop_count: data.stops.length,
    },
    user_id: auth.profile.id,
  });

  revalidatePath(VEHICLES_PATH);
  return ok({ id: inserted.id });
}

export async function deleteRoute(
  input: unknown,
): Promise<ActionResult<void>> {
  const auth = await requireVehicleManager();
  if (!auth.ok) return fail(auth.error);

  const parsed = deleteRouteSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }

  const admin = createAdminClient();
  const { error } = await admin
    .schema("palaro")
    .from("vehicle_routes")
    .delete()
    .eq("id", parsed.data.id);
  if (error) return fail(error.message);

  await recordAudit({
    action: "delete",
    entity_type: "vehicle_route",
    entity_id: parsed.data.id,
    user_id: auth.profile.id,
  });

  revalidatePath(VEHICLES_PATH);
  return ok();
}

// =============================================================================
// TRIPS / DISPATCHES (multi-leg, multi-group passenger trips)
// =============================================================================

// Shared QR resolver — accepts a UUID, a {"v":1,"vid":"<uuid>"} envelope, or
// a raw vehicle_code, and returns the canonical vehicle row.
async function resolveScannedVehicle(
  admin: ReturnType<typeof createAdminClient>,
  scannedValue: string,
): Promise<Pick<Vehicle, "id" | "vehicle_code" | "is_active"> | null> {
  const trimmed = scannedValue.trim();

  let candidateUuid: string | null = null;
  if (/^[0-9a-fA-F-]{36}$/.test(trimmed)) {
    candidateUuid = trimmed;
  } else {
    try {
      const env = JSON.parse(trimmed) as { v?: number; vid?: string };
      if (env?.vid && /^[0-9a-fA-F-]{36}$/.test(env.vid)) {
        candidateUuid = env.vid;
      }
    } catch {
      // not JSON — fall through
    }
  }

  if (candidateUuid) {
    const { data: matched } = await admin
      .schema("palaro")
      .from("vehicles")
      .select("id, vehicle_code, is_active")
      .eq("id", candidateUuid)
      .maybeSingle();
    if (matched) return matched;
  }

  const code = trimmed.toUpperCase();
  const { data: matched } = await admin
    .schema("palaro")
    .from("vehicles")
    .select("id, vehicle_code, is_active")
    .eq("vehicle_code", code)
    .maybeSingle();
  return matched ?? null;
}

export type ActiveTrip = {
  dispatch: VehicleDispatch;
  open_leg: VehicleTripLeg | null;
  legs: VehicleTripLeg[];
  manifest: VehicleTripManifest[];
  recent_dropoffs: VehicleTripDropoff[];
};

async function loadActiveTrip(
  admin: ReturnType<typeof createAdminClient>,
  vehicleId: string,
): Promise<ActiveTrip | null> {
  const { data: dispatch } = await admin
    .schema("palaro")
    .from("vehicle_dispatches")
    .select("*")
    .eq("vehicle_id", vehicleId)
    .in("status", ["scheduled", "in_transit"])
    .order("dispatched_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!dispatch) return null;

  const [legsRes, manifestRes] = await Promise.all([
    admin
      .schema("palaro")
      .from("vehicle_trip_legs")
      .select("*")
      .eq("dispatch_id", dispatch.id)
      .order("leg_order", { ascending: true }),
    admin
      .schema("palaro")
      .from("vehicle_trip_manifest")
      .select("*")
      .eq("dispatch_id", dispatch.id)
      .order("created_at", { ascending: true }),
  ]);

  const legs = legsRes.data ?? [];
  const manifest = manifestRes.data ?? [];
  const openLeg = legs.find((l) => l.arrived_at === null) ?? null;

  let recentDropoffs: VehicleTripDropoff[] = [];
  if (legs.length > 0) {
    const legIds = legs.map((l) => l.id);
    const { data } = await admin
      .schema("palaro")
      .from("vehicle_trip_dropoffs")
      .select("*")
      .in("leg_id", legIds)
      .order("recorded_at", { ascending: false })
      .limit(20);
    recentDropoffs = data ?? [];
  }

  return {
    dispatch,
    open_leg: openLeg,
    legs,
    manifest,
    recent_dropoffs: recentDropoffs,
  };
}

export type ScanLookupResult = {
  vehicle_id: string;
  vehicle_code: string;
  is_active: boolean;
  active_trip: ActiveTrip | null;
};

// Single entrypoint for the "Scan for Departure" and "Scan for Arrival"
// flows: decode the QR, return the vehicle + (optionally) its active trip
// so the UI can branch.
export async function lookupVehicleByScan(
  input: unknown,
): Promise<ActionResult<ScanLookupResult>> {
  const auth = await requireDispatcher();
  if (!auth.ok) return fail(auth.error);

  const parsed = scanLookupSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }

  const admin = createAdminClient();
  const vehicle = await resolveScannedVehicle(admin, parsed.data.scanned_value);
  if (!vehicle) return fail("Scan value did not match any vehicle.");

  const active_trip = vehicle.is_active
    ? await loadActiveTrip(admin, vehicle.id)
    : null;

  return ok({
    vehicle_id: vehicle.id,
    vehicle_code: vehicle.vehicle_code,
    is_active: vehicle.is_active,
    active_trip,
  });
}

export async function getActiveTripForVehicle(
  vehicleId: string,
): Promise<ActionResult<ActiveTrip | null>> {
  const auth = await requireDispatcher();
  if (!auth.ok) return fail(auth.error);

  if (!/^[0-9a-fA-F-]{36}$/.test(vehicleId)) {
    return fail("Invalid vehicle id.");
  }

  const admin = createAdminClient();
  return ok(await loadActiveTrip(admin, vehicleId));
}

export async function getDispatches(
  limit = 200,
): Promise<ActionResult<VehicleDispatch[]>> {
  const auth = await requireVehicleScanner();
  if (!auth.ok) return fail(auth.error);

  const admin = createAdminClient();
  const { data, error } = await admin
    .schema("palaro")
    .from("vehicle_dispatches")
    .select("*")
    .order("dispatched_at", { ascending: false })
    .limit(limit);
  if (error) return fail(error.message);
  return ok(data ?? []);
}

// Open a brand-new trip from a "Scan for Departure" action.
// Inserts dispatch (status='in_transit'), leg 1, and the manifest rows in
// one logical operation. Rejects if the vehicle already has an open trip.
export async function openTripFromDeparture(
  input: unknown,
): Promise<ActionResult<{ dispatch_id: string; leg_id: string }>> {
  const auth = await requireDispatcher();
  if (!auth.ok) return fail(auth.error);

  const parsed = openTripFromDepartureSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  const data = parsed.data;

  const admin = createAdminClient();
  const vehicle = await resolveScannedVehicle(admin, data.scanned_value);
  if (!vehicle) return fail("Scan value did not match any vehicle.");
  if (!vehicle.is_active) return fail("Vehicle is decommissioned.");

  const existing = await loadActiveTrip(admin, vehicle.id);
  if (existing) {
    return fail(
      "This vehicle already has an open trip. Use Scan for Arrival, or close it first.",
    );
  }

  // The denormalised origin/destination on the trip mirror leg 1's from/to
  // so legacy reports keep working.
  const { data: dispatch, error: dispatchErr } = await admin
    .schema("palaro")
    .from("vehicle_dispatches")
    .insert({
      vehicle_id: vehicle.id,
      route_id: data.route_id || null,
      origin_site_id: data.from_site_id || null,
      destination_site_id: data.to_site_id || null,
      scheduled_at: data.scheduled_at
        ? new Date(data.scheduled_at).toISOString()
        : null,
      dispatched_by: auth.profile.id,
      status: "in_transit",
      notes: data.notes || null,
    })
    .select("*")
    .single();
  if (dispatchErr) {
    if (dispatchErr.message.includes("one_open_per_vehicle")) {
      return fail(
        "This vehicle already has an open trip. Use Scan for Arrival, or close it first.",
      );
    }
    return fail(dispatchErr.message);
  }

  const { data: leg, error: legErr } = await admin
    .schema("palaro")
    .from("vehicle_trip_legs")
    .insert({
      dispatch_id: dispatch.id,
      leg_order: 1,
      from_site_id: data.from_site_id || null,
      from_label: data.from_label?.trim() || null,
      to_site_id: data.to_site_id || null,
      to_label: data.to_label?.trim() || null,
      departed_by: auth.profile.id,
    })
    .select("*")
    .single();
  if (legErr) {
    await admin.schema("palaro").from("vehicle_dispatches").delete().eq("id", dispatch.id);
    return fail(legErr.message);
  }

  const manifestRows = data.manifest.map((row) => ({
    dispatch_id: dispatch.id,
    delegation_id: row.delegation_id || null,
    team_name: row.team_name.trim(),
    total_passengers: row.total_passengers,
    boarded_at_leg_id: leg.id,
    notes: row.notes || null,
  }));
  const { error: manifestErr } = await admin
    .schema("palaro")
    .from("vehicle_trip_manifest")
    .insert(manifestRows);
  if (manifestErr) {
    await admin.schema("palaro").from("vehicle_dispatches").delete().eq("id", dispatch.id);
    return fail(manifestErr.message);
  }

  await recordAudit({
    action: "create",
    entity_type: "vehicle_trip",
    entity_id: dispatch.id,
    changes: {
      vehicle_id: vehicle.id,
      vehicle_code: vehicle.vehicle_code,
      first_leg_id: leg.id,
      manifest_count: manifestRows.length,
      total_passengers: manifestRows.reduce(
        (s, r) => s + r.total_passengers,
        0,
      ),
    },
    user_id: auth.profile.id,
  });

  revalidatePath(VEHICLES_PATH);
  return ok({ dispatch_id: dispatch.id, leg_id: leg.id });
}

// Continue an active trip: previous leg has arrived, dispatcher scans again
// at the same terminal to depart for the next stop. Optionally adds new
// passenger groups and adjusts existing totals (e.g. groups boarded here).
export async function recordDeparture(
  input: unknown,
): Promise<ActionResult<{ leg_id: string }>> {
  const auth = await requireDispatcher();
  if (!auth.ok) return fail(auth.error);

  const parsed = continueDepartureSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  const data = parsed.data;

  const admin = createAdminClient();
  const { data: dispatch } = await admin
    .schema("palaro")
    .from("vehicle_dispatches")
    .select("*")
    .eq("id", data.dispatch_id)
    .maybeSingle();
  if (!dispatch) return fail("Trip not found.");
  if (dispatch.status === "completed" || dispatch.status === "cancelled") {
    return fail("This trip is closed — open a new one.");
  }

  const { data: legs } = await admin
    .schema("palaro")
    .from("vehicle_trip_legs")
    .select("*")
    .eq("dispatch_id", dispatch.id)
    .order("leg_order", { ascending: true });

  const allLegs = legs ?? [];
  const openLeg = allLegs.find((l) => l.arrived_at === null);
  if (openLeg) {
    return fail(
      "The bus is still in transit on its current leg — record arrival first.",
    );
  }

  const lastLeg = allLegs[allLegs.length - 1] ?? null;
  const fromSiteId = lastLeg?.to_site_id ?? null;
  const fromLabel = lastLeg?.to_label ?? null;
  if (!fromSiteId && !fromLabel) {
    return fail("Couldn't infer the origin terminal from the previous leg.");
  }
  const nextOrder = (lastLeg?.leg_order ?? 0) + 1;

  const { data: leg, error: legErr } = await admin
    .schema("palaro")
    .from("vehicle_trip_legs")
    .insert({
      dispatch_id: dispatch.id,
      leg_order: nextOrder,
      from_site_id: fromSiteId,
      from_label: fromLabel,
      to_site_id: data.to_site_id || null,
      to_label: data.to_label?.trim() || null,
      departed_by: auth.profile.id,
      notes: data.notes || null,
    })
    .select("*")
    .single();
  if (legErr) {
    if (legErr.message.includes("one_open_per_dispatch")) {
      return fail(
        "The bus is still in transit on its current leg — record arrival first.",
      );
    }
    return fail(legErr.message);
  }

  if (data.add_manifest && data.add_manifest.length > 0) {
    const rows = data.add_manifest.map((row) => ({
      dispatch_id: dispatch.id,
      delegation_id: row.delegation_id || null,
      team_name: row.team_name.trim(),
      total_passengers: row.total_passengers,
      boarded_at_leg_id: leg.id,
      notes: row.notes || null,
    }));
    const { error: addErr } = await admin
      .schema("palaro")
      .from("vehicle_trip_manifest")
      .insert(rows);
    if (addErr) return fail(addErr.message);
  }

  if (data.adjust_manifest && data.adjust_manifest.length > 0) {
    for (const adj of data.adjust_manifest) {
      const { error: adjErr } = await admin
        .schema("palaro")
        .from("vehicle_trip_manifest")
        .update({ total_passengers: adj.total_passengers })
        .eq("id", adj.manifest_id)
        .eq("dispatch_id", dispatch.id);
      if (adjErr) return fail(adjErr.message);
    }
  }

  // Keep the trip's denormalised destination in sync with the latest leg.
  await admin
    .schema("palaro")
    .from("vehicle_dispatches")
    .update({
      destination_site_id: data.to_site_id || null,
      status: "in_transit",
    })
    .eq("id", dispatch.id);

  await recordAudit({
    action: "create",
    entity_type: "vehicle_trip_leg",
    entity_id: leg.id,
    changes: {
      dispatch_id: dispatch.id,
      leg_order: nextOrder,
      from_site_id: fromSiteId,
      to_site_id: data.to_site_id || null,
      added_manifest: data.add_manifest?.length ?? 0,
      adjusted_manifest: data.adjust_manifest?.length ?? 0,
    },
    user_id: auth.profile.id,
  });

  revalidatePath(VEHICLES_PATH);
  return ok({ leg_id: leg.id });
}

// Record arrival on the currently-open leg, including per-group drop-off
// counts. count=0 means the group stays on the bus.
export async function recordArrival(
  input: unknown,
): Promise<ActionResult<{ dropoff_count: number }>> {
  const auth = await requireDispatcher();
  if (!auth.ok) return fail(auth.error);

  const parsed = recordArrivalSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  const data = parsed.data;

  const admin = createAdminClient();
  const { data: leg } = await admin
    .schema("palaro")
    .from("vehicle_trip_legs")
    .select("*")
    .eq("id", data.leg_id)
    .eq("dispatch_id", data.dispatch_id)
    .maybeSingle();
  if (!leg) return fail("Leg not found.");
  if (leg.arrived_at) return fail("This leg has already been marked arrived.");

  const { data: manifest } = await admin
    .schema("palaro")
    .from("vehicle_trip_manifest")
    .select("*")
    .eq("dispatch_id", data.dispatch_id);
  const byId = new Map((manifest ?? []).map((m) => [m.id, m]));

  // Validate every drop-off count against remaining before mutating anything.
  for (const d of data.dropoffs) {
    if (d.count <= 0) continue;
    const m = byId.get(d.manifest_id);
    if (!m) return fail("Unknown manifest row.");
    const remaining = m.total_passengers - m.dropped_off;
    if (d.count > remaining) {
      return fail(
        `Can't drop off ${d.count} from "${m.team_name}" — only ${remaining} remaining.`,
      );
    }
  }

  const arrivedAt = new Date().toISOString();
  const { error: legErr } = await admin
    .schema("palaro")
    .from("vehicle_trip_legs")
    .update({
      arrived_at: arrivedAt,
      arrived_by: auth.profile.id,
      notes: data.arrival_notes
        ? [leg.notes, data.arrival_notes].filter(Boolean).join("\n")
        : leg.notes,
    })
    .eq("id", leg.id);
  if (legErr) return fail(legErr.message);

  let dropoffCount = 0;
  for (const d of data.dropoffs) {
    if (d.count <= 0) continue;
    const m = byId.get(d.manifest_id);
    if (!m) continue;

    const { error: dropErr } = await admin
      .schema("palaro")
      .from("vehicle_trip_dropoffs")
      .insert({
        leg_id: leg.id,
        manifest_id: m.id,
        count: d.count,
        recorded_by: auth.profile.id,
      });
    if (dropErr) return fail(dropErr.message);

    const { error: mfErr } = await admin
      .schema("palaro")
      .from("vehicle_trip_manifest")
      .update({ dropped_off: m.dropped_off + d.count })
      .eq("id", m.id);
    if (mfErr) return fail(mfErr.message);

    dropoffCount += 1;
  }

  await recordAudit({
    action: "update",
    entity_type: "vehicle_trip_leg",
    entity_id: leg.id,
    changes: {
      dispatch_id: data.dispatch_id,
      arrived_at: arrivedAt,
      dropoffs: dropoffCount,
    },
    user_id: auth.profile.id,
  });

  revalidatePath(VEHICLES_PATH);
  return ok({ dropoff_count: dropoffCount });
}

export async function closeTrip(
  input: unknown,
): Promise<ActionResult<void>> {
  const auth = await requireDispatcher();
  if (!auth.ok) return fail(auth.error);

  const parsed = closeTripSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  const { dispatch_id, force, reason } = parsed.data;

  const admin = createAdminClient();
  const { data: dispatch } = await admin
    .schema("palaro")
    .from("vehicle_dispatches")
    .select("*")
    .eq("id", dispatch_id)
    .maybeSingle();
  if (!dispatch) return fail("Trip not found.");
  if (dispatch.status === "completed" || dispatch.status === "cancelled") {
    return fail("Trip is already closed.");
  }

  const { data: openLeg } = await admin
    .schema("palaro")
    .from("vehicle_trip_legs")
    .select("id")
    .eq("dispatch_id", dispatch_id)
    .is("arrived_at", null)
    .maybeSingle();
  if (openLeg) {
    return fail("Record arrival on the current leg before closing the trip.");
  }

  const { data: manifest } = await admin
    .schema("palaro")
    .from("vehicle_trip_manifest")
    .select("id, team_name, total_passengers, dropped_off")
    .eq("dispatch_id", dispatch_id);

  const stillOnBoard = (manifest ?? []).filter(
    (m) => m.total_passengers - m.dropped_off > 0,
  );
  if (stillOnBoard.length > 0 && !force) {
    const summary = stillOnBoard
      .map((m) => `${m.team_name} ${m.total_passengers - m.dropped_off}`)
      .join(", ");
    return fail(
      `Passengers still on board: ${summary}. Drop them off or force-close with a reason.`,
    );
  }
  if (stillOnBoard.length > 0 && force) {
    // Force-close path requires vehicle.manage as well.
    const profile = await getCurrentProfile();
    if (!profile || !hasPermission(profile, "vehicle.manage")) {
      return fail("Force-close requires vehicle.manage permission.");
    }
  }

  const { error } = await admin
    .schema("palaro")
    .from("vehicle_dispatches")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      closed_by: auth.profile.id,
      force_closed_reason:
        stillOnBoard.length > 0 ? reason || "Force closed" : null,
    })
    .eq("id", dispatch_id);
  if (error) return fail(error.message);

  await recordAudit({
    action: "update",
    entity_type: "vehicle_trip",
    entity_id: dispatch_id,
    changes: {
      status: "completed",
      force_closed: stillOnBoard.length > 0,
      remaining_groups: stillOnBoard.length,
      reason: stillOnBoard.length > 0 ? reason : null,
    },
    user_id: auth.profile.id,
  });

  revalidatePath(VEHICLES_PATH);
  return ok();
}

export async function updateDispatchStatus(
  input: unknown,
): Promise<ActionResult<void>> {
  const auth = await requireDispatcher();
  if (!auth.ok) return fail(auth.error);

  const parsed = updateDispatchStatusSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  const { id, status } = parsed.data;

  const admin = createAdminClient();
  const patch: Partial<
    Database["palaro"]["Tables"]["vehicle_dispatches"]["Update"]
  > = { status };
  if (status === "completed") patch.completed_at = new Date().toISOString();

  const { error } = await admin
    .schema("palaro")
    .from("vehicle_dispatches")
    .update(patch)
    .eq("id", id);
  if (error) return fail(error.message);

  await recordAudit({
    action: "update",
    entity_type: "vehicle_dispatch",
    entity_id: id,
    changes: { status },
    user_id: auth.profile.id,
  });

  revalidatePath(VEHICLES_PATH);
  return ok();
}

// =============================================================================
// TRIP DETAIL + REPORTS
// =============================================================================

export type TripDetail = {
  dispatch: VehicleDispatch;
  vehicle: Pick<Vehicle, "id" | "vehicle_code" | "plate_number" | "vehicle_type"> | null;
  legs: VehicleTripLeg[];
  manifest: VehicleTripManifest[];
  dropoffs: VehicleTripDropoff[];
};

export async function getTripDetail(
  dispatchId: string,
): Promise<ActionResult<TripDetail | null>> {
  const auth = await requireVehicleScanner();
  if (!auth.ok) return fail(auth.error);

  if (!/^[0-9a-fA-F-]{36}$/.test(dispatchId)) return fail("Invalid trip id.");

  const admin = createAdminClient();
  const { data: dispatch } = await admin
    .schema("palaro")
    .from("vehicle_dispatches")
    .select("*")
    .eq("id", dispatchId)
    .maybeSingle();
  if (!dispatch) return ok(null);

  const [vehicleRes, legsRes, manifestRes] = await Promise.all([
    admin
      .schema("palaro")
      .from("vehicles")
      .select("id, vehicle_code, plate_number, vehicle_type")
      .eq("id", dispatch.vehicle_id)
      .maybeSingle(),
    admin
      .schema("palaro")
      .from("vehicle_trip_legs")
      .select("*")
      .eq("dispatch_id", dispatchId)
      .order("leg_order", { ascending: true }),
    admin
      .schema("palaro")
      .from("vehicle_trip_manifest")
      .select("*")
      .eq("dispatch_id", dispatchId)
      .order("created_at", { ascending: true }),
  ]);

  const legs = legsRes.data ?? [];
  let dropoffs: VehicleTripDropoff[] = [];
  if (legs.length > 0) {
    const { data } = await admin
      .schema("palaro")
      .from("vehicle_trip_dropoffs")
      .select("*")
      .in(
        "leg_id",
        legs.map((l) => l.id),
      )
      .order("recorded_at", { ascending: true });
    dropoffs = data ?? [];
  }

  return ok({
    dispatch,
    vehicle: vehicleRes.data ?? null,
    legs,
    manifest: manifestRes.data ?? [],
    dropoffs,
  });
}

export type BusRouteReportRow = {
  dispatch_id: string;
  vehicle_id: string;
  vehicle_code: string;
  status: VehicleDispatch["status"];
  leg_id: string;
  leg_order: number;
  from_site_id: string | null;
  from_label: string | null;
  to_site_id: string | null;
  to_label: string | null;
  departed_at: string;
  arrived_at: string | null;
  passenger_count: number;
};

export async function getBusRouteReport(filters: {
  vehicle_id?: string;
  since?: string;
  until?: string;
  limit?: number;
}): Promise<ActionResult<BusRouteReportRow[]>> {
  const auth = await requireVehicleScanner();
  if (!auth.ok) return fail(auth.error);

  const admin = createAdminClient();
  const limit = Math.min(filters.limit ?? 200, 500);

  let q = admin
    .schema("palaro")
    .from("vehicle_dispatches")
    .select("id, vehicle_id, status, dispatched_at")
    .order("dispatched_at", { ascending: false })
    .limit(limit);
  if (filters.vehicle_id) q = q.eq("vehicle_id", filters.vehicle_id);
  if (filters.since) q = q.gte("dispatched_at", filters.since);
  if (filters.until) q = q.lte("dispatched_at", filters.until);
  const { data: dispatches, error } = await q;
  if (error) return fail(error.message);

  const dispatchIds = (dispatches ?? []).map((d) => d.id);
  if (dispatchIds.length === 0) return ok([]);

  const [legsRes, vehiclesRes, manifestRes] = await Promise.all([
    admin
      .schema("palaro")
      .from("vehicle_trip_legs")
      .select("*")
      .in("dispatch_id", dispatchIds)
      .order("departed_at", { ascending: true }),
    admin
      .schema("palaro")
      .from("vehicles")
      .select("id, vehicle_code")
      .in("id", (dispatches ?? []).map((d) => d.vehicle_id)),
    admin
      .schema("palaro")
      .from("vehicle_trip_manifest")
      .select("dispatch_id, total_passengers")
      .in("dispatch_id", dispatchIds),
  ]);

  const vehicleCode = new Map(
    (vehiclesRes.data ?? []).map((v) => [v.id, v.vehicle_code]),
  );
  const paxByDispatch = new Map<string, number>();
  for (const m of manifestRes.data ?? []) {
    paxByDispatch.set(
      m.dispatch_id,
      (paxByDispatch.get(m.dispatch_id) ?? 0) + m.total_passengers,
    );
  }
  const dispatchById = new Map((dispatches ?? []).map((d) => [d.id, d]));

  const rows: BusRouteReportRow[] = [];
  for (const leg of legsRes.data ?? []) {
    const d = dispatchById.get(leg.dispatch_id);
    if (!d) continue;
    rows.push({
      dispatch_id: d.id,
      vehicle_id: d.vehicle_id,
      vehicle_code: vehicleCode.get(d.vehicle_id) ?? "—",
      status: d.status,
      leg_id: leg.id,
      leg_order: leg.leg_order,
      from_site_id: leg.from_site_id,
      from_label: leg.from_label,
      to_site_id: leg.to_site_id,
      to_label: leg.to_label,
      departed_at: leg.departed_at,
      arrived_at: leg.arrived_at,
      passenger_count: paxByDispatch.get(d.id) ?? 0,
    });
  }

  return ok(rows);
}

export type PassengerReportRow = {
  manifest_id: string;
  dispatch_id: string;
  vehicle_id: string;
  vehicle_code: string;
  delegation_id: string | null;
  team_name: string;
  total_passengers: number;
  dropped_off: number;
  remaining: number;
  boarded_at_leg_id: string | null;
  trip_status: VehicleDispatch["status"];
  dispatched_at: string;
  dropoff_events: Array<{
    leg_id: string;
    leg_order: number;
    count: number;
    recorded_at: string;
  }>;
};

export async function getPassengerReport(filters: {
  delegation_id?: string;
  dispatch_id?: string;
  since?: string;
  until?: string;
  limit?: number;
}): Promise<ActionResult<PassengerReportRow[]>> {
  const auth = await requireVehicleScanner();
  if (!auth.ok) return fail(auth.error);

  const admin = createAdminClient();
  const limit = Math.min(filters.limit ?? 200, 500);

  let q = admin
    .schema("palaro")
    .from("vehicle_trip_manifest")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (filters.delegation_id) q = q.eq("delegation_id", filters.delegation_id);
  if (filters.dispatch_id) q = q.eq("dispatch_id", filters.dispatch_id);
  const { data: manifest, error } = await q;
  if (error) return fail(error.message);
  if (!manifest || manifest.length === 0) return ok([]);

  const dispatchIds = Array.from(new Set(manifest.map((m) => m.dispatch_id)));
  const [dispatchesRes, legsRes, dropoffsRes] = await Promise.all([
    admin
      .schema("palaro")
      .from("vehicle_dispatches")
      .select("id, vehicle_id, status, dispatched_at")
      .in("id", dispatchIds),
    admin
      .schema("palaro")
      .from("vehicle_trip_legs")
      .select("id, dispatch_id, leg_order")
      .in("dispatch_id", dispatchIds),
    admin
      .schema("palaro")
      .from("vehicle_trip_dropoffs")
      .select("*")
      .in(
        "manifest_id",
        manifest.map((m) => m.id),
      )
      .order("recorded_at", { ascending: true }),
  ]);

  let dispatches = dispatchesRes.data ?? [];
  if (filters.since) {
    dispatches = dispatches.filter((d) => d.dispatched_at >= filters.since!);
  }
  if (filters.until) {
    dispatches = dispatches.filter((d) => d.dispatched_at <= filters.until!);
  }
  const dispatchById = new Map(dispatches.map((d) => [d.id, d]));

  const legOrderById = new Map(
    (legsRes.data ?? []).map((l) => [l.id, l.leg_order]),
  );

  const vehicleIds = Array.from(
    new Set(dispatches.map((d) => d.vehicle_id)),
  );
  const { data: vehicles } = await admin
    .schema("palaro")
    .from("vehicles")
    .select("id, vehicle_code")
    .in("id", vehicleIds);
  const vehicleCode = new Map(
    (vehicles ?? []).map((v) => [v.id, v.vehicle_code]),
  );

  const dropoffsByManifest = new Map<string, VehicleTripDropoff[]>();
  for (const d of dropoffsRes.data ?? []) {
    const list = dropoffsByManifest.get(d.manifest_id) ?? [];
    list.push(d);
    dropoffsByManifest.set(d.manifest_id, list);
  }

  const rows: PassengerReportRow[] = [];
  for (const m of manifest) {
    const d = dispatchById.get(m.dispatch_id);
    if (!d) continue; // outside date range
    rows.push({
      manifest_id: m.id,
      dispatch_id: m.dispatch_id,
      vehicle_id: d.vehicle_id,
      vehicle_code: vehicleCode.get(d.vehicle_id) ?? "—",
      delegation_id: m.delegation_id,
      team_name: m.team_name,
      total_passengers: m.total_passengers,
      dropped_off: m.dropped_off,
      remaining: m.total_passengers - m.dropped_off,
      boarded_at_leg_id: m.boarded_at_leg_id,
      trip_status: d.status,
      dispatched_at: d.dispatched_at,
      dropoff_events: (dropoffsByManifest.get(m.id) ?? []).map((ev) => ({
        leg_id: ev.leg_id,
        leg_order: legOrderById.get(ev.leg_id) ?? 0,
        count: ev.count,
        recorded_at: ev.recorded_at,
      })),
    });
  }

  return ok(rows);
}

// =============================================================================
// FUEL LOGS
// =============================================================================

export async function getFuelLogs(
  limit = 200,
): Promise<ActionResult<VehicleFuelLog[]>> {
  const auth = await requireVehicleScanner();
  if (!auth.ok) return fail(auth.error);

  const admin = createAdminClient();
  const { data, error } = await admin
    .schema("palaro")
    .from("vehicle_fuel_logs")
    .select("*")
    .order("refilled_at", { ascending: false })
    .limit(limit);
  if (error) return fail(error.message);
  return ok(data ?? []);
}

export async function createFuelLog(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const auth = await requireFuelLogger();
  if (!auth.ok) return fail(auth.error);

  const parsed = createFuelLogSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  const data = parsed.data;

  const admin = createAdminClient();
  const { data: inserted, error } = await admin
    .schema("palaro")
    .from("vehicle_fuel_logs")
    .insert({
      vehicle_id: data.vehicle_id,
      refilled_at: new Date(data.refilled_at).toISOString(),
      liters: data.liters,
      cost_php: data.cost_php ?? null,
      odometer_km: data.odometer_km ?? null,
      station: data.station || null,
      logged_by: auth.profile.id,
      notes: data.notes || null,
    })
    .select("id")
    .single();
  if (error) return fail(error.message);

  await recordAudit({
    action: "create",
    entity_type: "vehicle_fuel_log",
    entity_id: inserted.id,
    changes: {
      vehicle_id: data.vehicle_id,
      liters: data.liters,
      cost_php: data.cost_php ?? null,
    },
    user_id: auth.profile.id,
  });

  revalidatePath(VEHICLES_PATH);
  return ok({ id: inserted.id });
}

export async function deleteFuelLog(
  input: unknown,
): Promise<ActionResult<void>> {
  const auth = await requireFuelLogger();
  if (!auth.ok) return fail(auth.error);

  const parsed = deleteFuelLogSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }

  const admin = createAdminClient();
  const { error } = await admin
    .schema("palaro")
    .from("vehicle_fuel_logs")
    .delete()
    .eq("id", parsed.data.id);
  if (error) return fail(error.message);

  await recordAudit({
    action: "delete",
    entity_type: "vehicle_fuel_log",
    entity_id: parsed.data.id,
    user_id: auth.profile.id,
  });

  revalidatePath(VEHICLES_PATH);
  return ok();
}

// =============================================================================
// DAY SUMMARY
// =============================================================================

export type TransportSummary = {
  total_dispatches_today: number;
  total_pax_today: number;
  total_fuel_liters_today: number;
  per_vehicle: Array<{
    vehicle_id: string;
    vehicle_code: string;
    trip_count: number;
    fuel_liters: number;
  }>;
};

// Day-bucketed summary for the Transportation page header / Reports tab.
// Bucketing is done in JS to avoid hand-rolled date_trunc per timezone.
export async function getTransportSummary(): Promise<
  ActionResult<TransportSummary>
> {
  const auth = await requireVehicleScanner();
  if (!auth.ok) return fail(auth.error);

  const admin = createAdminClient();
  const since = new Date();
  since.setHours(0, 0, 0, 0);
  const sinceIso = since.toISOString();

  const [vehiclesRes, dispatchesRes, fuelRes] = await Promise.all([
    admin
      .schema("palaro")
      .from("vehicles")
      .select("id, vehicle_code")
      .eq("is_active", true),
    admin
      .schema("palaro")
      .from("vehicle_dispatches")
      .select("id, vehicle_id, dispatched_at")
      .gte("dispatched_at", sinceIso),
    admin
      .schema("palaro")
      .from("vehicle_fuel_logs")
      .select("vehicle_id, liters, refilled_at")
      .gte("refilled_at", sinceIso),
  ]);
  if (vehiclesRes.error) return fail(vehiclesRes.error.message);
  if (dispatchesRes.error) return fail(dispatchesRes.error.message);
  if (fuelRes.error) return fail(fuelRes.error.message);

  const vehicles = vehiclesRes.data ?? [];
  const dispatches = dispatchesRes.data ?? [];
  const fuel = fuelRes.data ?? [];

  // Total passengers today = sum of manifest.total_passengers across trips
  // that started today.
  const dispatchIds = dispatches.map((d) => d.id);
  let totalPax = 0;
  if (dispatchIds.length > 0) {
    const { data: manifest } = await admin
      .schema("palaro")
      .from("vehicle_trip_manifest")
      .select("total_passengers")
      .in("dispatch_id", dispatchIds);
    totalPax = (manifest ?? []).reduce(
      (sum, m) => sum + (m.total_passengers ?? 0),
      0,
    );
  }

  const tripsByVehicle = new Map<string, number>();
  for (const d of dispatches) {
    tripsByVehicle.set(
      d.vehicle_id,
      (tripsByVehicle.get(d.vehicle_id) ?? 0) + 1,
    );
  }

  const fuelByVehicle = new Map<string, number>();
  for (const f of fuel) {
    fuelByVehicle.set(
      f.vehicle_id,
      (fuelByVehicle.get(f.vehicle_id) ?? 0) + Number(f.liters ?? 0),
    );
  }

  const totalFuel = fuel.reduce(
    (sum, f) => sum + Number(f.liters ?? 0),
    0,
  );

  return ok({
    total_dispatches_today: dispatches.length,
    total_pax_today: totalPax,
    total_fuel_liters_today: Math.round(totalFuel * 100) / 100,
    per_vehicle: vehicles.map((v) => ({
      vehicle_id: v.id,
      vehicle_code: v.vehicle_code,
      trip_count: tripsByVehicle.get(v.id) ?? 0,
      fuel_liters:
        Math.round((fuelByVehicle.get(v.id) ?? 0) * 100) / 100,
    })),
  });
}

export type MissingAthleteRow = {
  dispatch_id: string;
  vehicle_id: string;
  manifest_id: string;
  delegation_id: string | null;
  team_name: string;
  total_passengers: number;
  remaining: number;
  trip_status: VehicleDispatch["status"];
  origin_site_id: string | null;
  destination_site_id: string | null;
  dispatched_at: string;
  force_closed_reason: string | null;
};

// Missing-athlete report: any manifest row still carrying passengers after
// its trip closed (force-closed scenario), or any row where the running
// trip has been in_transit for an extended period with passengers still on
// board. Surfaces the "boarded N, only M arrived" discrepancies the spec
// calls out.
export async function getMissingAthleteReport(
  limit = 100,
): Promise<ActionResult<MissingAthleteRow[]>> {
  const auth = await requireVehicleScanner();
  if (!auth.ok) return fail(auth.error);

  const admin = createAdminClient();
  const { data: dispatches, error } = await admin
    .schema("palaro")
    .from("vehicle_dispatches")
    .select(
      "id, vehicle_id, origin_site_id, destination_site_id, dispatched_at, status, force_closed_reason",
    )
    .order("dispatched_at", { ascending: false })
    .limit(limit * 4);
  if (error) return fail(error.message);

  const ids = (dispatches ?? []).map((d) => d.id);
  if (ids.length === 0) return ok([]);

  const { data: manifest, error: mfErr } = await admin
    .schema("palaro")
    .from("vehicle_trip_manifest")
    .select("*")
    .in("dispatch_id", ids);
  if (mfErr) return fail(mfErr.message);

  const dispatchById = new Map((dispatches ?? []).map((d) => [d.id, d]));
  const rows: MissingAthleteRow[] = [];
  for (const m of manifest ?? []) {
    const remaining = m.total_passengers - m.dropped_off;
    if (remaining <= 0) continue;
    const d = dispatchById.get(m.dispatch_id);
    if (!d) continue;
    // Only flag closed trips (force-closed with remaining) — open trips are
    // still in motion and not yet a discrepancy.
    if (d.status !== "completed") continue;
    rows.push({
      dispatch_id: d.id,
      vehicle_id: d.vehicle_id,
      manifest_id: m.id,
      delegation_id: m.delegation_id,
      team_name: m.team_name,
      total_passengers: m.total_passengers,
      remaining,
      trip_status: d.status,
      origin_site_id: d.origin_site_id,
      destination_site_id: d.destination_site_id,
      dispatched_at: d.dispatched_at,
      force_closed_reason: d.force_closed_reason,
    });
    if (rows.length >= limit) break;
  }

  return ok(rows);
}
