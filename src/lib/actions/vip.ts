"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions";
import {
  assignProtocolOfficerSchema,
  cancelMovementSchema,
  createMovementSchema,
  createVipLogSchema,
  createVipSchema,
  logArrivalSchema,
  logDepartureSchema,
  setEtdSchema,
  updateVipLogRequestStatusSchema,
  updateVipSchema,
} from "@/lib/schemas/vip";
import { recordAudit } from "./audit";
import { fail, ok, type ActionResult } from "./types";
import type { Database } from "@/types/database";

type Vip = Database["palaro"]["Tables"]["vip_persons"]["Row"];
type Movement = Database["palaro"]["Tables"]["vip_movements"]["Row"];
type VipLog = Database["palaro"]["Tables"]["vip_logs"]["Row"];
type ProfileLite = {
  id: string;
  full_name: string | null;
  email: string;
  roles: Database["palaro"]["Enums"]["user_role"][];
  is_active: boolean;
};
type NotificationInsert =
  Database["palaro"]["Tables"]["notifications"]["Insert"];

const VIP_PATH = "/dashboard/vip";

async function requireVipManager() {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false as const, error: "Not authenticated." };
  if (!hasPermission(profile, "vip.manage")) {
    return {
      ok: false as const,
      error: "You don't have permission to manage VIP tracking.",
    };
  }
  return { ok: true as const, profile };
}

// Creation gate: only Command Center / super_admin can create VIPs. Each VIP
// is assigned at creation to a specific Protocol Officer.
async function requireVipCreator() {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false as const, error: "Not authenticated." };
  if (!isBroadViewer(profile)) {
    return {
      ok: false as const,
      error: "Only Command Center or Super Admin can create VIPs.",
    };
  }
  return { ok: true as const, profile };
}

// Helpers — viewers are split into two cohorts:
//   * "broad" viewers (super_admin / command_center): create / assign / edit
//     every VIP and see every movement (read-only on movements).
//   * Protocol Officers: see the VIPs assigned to them and the movements
//     they created for those VIPs.
function isBroadViewer(profile: {
  roles: readonly string[] | string[];
}): boolean {
  return profile.roles.some(
    (r) => r === "super_admin" || r === "command_center",
  );
}

// Creator-only ownership gate for movement actions. Falls back to
// protocol_officer_id for legacy rows that pre-date created_by.
function isMovementOwner(
  profile: { id: string; roles: readonly string[] | string[] },
  movement: { created_by: string | null; protocol_officer_id: string | null },
): boolean {
  if (movement.created_by) return movement.created_by === profile.id;
  return movement.protocol_officer_id === profile.id;
}

// =============================================================================
// VIP PERSONS
// =============================================================================

export async function getVips(
  includeInactive = false,
): Promise<ActionResult<Vip[]>> {
  const profile = await getCurrentProfile();
  if (!profile) return fail("Not authenticated.");

  const admin = createAdminClient();
  let q = admin
    .schema("palaro")
    .from("vip_persons")
    .select("*")
    .order("full_name");
  if (!includeInactive) q = q.eq("is_active", true);
  // Visibility: Protocol Officers see VIPs assigned to them via
  // protocol_officer_id. Broad viewers (super_admin / command_center) see
  // every VIP.
  if (!isBroadViewer(profile)) {
    q = q.eq("protocol_officer_id", profile.id);
  }

  const { data, error } = await q;
  if (error) return fail(error.message);
  return ok(data ?? []);
}

export async function createVip(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const auth = await requireVipCreator();
  if (!auth.ok) return fail(auth.error);

  const parsed = createVipSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  const data = parsed.data;

  const admin = createAdminClient();

  // Validate the assigned Protocol Officer holds the role and is active.
  const { data: officer } = await admin
    .schema("palaro")
    .from("profiles")
    .select("id, roles, is_active")
    .eq("id", data.protocol_officer_id)
    .single();
  if (!officer) return fail("Selected Protocol Officer not found.");
  if (!officer.is_active) {
    return fail("Selected Protocol Officer is not active.");
  }
  if (!officer.roles.includes("protocol_officer")) {
    return fail("Selected profile does not hold the Protocol Officer role.");
  }

  const { data: inserted, error } = await admin
    .schema("palaro")
    .from("vip_persons")
    .insert({
      full_name: data.full_name,
      title: data.title || null,
      organization: data.organization || null,
      delegation_id: data.delegation_id || null,
      contact_number: data.contact_number || null,
      notes: data.notes || null,
      protocol_officer_id: data.protocol_officer_id,
      created_by: auth.profile.id,
    })
    .select("id")
    .single();
  if (error) return fail(error.message);

  await recordAudit({
    action: "create",
    entity_type: "vip_person",
    entity_id: inserted.id,
    changes: {
      full_name: data.full_name,
      title: data.title ?? null,
      organization: data.organization ?? null,
      protocol_officer_id: data.protocol_officer_id,
    },
    user_id: auth.profile.id,
  });

  revalidatePath(VIP_PATH);
  return ok({ id: inserted.id });
}

export async function updateVip(input: unknown): Promise<ActionResult<void>> {
  // Editing a VIP — including reassigning their Protocol Officer — is a
  // Command Center / Super Admin task, mirroring creation.
  const auth = await requireVipCreator();
  if (!auth.ok) return fail(auth.error);

  const parsed = updateVipSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  const { id, ...data } = parsed.data;

  const admin = createAdminClient();

  const { data: existingVip } = await admin
    .schema("palaro")
    .from("vip_persons")
    .select("id")
    .eq("id", id)
    .single();
  if (!existingVip) return fail("VIP not found.");

  // Validate the (possibly changed) Protocol Officer assignment.
  const { data: officer } = await admin
    .schema("palaro")
    .from("profiles")
    .select("id, roles, is_active")
    .eq("id", data.protocol_officer_id)
    .single();
  if (!officer) return fail("Selected Protocol Officer not found.");
  if (!officer.is_active) {
    return fail("Selected Protocol Officer is not active.");
  }
  if (!officer.roles.includes("protocol_officer")) {
    return fail("Selected profile does not hold the Protocol Officer role.");
  }

  const { error } = await admin
    .schema("palaro")
    .from("vip_persons")
    .update({
      full_name: data.full_name,
      title: data.title || null,
      organization: data.organization || null,
      delegation_id: data.delegation_id || null,
      contact_number: data.contact_number || null,
      notes: data.notes || null,
      protocol_officer_id: data.protocol_officer_id,
    })
    .eq("id", id);
  if (error) return fail(error.message);

  await recordAudit({
    action: "update",
    entity_type: "vip_person",
    entity_id: id,
    changes: {
      full_name: data.full_name,
      protocol_officer_id: data.protocol_officer_id,
    },
    user_id: auth.profile.id,
  });

  revalidatePath(VIP_PATH);
  return ok();
}

// =============================================================================
// MOVEMENTS
// =============================================================================

// Returns a minimal profile lookup for the given ids. Used by the movements
// table to resolve creator/protocol-officer display names without leaking
// the full profiles row.
export async function getProfilesByIds(
  ids: string[],
): Promise<ActionResult<ProfileLite[]>> {
  const profile = await getCurrentProfile();
  if (!profile) return fail("Not authenticated.");
  if (!hasPermission(profile, "vip.manage")) {
    return fail("You don't have permission to view this.");
  }
  const cleaned = Array.from(new Set(ids.filter(Boolean)));
  if (cleaned.length === 0) return ok([]);

  const admin = createAdminClient();
  const { data, error } = await admin
    .schema("palaro")
    .from("profiles")
    .select("id, full_name, email, roles, is_active")
    .in("id", cleaned);
  if (error) return fail(error.message);
  return ok((data ?? []) as ProfileLite[]);
}

export async function getMovements(
  limit = 200,
): Promise<ActionResult<Movement[]>> {
  const profile = await getCurrentProfile();
  if (!profile) return fail("Not authenticated.");

  const admin = createAdminClient();
  // Order: active movements first (by ETA ascending), then completed ones
  // by most recent — this ranking is implemented client-side; here we just
  // grab the most recently touched.
  let q = admin
    .schema("palaro")
    .from("vip_movements")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(limit);
  // Visibility: Protocol Officers only see movements for VIPs assigned to
  // them. We resolve their assigned VIP ids first, then scope movements to
  // that set.
  if (!isBroadViewer(profile)) {
    const { data: assignedVips } = await admin
      .schema("palaro")
      .from("vip_persons")
      .select("id")
      .eq("protocol_officer_id", profile.id);
    const ids = (assignedVips ?? []).map((v) => v.id);
    if (ids.length === 0) return ok([]);
    q = q.in("vip_id", ids);
  }

  const { data, error } = await q;
  if (error) return fail(error.message);
  return ok(data ?? []);
}

async function notifyMovementChange(
  movement: Pick<Movement, "id" | "vip_id" | "destination_site_id">,
  vipName: string,
  destinationName: string | null,
  title: string,
  body: string,
  severity: "info" | "warning" | "critical" = "info",
) {
  const admin = createAdminClient();
  const rows: NotificationInsert[] = [
    {
      recipient_id: null,
      recipient_role: "command_center",
      title,
      body,
      category: "vip",
      severity,
      reference_type: "vip_movement",
      reference_id: movement.id,
      link_url: VIP_PATH,
    },
    {
      recipient_id: null,
      recipient_role: "protocol_officer",
      title,
      body,
      category: "vip",
      severity,
      reference_type: "vip_movement",
      reference_id: movement.id,
      link_url: VIP_PATH,
    },
  ];
  await admin.schema("palaro").from("notifications").insert(rows);

  // Lint touchpoints — keep types referenced.
  void vipName;
  void destinationName;
}

export async function createMovement(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const profile = await getCurrentProfile();
  if (!profile) return fail("Not authenticated.");
  if (!profile.roles.includes("protocol_officer")) {
    return fail("Only Protocol Officers can log VIP movements.");
  }

  const parsed = createMovementSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  const data = parsed.data;

  const admin = createAdminClient();

  // A Protocol Officer can only log movements for VIPs assigned to them.
  const { data: vip } = await admin
    .schema("palaro")
    .from("vip_persons")
    .select("id, full_name, protocol_officer_id")
    .eq("id", data.vip_id)
    .single();
  if (!vip) return fail("VIP not found.");
  if (vip.protocol_officer_id !== profile.id) {
    return fail("You can only log movements for VIPs assigned to you.");
  }

  let destinationName: string | null = null;
  if (data.destination_site_id) {
    const { data: site } = await admin
      .schema("palaro")
      .from("sites")
      .select("id, name")
      .eq("id", data.destination_site_id)
      .single();
    destinationName = site?.name ?? null;
  }

  const { data: inserted, error } = await admin
    .schema("palaro")
    .from("vip_movements")
    .insert({
      vip_id: data.vip_id,
      destination_site_id: data.destination_site_id || null,
      status: "eta_logged",
      estimated_arrival: data.estimated_arrival,
      purpose: data.purpose || null,
      vehicle_info: data.vehicle_info || null,
      escort_count: data.escort_count ?? null,
      notes: data.notes || null,
      protocol_officer_id: profile.id,
      created_by: profile.id,
      updated_by: profile.id,
    })
    .select("id, vip_id, destination_site_id")
    .single();
  if (error) return fail(error.message);

  await recordAudit({
    action: "create",
    entity_type: "vip_movement",
    entity_id: inserted.id,
    changes: {
      vip_id: data.vip_id,
      destination_site_id: data.destination_site_id ?? null,
      estimated_arrival: data.estimated_arrival,
      status: "eta_logged",
    },
    user_id: profile.id,
  });

  await notifyMovementChange(
    inserted,
    vip.full_name,
    destinationName,
    `VIP ETA: ${vip.full_name}`,
    `Estimated arrival ${new Date(data.estimated_arrival).toISOString()}${
      destinationName ? ` at ${destinationName}` : ""
    }${data.purpose ? ` · ${data.purpose}` : ""}`,
  );

  revalidatePath(VIP_PATH);
  return ok({ id: inserted.id });
}

export async function logArrival(
  input: unknown,
): Promise<ActionResult<void>> {
  const auth = await requireVipManager();
  if (!auth.ok) return fail(auth.error);

  const parsed = logArrivalSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  const { movement_id, actual_arrival, notes } = parsed.data;

  const admin = createAdminClient();
  const { data: existing } = await admin
    .schema("palaro")
    .from("vip_movements")
    .select(
      "id, vip_id, destination_site_id, status, notes, created_by, protocol_officer_id",
    )
    .eq("id", movement_id)
    .single();
  if (!existing) return fail("Movement not found.");
  if (!isMovementOwner(auth.profile, existing)) {
    return fail("Only the movement's creator can log its arrival.");
  }
  if (existing.status === "departed" || existing.status === "cancelled") {
    return fail("Cannot log arrival on a closed movement.");
  }

  const composedNotes = [existing.notes, notes].filter(Boolean).join("\n");
  const { error } = await admin
    .schema("palaro")
    .from("vip_movements")
    .update({
      status: "arrived",
      actual_arrival: actual_arrival ?? new Date().toISOString(),
      notes: composedNotes || null,
      updated_by: auth.profile.id,
    })
    .eq("id", movement_id);
  if (error) return fail(error.message);

  await recordAudit({
    action: "update",
    entity_type: "vip_movement",
    entity_id: movement_id,
    changes: { status: "arrived" },
    user_id: auth.profile.id,
  });

  const { data: vip } = await admin
    .schema("palaro")
    .from("vip_persons")
    .select("full_name")
    .eq("id", existing.vip_id)
    .single();
  let destinationName: string | null = null;
  if (existing.destination_site_id) {
    const { data: site } = await admin
      .schema("palaro")
      .from("sites")
      .select("name")
      .eq("id", existing.destination_site_id)
      .single();
    destinationName = site?.name ?? null;
  }

  await notifyMovementChange(
    existing,
    vip?.full_name ?? "VIP",
    destinationName,
    `VIP arrived: ${vip?.full_name ?? "VIP"}`,
    `${vip?.full_name ?? "VIP"} arrived${
      destinationName ? ` at ${destinationName}` : ""
    }`,
  );

  revalidatePath(VIP_PATH);
  return ok();
}

export async function setEstimatedDeparture(
  input: unknown,
): Promise<ActionResult<void>> {
  const auth = await requireVipManager();
  if (!auth.ok) return fail(auth.error);

  const parsed = setEtdSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  const { movement_id, estimated_departure, notes } = parsed.data;

  const admin = createAdminClient();
  const { data: existing } = await admin
    .schema("palaro")
    .from("vip_movements")
    .select("id, status, notes, created_by, protocol_officer_id")
    .eq("id", movement_id)
    .single();
  if (!existing) return fail("Movement not found.");
  if (!isMovementOwner(auth.profile, existing)) {
    return fail("Only the movement's creator can set its ETD.");
  }
  if (existing.status !== "arrived" && existing.status !== "etd_logged") {
    return fail("Estimated departure can only be set after arrival.");
  }

  const composedNotes = [existing.notes, notes].filter(Boolean).join("\n");
  const { error } = await admin
    .schema("palaro")
    .from("vip_movements")
    .update({
      status: "etd_logged",
      estimated_departure,
      notes: composedNotes || null,
      updated_by: auth.profile.id,
    })
    .eq("id", movement_id);
  if (error) return fail(error.message);

  await recordAudit({
    action: "update",
    entity_type: "vip_movement",
    entity_id: movement_id,
    changes: { status: "etd_logged", estimated_departure },
    user_id: auth.profile.id,
  });

  revalidatePath(VIP_PATH);
  return ok();
}

export async function logDeparture(
  input: unknown,
): Promise<ActionResult<void>> {
  const auth = await requireVipManager();
  if (!auth.ok) return fail(auth.error);

  const parsed = logDepartureSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  const { movement_id, actual_departure, notes } = parsed.data;

  const admin = createAdminClient();
  const { data: existing } = await admin
    .schema("palaro")
    .from("vip_movements")
    .select(
      "id, vip_id, destination_site_id, status, notes, created_by, protocol_officer_id",
    )
    .eq("id", movement_id)
    .single();
  if (!existing) return fail("Movement not found.");
  if (!isMovementOwner(auth.profile, existing)) {
    return fail("Only the movement's creator can log its departure.");
  }
  if (existing.status === "departed" || existing.status === "cancelled") {
    return fail("Movement is already closed.");
  }
  if (existing.status === "eta_logged") {
    return fail("Cannot log departure before arrival.");
  }

  const composedNotes = [existing.notes, notes].filter(Boolean).join("\n");
  const { error } = await admin
    .schema("palaro")
    .from("vip_movements")
    .update({
      status: "departed",
      actual_departure: actual_departure ?? new Date().toISOString(),
      notes: composedNotes || null,
      updated_by: auth.profile.id,
    })
    .eq("id", movement_id);
  if (error) return fail(error.message);

  await recordAudit({
    action: "update",
    entity_type: "vip_movement",
    entity_id: movement_id,
    changes: { status: "departed" },
    user_id: auth.profile.id,
  });

  const { data: vip } = await admin
    .schema("palaro")
    .from("vip_persons")
    .select("full_name")
    .eq("id", existing.vip_id)
    .single();

  await notifyMovementChange(
    existing,
    vip?.full_name ?? "VIP",
    null,
    `VIP departed: ${vip?.full_name ?? "VIP"}`,
    `${vip?.full_name ?? "VIP"} departed at ${new Date().toISOString()}`,
  );

  revalidatePath(VIP_PATH);
  return ok();
}

export async function cancelMovement(
  input: unknown,
): Promise<ActionResult<void>> {
  const auth = await requireVipManager();
  if (!auth.ok) return fail(auth.error);

  const parsed = cancelMovementSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  const { movement_id, reason } = parsed.data;

  const admin = createAdminClient();
  const { data: existing } = await admin
    .schema("palaro")
    .from("vip_movements")
    .select("id, status, notes, created_by, protocol_officer_id")
    .eq("id", movement_id)
    .single();
  if (!existing) return fail("Movement not found.");
  if (!isMovementOwner(auth.profile, existing)) {
    return fail("Only the movement's creator can cancel it.");
  }
  if (existing.status === "departed" || existing.status === "cancelled") {
    return fail("Movement is already closed.");
  }

  const cancelLine = `[CANCELLED ${new Date().toISOString()}] ${
    auth.profile.full_name ?? auth.profile.email
  }: ${reason}`;
  const composedNotes = [existing.notes, cancelLine]
    .filter(Boolean)
    .join("\n");

  const { error } = await admin
    .schema("palaro")
    .from("vip_movements")
    .update({
      status: "cancelled",
      notes: composedNotes,
      updated_by: auth.profile.id,
    })
    .eq("id", movement_id);
  if (error) return fail(error.message);

  await recordAudit({
    action: "update",
    entity_type: "vip_movement",
    entity_id: movement_id,
    changes: { status: "cancelled", reason },
    user_id: auth.profile.id,
  });

  revalidatePath(VIP_PATH);
  return ok();
}

// =============================================================================
// PROTOCOL OFFICER ASSIGNMENT
// =============================================================================
// VIPs are assigned to a Protocol Officer at creation. Command Center / Super
// Admin can also reassign later (e.g. when a PO is reassigned mid-event).

// Returns active profiles holding the protocol_officer role. Used by the
// assignment dialog and the VIP form's officer picker.
export async function getProtocolOfficerCandidates(): Promise<
  ActionResult<ProfileLite[]>
> {
  const profile = await getCurrentProfile();
  if (!profile) return fail("Not authenticated.");
  if (!hasPermission(profile, "vip.manage")) {
    return fail("You don't have permission to manage VIP tracking.");
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .schema("palaro")
    .from("profiles")
    .select("id, full_name, email, roles, is_active")
    .contains("roles", ["protocol_officer"])
    .eq("is_active", true)
    .order("full_name", { ascending: true });
  if (error) return fail(error.message);
  return ok((data ?? []) as ProfileLite[]);
}

export async function assignProtocolOfficer(
  input: unknown,
): Promise<ActionResult<void>> {
  // Only Command Center / Super Admin can (re)assign Protocol Officers.
  const auth = await requireVipCreator();
  if (!auth.ok) return fail(auth.error);
  const { profile } = auth;

  const parsed = assignProtocolOfficerSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  const { vip_id, protocol_officer_id } = parsed.data;

  const admin = createAdminClient();

  if (protocol_officer_id) {
    // Verify the target profile holds the protocol_officer role and is active.
    const { data: target } = await admin
      .schema("palaro")
      .from("profiles")
      .select("id, roles, is_active")
      .eq("id", protocol_officer_id)
      .single();
    if (!target) return fail("Target profile not found.");
    if (!target.is_active) return fail("Target profile is not active.");
    if (!target.roles.includes("protocol_officer")) {
      return fail("Target profile does not hold the Protocol Officer role.");
    }
    // One Protocol Officer may now hold multiple VIPs, so no longer clear
    // their other assignments.
  }

  const { error } = await admin
    .schema("palaro")
    .from("vip_persons")
    .update({ protocol_officer_id: protocol_officer_id })
    .eq("id", vip_id);
  if (error) return fail(error.message);

  await recordAudit({
    action: "update",
    entity_type: "vip_person",
    entity_id: vip_id,
    changes: { protocol_officer_id },
    user_id: profile.id,
  });

  revalidatePath(VIP_PATH);
  return ok();
}

// =============================================================================
// VIP LOGS — Protocol Officers capture entries for their assigned VIPs;
// Command Center triages requests via status updates.
// =============================================================================

export async function getVipLogs(
  vipId: string,
  limit = 200,
): Promise<ActionResult<VipLog[]>> {
  const profile = await getCurrentProfile();
  if (!profile) return fail("Not authenticated.");
  if (!hasPermission(profile, "vip.manage")) {
    return fail("You don't have permission to view VIP logs.");
  }

  const admin = createAdminClient();

  // Visibility: Protocol Officers see logs only for VIPs assigned to them.
  // Broad viewers (super_admin / command_center) see all logs.
  if (!isBroadViewer(profile)) {
    const { data: vip } = await admin
      .schema("palaro")
      .from("vip_persons")
      .select("id, protocol_officer_id")
      .eq("id", vipId)
      .single();
    if (!vip || vip.protocol_officer_id !== profile.id) {
      return fail("This VIP is not visible to you.");
    }
  }

  const { data, error } = await admin
    .schema("palaro")
    .from("vip_logs")
    .select("*")
    .eq("vip_id", vipId)
    .order("logged_at", { ascending: false })
    .limit(limit);
  if (error) return fail(error.message);
  return ok(data ?? []);
}

export async function createVipLog(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const profile = await getCurrentProfile();
  if (!profile) return fail("Not authenticated.");
  // Only the VIP's assigned Protocol Officer may add log entries.
  if (!profile.roles.includes("protocol_officer")) {
    return fail("Only Protocol Officers can log VIP activity.");
  }

  const parsed = createVipLogSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  const data = parsed.data;

  const admin = createAdminClient();

  // The caller must be the VIP's assigned Protocol Officer.
  const { data: vip } = await admin
    .schema("palaro")
    .from("vip_persons")
    .select("id, full_name, protocol_officer_id")
    .eq("id", data.vip_id)
    .single();
  if (!vip) return fail("VIP not found.");
  if (vip.protocol_officer_id !== profile.id) {
    return fail("You can only log entries for VIPs assigned to you.");
  }

  const { data: inserted, error } = await admin
    .schema("palaro")
    .from("vip_logs")
    .insert({
      vip_id: data.vip_id,
      protocol_officer_id: profile.id,
      from_location: data.from_location || null,
      to_location: data.to_location || null,
      logged_at: data.logged_at ?? new Date().toISOString(),
      request: data.request || null,
      remarks: data.remarks || null,
      // request_status defaults to 'pending' in the DB.
    })
    .select("id")
    .single();
  if (error) return fail(error.message);

  await recordAudit({
    action: "create",
    entity_type: "vip_log",
    entity_id: inserted.id,
    changes: {
      vip_id: data.vip_id,
      from_location: data.from_location ?? null,
      to_location: data.to_location ?? null,
      request: data.request ?? null,
    },
    user_id: profile.id,
  });

  // Notify Command Center so they can act on the request.
  if (data.request?.trim()) {
    const notification: NotificationInsert = {
      recipient_id: null,
      recipient_role: "command_center",
      title: `VIP request: ${vip.full_name}`,
      body: data.request.trim().slice(0, 240),
      category: "vip",
      severity: "info",
      reference_type: "vip_log",
      reference_id: inserted.id,
      link_url: VIP_PATH,
    };
    await admin.schema("palaro").from("notifications").insert([notification]);
  }

  revalidatePath(VIP_PATH);
  return ok({ id: inserted.id });
}

export async function updateVipLogRequestStatus(
  input: unknown,
): Promise<ActionResult<void>> {
  const profile = await getCurrentProfile();
  if (!profile) return fail("Not authenticated.");
  // Per spec, request status is "triggered by Command Center". Gate on
  // command_center / super_admin specifically; vip.manage alone (e.g. a
  // protocol officer) is not enough.
  const callerCanSetStatus = profile.roles.some(
    (r) => r === "command_center" || r === "super_admin",
  );
  if (!callerCanSetStatus) {
    return fail("Only Command Center can update request status.");
  }

  const parsed = updateVipLogRequestStatusSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  const { log_id, request_status, remarks } = parsed.data;

  const admin = createAdminClient();
  const { data: existing } = await admin
    .schema("palaro")
    .from("vip_logs")
    .select("id, vip_id, remarks, protocol_officer_id")
    .eq("id", log_id)
    .single();
  if (!existing) return fail("Log entry not found.");

  // Append remarks rather than overwriting so the history is preserved.
  const composedRemarks = remarks
    ? [existing.remarks, `[${new Date().toISOString()}] ${remarks}`]
        .filter(Boolean)
        .join("\n")
    : existing.remarks;

  const { error } = await admin
    .schema("palaro")
    .from("vip_logs")
    .update({
      request_status,
      remarks: composedRemarks ?? null,
      status_updated_by: profile.id,
      status_updated_at: new Date().toISOString(),
    })
    .eq("id", log_id);
  if (error) return fail(error.message);

  await recordAudit({
    action: "update",
    entity_type: "vip_log",
    entity_id: log_id,
    changes: { request_status },
    user_id: profile.id,
  });

  // Notify the protocol officer who logged the request, if known.
  if (existing.protocol_officer_id) {
    const notification: NotificationInsert = {
      recipient_id: existing.protocol_officer_id,
      recipient_role: null,
      title: `VIP request ${request_status.replace("_", " ")}`,
      body: remarks?.slice(0, 240) ?? `Status set to ${request_status}.`,
      category: "vip",
      severity: "info",
      reference_type: "vip_log",
      reference_id: log_id,
      link_url: VIP_PATH,
    };
    await admin.schema("palaro").from("notifications").insert([notification]);
  }

  revalidatePath(VIP_PATH);
  return ok();
}
