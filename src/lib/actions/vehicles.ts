"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions";
import {
  createRouteSchema,
  createVehicleSchema,
  deleteRouteSchema,
  deleteVehicleSchema,
  logVehicleSchema,
  scanVehicleSchema,
  updateVehicleSchema,
} from "@/lib/schemas/vehicles";
import { recordAudit } from "./audit";
import { fail, ok, type ActionResult } from "./types";
import type { Database } from "@/types/database";

type Vehicle = Database["palaro"]["Tables"]["vehicles"]["Row"];
type VehicleLog = Database["palaro"]["Tables"]["vehicle_logs"]["Row"];
type VehicleRoute = Database["palaro"]["Tables"]["vehicle_routes"]["Row"];
type Direction = Database["palaro"]["Enums"]["vehicle_log_direction"];

const VEHICLES_PATH = "/dashboard/transportation";

async function requireVehicleManager() {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false as const, error: "Not authenticated." };
  if (!hasPermission(profile, "vehicle.manage")) {
    return {
      ok: false as const,
      error: "You don't have permission to manage vehicles.",
    };
  }
  return { ok: true as const, profile };
}

async function requireVehicleScanner() {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false as const, error: "Not authenticated." };
  if (
    !hasPermission(profile, "vehicle.scan") &&
    !hasPermission(profile, "vehicle.manage")
  ) {
    return {
      ok: false as const,
      error: "You don't have permission to scan vehicles.",
    };
  }
  return { ok: true as const, profile };
}

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
// VEHICLE LOGS (in/out scanning)
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
    })
    .select("id, direction")
    .single();
  if (error) return fail(error.message);

  await recordAudit({
    action: "create",
    entity_type: "vehicle_log",
    entity_id: inserted.id,
    changes: {
      vehicle_id: data.vehicle_id,
      site_id: data.site_id,
      direction: data.direction,
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
  const { scanned_value, site_id, passenger_count, notes } = parsed.data;

  const admin = createAdminClient();
  const trimmed = scanned_value.trim();

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
    const { data } = await admin
      .schema("palaro")
      .from("vehicles")
      .select("id, vehicle_code, is_active")
      .eq("id", candidateUuid)
      .maybeSingle();
    if (data) vehicle = data;
  }
  if (!vehicle) {
    const code = trimmed.toUpperCase();
    const { data } = await admin
      .schema("palaro")
      .from("vehicles")
      .select("id, vehicle_code, is_active")
      .eq("vehicle_code", code)
      .maybeSingle();
    if (data) vehicle = data;
  }

  if (!vehicle) return fail("Scan value did not match any vehicle.");
  if (!vehicle.is_active) return fail("Vehicle is decommissioned.");

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
      site_id,
      direction: nextDirection,
      scanned_by: auth.profile.id,
      passenger_count: passenger_count ?? null,
      notes: notes || null,
    })
    .select("id, direction")
    .single();
  if (error) return fail(error.message);

  await recordAudit({
    action: "create",
    entity_type: "vehicle_log",
    entity_id: inserted.id,
    changes: {
      vehicle_id: vehicle.id,
      site_id,
      direction: nextDirection,
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
// VEHICLE ROUTES
// =============================================================================

export async function getVehicleRoutes(): Promise<
  ActionResult<VehicleRoute[]>
> {
  const auth = await requireVehicleScanner();
  if (!auth.ok) return fail(auth.error);

  const admin = createAdminClient();
  const { data, error } = await admin
    .schema("palaro")
    .from("vehicle_routes")
    .select("*")
    .order("scheduled_time", { ascending: true, nullsFirst: false })
    .limit(500);
  if (error) return fail(error.message);
  return ok(data ?? []);
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

  const admin = createAdminClient();
  const { data: inserted, error } = await admin
    .schema("palaro")
    .from("vehicle_routes")
    .insert({
      vehicle_id: data.vehicle_id,
      route_name: data.route_name,
      origin_site_id: data.origin_site_id || null,
      destination_site_id: data.destination_site_id || null,
      scheduled_time: data.scheduled_time
        ? new Date(data.scheduled_time).toISOString()
        : null,
      delegation_id: data.delegation_id || null,
      notes: data.notes || null,
    })
    .select("id")
    .single();
  if (error) return fail(error.message);

  await recordAudit({
    action: "create",
    entity_type: "vehicle_route",
    entity_id: inserted.id,
    changes: { vehicle_id: data.vehicle_id, route_name: data.route_name },
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
