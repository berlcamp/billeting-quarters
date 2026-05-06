"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions";
import {
  cancelMovementSchema,
  createMovementSchema,
  createVipSchema,
  logArrivalSchema,
  logDepartureSchema,
  setEtdSchema,
  updateVipSchema,
} from "@/lib/schemas/vip";
import { recordAudit } from "./audit";
import { fail, ok, type ActionResult } from "./types";
import type { Database } from "@/types/database";

type Vip = Database["palaro"]["Tables"]["vip_persons"]["Row"];
type Movement = Database["palaro"]["Tables"]["vip_movements"]["Row"];
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

  const { data, error } = await q;
  if (error) return fail(error.message);
  return ok(data ?? []);
}

export async function createVip(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const auth = await requireVipManager();
  if (!auth.ok) return fail(auth.error);

  const parsed = createVipSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  const data = parsed.data;

  const admin = createAdminClient();
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
    },
    user_id: auth.profile.id,
  });

  revalidatePath(VIP_PATH);
  return ok({ id: inserted.id });
}

export async function updateVip(input: unknown): Promise<ActionResult<void>> {
  const auth = await requireVipManager();
  if (!auth.ok) return fail(auth.error);

  const parsed = updateVipSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  const { id, ...data } = parsed.data;

  const admin = createAdminClient();
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
    })
    .eq("id", id);
  if (error) return fail(error.message);

  await recordAudit({
    action: "update",
    entity_type: "vip_person",
    entity_id: id,
    changes: { full_name: data.full_name },
    user_id: auth.profile.id,
  });

  revalidatePath(VIP_PATH);
  return ok();
}

// =============================================================================
// MOVEMENTS
// =============================================================================

export async function getMovements(
  limit = 200,
): Promise<ActionResult<Movement[]>> {
  const profile = await getCurrentProfile();
  if (!profile) return fail("Not authenticated.");

  const admin = createAdminClient();
  // Order: active movements first (by ETA ascending), then completed ones
  // by most recent — this ranking is implemented client-side; here we just
  // grab the most recently touched.
  const { data, error } = await admin
    .schema("palaro")
    .from("vip_movements")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(limit);
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
  const auth = await requireVipManager();
  if (!auth.ok) return fail(auth.error);

  const parsed = createMovementSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  const data = parsed.data;

  const admin = createAdminClient();

  const { data: vip } = await admin
    .schema("palaro")
    .from("vip_persons")
    .select("id, full_name")
    .eq("id", data.vip_id)
    .single();
  if (!vip) return fail("VIP not found.");

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
      protocol_officer_id: auth.profile.roles.includes("protocol_officer")
        ? auth.profile.id
        : null,
      updated_by: auth.profile.id,
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
    user_id: auth.profile.id,
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
    .select("id, vip_id, destination_site_id, status, notes")
    .eq("id", movement_id)
    .single();
  if (!existing) return fail("Movement not found.");
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
    .select("id, status, notes")
    .eq("id", movement_id)
    .single();
  if (!existing) return fail("Movement not found.");
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
    .select("id, vip_id, destination_site_id, status, notes")
    .eq("id", movement_id)
    .single();
  if (!existing) return fail("Movement not found.");
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
    .select("id, status, notes")
    .eq("id", movement_id)
    .single();
  if (!existing) return fail("Movement not found.");
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
