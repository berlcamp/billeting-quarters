"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth/session";
import { hasPermission, type Permission } from "@/lib/permissions";
import {
  createDispatchSchema,
  createFuelLogSchema,
  createRouteSchema,
  createVehicleSchema,
  deleteFuelLogSchema,
  deleteRouteSchema,
  deleteVehicleSchema,
  logVehicleSchema,
  scanVehicleSchema,
  updateDispatchStatusSchema,
  updateVehicleSchema,
} from "@/lib/schemas/vehicles";
import { recordAudit } from "./audit";
import { fail, ok, type ActionResult } from "./types";
import type { Database } from "@/types/database";

type Vehicle = Database["palaro"]["Tables"]["vehicles"]["Row"];
type VehicleLog = Database["palaro"]["Tables"]["vehicle_logs"]["Row"];
type VehicleRoute = Database["palaro"]["Tables"]["vehicle_routes"]["Row"];
type VehicleRouteStop =
  Database["palaro"]["Tables"]["vehicle_route_stops"]["Row"];
type VehicleDispatch =
  Database["palaro"]["Tables"]["vehicle_dispatches"]["Row"];
type VehicleFuelLog =
  Database["palaro"]["Tables"]["vehicle_fuel_logs"]["Row"];
type Direction = Database["palaro"]["Enums"]["vehicle_log_direction"];

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
// VEHICLE LOGS (per-venue arrival / departure scans)
// =============================================================================

export async function getVehicleLogs(
  limit = 200,
): Promise<ActionResult<VehicleLog[]>> {
  const auth = await requireVehicleScanner();
  if (!auth.ok) return fail(auth.error);

  const admin = createAdminClient();
  const { data, error } = await admin
    .schema("palaro")
    .from("vehicle_logs")
    .select("*")
    .order("scanned_at", { ascending: false })
    .limit(limit);
  if (error) return fail(error.message);
  return ok(data ?? []);
}

// Move dispatch.status forward when its first/last scans land.
async function syncDispatchStatusForLog(
  admin: ReturnType<typeof createAdminClient>,
  dispatchId: string,
  direction: Direction,
  siteId: string,
) {
  const { data: dispatch } = await admin
    .schema("palaro")
    .from("vehicle_dispatches")
    .select("id, status, destination_site_id")
    .eq("id", dispatchId)
    .maybeSingle();
  if (!dispatch || dispatch.status === "completed" || dispatch.status === "cancelled") {
    return;
  }

  // Departure scan at the destination = trip done.
  if (
    direction === "out" &&
    dispatch.destination_site_id &&
    siteId === dispatch.destination_site_id
  ) {
    await admin
      .schema("palaro")
      .from("vehicle_dispatches")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", dispatchId);
    return;
  }

  // First arrival/departure flips scheduled → in_transit.
  if (dispatch.status === "scheduled") {
    await admin
      .schema("palaro")
      .from("vehicle_dispatches")
      .update({ status: "in_transit" })
      .eq("id", dispatchId);
  }
}

export async function logVehicleMovement(
  input: unknown,
): Promise<ActionResult<{ id: string; direction: Direction }>> {
  const auth = await requireVehicleScanner();
  if (!auth.ok) return fail(auth.error);

  const parsed = logVehicleSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  const data = parsed.data;

  const admin = createAdminClient();
  const { data: vehicle } = await admin
    .schema("palaro")
    .from("vehicles")
    .select("id, vehicle_code, is_active")
    .eq("id", data.vehicle_id)
    .single();
  if (!vehicle) return fail("Vehicle not found.");
  if (!vehicle.is_active) return fail("Vehicle is decommissioned.");

  const { data: inserted, error } = await admin
    .schema("palaro")
    .from("vehicle_logs")
    .insert({
      vehicle_id: data.vehicle_id,
      site_id: data.site_id,
      direction: data.direction,
      scanned_by: auth.profile.id,
      passenger_count: data.passenger_count ?? null,
      notes: data.notes || null,
      dispatch_id: data.dispatch_id || null,
      delegation_id: data.delegation_id || null,
      sport: data.sport || null,
      team_count: data.team_count ?? null,
      from_site_id: data.from_site_id || null,
      to_site_id: data.to_site_id || null,
    })
    .select("id, direction")
    .single();
  if (error) return fail(error.message);

  if (data.dispatch_id) {
    await syncDispatchStatusForLog(
      admin,
      data.dispatch_id,
      data.direction,
      data.site_id,
    );
  }

  await recordAudit({
    action: "create",
    entity_type: "vehicle_log",
    entity_id: inserted.id,
    changes: {
      vehicle_id: data.vehicle_id,
      site_id: data.site_id,
      direction: data.direction,
      dispatch_id: data.dispatch_id || null,
      via: "manual",
    },
    user_id: auth.profile.id,
  });

  revalidatePath(VEHICLES_PATH);
  return ok({ id: inserted.id, direction: inserted.direction });
}

// QR scan path:
//  - Scanned value can be a vehicle UUID, a vehicle_code, or {"v":1,"vid":"<uuid>"}
//  - Direction auto-decided from the most recent log: last 'in' → 'out', else 'in'
//  - Dispatcher can attach the active dispatch + per-scan snapshot.
export async function scanVehicle(
  input: unknown,
): Promise<
  ActionResult<{
    id: string;
    direction: Direction;
    vehicle_id: string;
    vehicle_code: string;
  }>
> {
  const auth = await requireVehicleScanner();
  if (!auth.ok) return fail(auth.error);

  const parsed = scanVehicleSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  const data = parsed.data;

  const admin = createAdminClient();
  const trimmed = data.scanned_value.trim();

  // Try (1) JSON envelope, (2) UUID, (3) vehicle_code lookup.
  let vehicle: Pick<Vehicle, "id" | "vehicle_code" | "is_active"> | null = null;

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
    if (matched) vehicle = matched;
  }
  if (!vehicle) {
    const code = trimmed.toUpperCase();
    const { data: matched } = await admin
      .schema("palaro")
      .from("vehicles")
      .select("id, vehicle_code, is_active")
      .eq("vehicle_code", code)
      .maybeSingle();
    if (matched) vehicle = matched;
  }

  if (!vehicle) return fail("Scan value did not match any vehicle.");
  if (!vehicle.is_active) return fail("Vehicle is decommissioned.");

  // Auto-pick dispatch if none provided: most recent open dispatch for this vehicle.
  let dispatchId = data.dispatch_id || null;
  let dispatchSnapshot: Pick<
    VehicleDispatch,
    "delegation_id" | "sport" | "team_count" | "expected_pax" | "origin_site_id" | "destination_site_id"
  > | null = null;
  if (!dispatchId) {
    const { data: openDispatch } = await admin
      .schema("palaro")
      .from("vehicle_dispatches")
      .select(
        "id, delegation_id, sport, team_count, expected_pax, origin_site_id, destination_site_id",
      )
      .eq("vehicle_id", vehicle.id)
      .in("status", ["scheduled", "in_transit"])
      .order("dispatched_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (openDispatch) {
      dispatchId = openDispatch.id;
      dispatchSnapshot = openDispatch;
    }
  } else {
    const { data: provided } = await admin
      .schema("palaro")
      .from("vehicle_dispatches")
      .select(
        "delegation_id, sport, team_count, expected_pax, origin_site_id, destination_site_id",
      )
      .eq("id", dispatchId)
      .maybeSingle();
    if (provided) dispatchSnapshot = provided;
  }

  const { data: lastLog } = await admin
    .schema("palaro")
    .from("vehicle_logs")
    .select("direction, scanned_at")
    .eq("vehicle_id", vehicle.id)
    .order("scanned_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextDirection: Direction = lastLog?.direction === "in" ? "out" : "in";

  const { data: inserted, error } = await admin
    .schema("palaro")
    .from("vehicle_logs")
    .insert({
      vehicle_id: vehicle.id,
      site_id: data.site_id,
      direction: nextDirection,
      scanned_by: auth.profile.id,
      passenger_count: data.passenger_count ?? null,
      notes: data.notes || null,
      dispatch_id: dispatchId,
      // Per-scan fields fall back to the dispatch snapshot when the dispatcher
      // didn't override them, so every scan carries the spec's required context.
      delegation_id:
        data.delegation_id ?? dispatchSnapshot?.delegation_id ?? null,
      sport: data.sport ?? dispatchSnapshot?.sport ?? null,
      team_count: data.team_count ?? dispatchSnapshot?.team_count ?? null,
      from_site_id:
        data.from_site_id ?? dispatchSnapshot?.origin_site_id ?? null,
      to_site_id:
        data.to_site_id ?? dispatchSnapshot?.destination_site_id ?? null,
    })
    .select("id, direction")
    .single();
  if (error) return fail(error.message);

  if (dispatchId) {
    await syncDispatchStatusForLog(admin, dispatchId, nextDirection, data.site_id);
  }

  await recordAudit({
    action: "create",
    entity_type: "vehicle_log",
    entity_id: inserted.id,
    changes: {
      vehicle_id: vehicle.id,
      site_id: data.site_id,
      direction: nextDirection,
      dispatch_id: dispatchId,
      via: "qr_scan",
    },
    user_id: auth.profile.id,
  });

  revalidatePath(VEHICLES_PATH);
  return ok({
    id: inserted.id,
    direction: inserted.direction,
    vehicle_id: vehicle.id,
    vehicle_code: vehicle.vehicle_code,
  });
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
// DISPATCHES
// =============================================================================

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

export async function createDispatch(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const auth = await requireDispatcher();
  if (!auth.ok) return fail(auth.error);

  const parsed = createDispatchSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  const data = parsed.data;

  const admin = createAdminClient();
  const { data: vehicle } = await admin
    .schema("palaro")
    .from("vehicles")
    .select("id, is_active")
    .eq("id", data.vehicle_id)
    .single();
  if (!vehicle) return fail("Vehicle not found.");
  if (!vehicle.is_active) return fail("Vehicle is decommissioned.");

  const { data: inserted, error } = await admin
    .schema("palaro")
    .from("vehicle_dispatches")
    .insert({
      vehicle_id: data.vehicle_id,
      route_id: data.route_id || null,
      delegation_id: data.delegation_id,
      sport: data.sport,
      team_count: data.team_count,
      expected_pax: data.expected_pax,
      origin_site_id: data.origin_site_id,
      destination_site_id: data.destination_site_id,
      scheduled_at: data.scheduled_at
        ? new Date(data.scheduled_at).toISOString()
        : null,
      dispatched_by: auth.profile.id,
      status: "scheduled",
      notes: data.notes || null,
    })
    .select("id")
    .single();
  if (error) return fail(error.message);

  await recordAudit({
    action: "create",
    entity_type: "vehicle_dispatch",
    entity_id: inserted.id,
    changes: {
      vehicle_id: data.vehicle_id,
      delegation_id: data.delegation_id,
      sport: data.sport,
      expected_pax: data.expected_pax,
    },
    user_id: auth.profile.id,
  });

  revalidatePath(VEHICLES_PATH);
  return ok({ id: inserted.id });
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
// REPORTS
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

  const [vehiclesRes, dispatchesRes, logsRes, fuelRes] = await Promise.all([
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
      .from("vehicle_logs")
      .select("vehicle_id, passenger_count, scanned_at, direction")
      .gte("scanned_at", sinceIso),
    admin
      .schema("palaro")
      .from("vehicle_fuel_logs")
      .select("vehicle_id, liters, refilled_at")
      .gte("refilled_at", sinceIso),
  ]);
  if (vehiclesRes.error) return fail(vehiclesRes.error.message);
  if (dispatchesRes.error) return fail(dispatchesRes.error.message);
  if (logsRes.error) return fail(logsRes.error.message);
  if (fuelRes.error) return fail(fuelRes.error.message);

  const vehicles = vehiclesRes.data ?? [];
  const dispatches = dispatchesRes.data ?? [];
  const logs = logsRes.data ?? [];
  const fuel = fuelRes.data ?? [];

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

  // Pax served = arrivals only, since each leg is logged twice (out at origin,
  // in at destination). Counting arrivals avoids double-counting per trip.
  const totalPax = logs
    .filter((l) => l.direction === "in")
    .reduce((sum, l) => sum + (l.passenger_count ?? 0), 0);

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
  delegation_id: string | null;
  sport: string | null;
  expected_pax: number | null;
  arrived_pax: number | null;
  diff: number;
  origin_site_id: string | null;
  destination_site_id: string | null;
  dispatched_at: string;
};

// Missing-athlete report: spec example —
//   "Taekwondo team boarded 10 at BQ, only 9 arrived at PV." We compare the
//   dispatch's expected_pax against the highest passenger_count recorded on
//   an arrival ('in') scan for that dispatch, and flag any negative diff.
//
// Returns rows with diff > 0 (missing) or diff < 0 (extra) so dispatchers
// can investigate either direction.
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
      "id, vehicle_id, delegation_id, sport, expected_pax, origin_site_id, destination_site_id, dispatched_at, status",
    )
    .in("status", ["in_transit", "completed"])
    .not("expected_pax", "is", null)
    .order("dispatched_at", { ascending: false })
    .limit(limit);
  if (error) return fail(error.message);

  const ids = (dispatches ?? []).map((d) => d.id);
  if (ids.length === 0) return ok([]);

  const { data: logs, error: logsErr } = await admin
    .schema("palaro")
    .from("vehicle_logs")
    .select("dispatch_id, direction, passenger_count, site_id")
    .in("dispatch_id", ids)
    .eq("direction", "in");
  if (logsErr) return fail(logsErr.message);

  const arrivedByDispatch = new Map<string, number>();
  for (const log of logs ?? []) {
    if (!log.dispatch_id || log.passenger_count == null) continue;
    const prev = arrivedByDispatch.get(log.dispatch_id);
    if (prev == null || log.passenger_count > prev) {
      arrivedByDispatch.set(log.dispatch_id, log.passenger_count);
    }
  }

  const rows: MissingAthleteRow[] = [];
  for (const d of dispatches ?? []) {
    const arrived = arrivedByDispatch.get(d.id) ?? null;
    if (d.expected_pax == null || arrived == null) continue;
    const diff = d.expected_pax - arrived;
    if (diff === 0) continue;
    rows.push({
      dispatch_id: d.id,
      vehicle_id: d.vehicle_id,
      delegation_id: d.delegation_id,
      sport: d.sport,
      expected_pax: d.expected_pax,
      arrived_pax: arrived,
      diff,
      origin_site_id: d.origin_site_id,
      destination_site_id: d.destination_site_id,
      dispatched_at: d.dispatched_at,
    });
  }

  return ok(rows);
}
