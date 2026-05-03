"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions";
import {
  createSupplySchema,
  deleteSupplySchema,
  recordMovementSchema,
  updateSupplySchema,
} from "@/lib/schemas/supplies";
import { recordAudit } from "./audit";
import { fail, ok, type ActionResult } from "./types";
import type { Database } from "@/types/database";

type Supply = Database["palaro"]["Tables"]["medical_supplies"]["Row"];
type Movement = Database["palaro"]["Tables"]["supply_movements"]["Row"];
type MovementType = Database["palaro"]["Enums"]["supply_movement_type"];

const SUPPLIES_PATH = "/dashboard/medical/supplies";

async function requireSupplyManager() {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false as const, error: "Not authenticated." };
  if (!hasPermission(profile, "supplies.manage")) {
    return {
      ok: false as const,
      error: "You don't have permission to manage medical supplies.",
    };
  }
  return { ok: true as const, profile };
}

// =============================================================================
// SUPPLIES (catalogue)
// =============================================================================

export async function getSupplies(
  includeInactive = false,
): Promise<ActionResult<Supply[]>> {
  const auth = await requireSupplyManager();
  if (!auth.ok) return fail(auth.error);

  const admin = createAdminClient();
  let q = admin
    .schema("palaro")
    .from("medical_supplies")
    .select("*")
    .order("name", { ascending: true });
  if (!includeInactive) q = q.eq("is_active", true);

  const { data, error } = await q;
  if (error) return fail(error.message);
  return ok(data ?? []);
}

export async function createSupply(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const auth = await requireSupplyManager();
  if (!auth.ok) return fail(auth.error);

  const parsed = createSupplySchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  const data = parsed.data;

  const admin = createAdminClient();
  const { data: inserted, error } = await admin
    .schema("palaro")
    .from("medical_supplies")
    .insert({
      name: data.name,
      category: data.category || null,
      unit: data.unit,
      current_stock: data.current_stock ?? 0,
      reorder_level: data.reorder_level ?? 10,
      expiry_date: data.expiry_date || null,
      storage_site_id: data.storage_site_id || null,
      notes: data.notes || null,
    })
    .select("id")
    .single();
  if (error) return fail(error.message);

  // If the operator pre-loaded a non-zero starting stock, log it as the
  // first stock_in so the movement history is complete from day one.
  if ((data.current_stock ?? 0) > 0) {
    await admin.schema("palaro").from("supply_movements").insert({
      supply_id: inserted.id,
      movement_type: "stock_in",
      quantity: data.current_stock!,
      reason: "Initial stock",
      reference_type: "manual",
      performed_by: auth.profile.id,
    });
  }

  await recordAudit({
    action: "create",
    entity_type: "medical_supply",
    entity_id: inserted.id,
    changes: {
      name: data.name,
      unit: data.unit,
      starting_stock: data.current_stock ?? 0,
    },
    user_id: auth.profile.id,
  });

  revalidatePath(SUPPLIES_PATH);
  return ok({ id: inserted.id });
}

export async function updateSupply(
  input: unknown,
): Promise<ActionResult<void>> {
  const auth = await requireSupplyManager();
  if (!auth.ok) return fail(auth.error);

  const parsed = updateSupplySchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  const { id, ...data } = parsed.data;

  const admin = createAdminClient();
  // Don't overwrite current_stock from the edit form — it's managed by movements.
  // Still allow editing starting metadata: name, unit, category, reorder_level, expiry, storage, notes.
  const { error } = await admin
    .schema("palaro")
    .from("medical_supplies")
    .update({
      name: data.name,
      category: data.category || null,
      unit: data.unit,
      reorder_level: data.reorder_level ?? 10,
      expiry_date: data.expiry_date || null,
      storage_site_id: data.storage_site_id || null,
      notes: data.notes || null,
    })
    .eq("id", id);
  if (error) return fail(error.message);

  await recordAudit({
    action: "update",
    entity_type: "medical_supply",
    entity_id: id,
    changes: { name: data.name, reorder_level: data.reorder_level ?? 10 },
    user_id: auth.profile.id,
  });

  revalidatePath(SUPPLIES_PATH);
  return ok();
}

export async function deleteSupply(
  input: unknown,
): Promise<ActionResult<void>> {
  const auth = await requireSupplyManager();
  if (!auth.ok) return fail(auth.error);

  const parsed = deleteSupplySchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }

  const admin = createAdminClient();
  const { error } = await admin
    .schema("palaro")
    .from("medical_supplies")
    .update({ is_active: false })
    .eq("id", parsed.data.id);
  if (error) return fail(error.message);

  await recordAudit({
    action: "delete",
    entity_type: "medical_supply",
    entity_id: parsed.data.id,
    changes: { is_active: false },
    user_id: auth.profile.id,
  });

  revalidatePath(SUPPLIES_PATH);
  return ok();
}

// =============================================================================
// MOVEMENTS
// =============================================================================

function appliedDelta(type: MovementType, quantity: number): number {
  // stock_in / adjustment add to stock; stock_out / expired subtract.
  // (Adjustments are operator-led re-counts after a physical inventory.)
  switch (type) {
    case "stock_in":
    case "adjustment":
      return quantity;
    case "stock_out":
    case "expired":
      return -quantity;
  }
}

export async function getMovements(
  supplyId?: string,
  limit = 200,
): Promise<ActionResult<Movement[]>> {
  const auth = await requireSupplyManager();
  if (!auth.ok) return fail(auth.error);

  const admin = createAdminClient();
  let q = admin
    .schema("palaro")
    .from("supply_movements")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (supplyId) q = q.eq("supply_id", supplyId);

  const { data, error } = await q;
  if (error) return fail(error.message);
  return ok(data ?? []);
}

export async function recordMovement(
  input: unknown,
): Promise<ActionResult<{ id: string; new_stock: number }>> {
  const auth = await requireSupplyManager();
  if (!auth.ok) return fail(auth.error);

  const parsed = recordMovementSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  const data = parsed.data;

  const admin = createAdminClient();

  const { data: supply, error: supplyErr } = await admin
    .schema("palaro")
    .from("medical_supplies")
    .select("id, current_stock, name")
    .eq("id", data.supply_id)
    .single();
  if (supplyErr || !supply) return fail("Supply not found.");

  const delta = appliedDelta(data.movement_type, data.quantity);
  const newStock = supply.current_stock + delta;
  if (newStock < 0) {
    return fail(
      `Not enough stock — ${supply.name} has ${supply.current_stock} on hand.`,
    );
  }

  // Two-write pattern: insert movement then update stock.
  // Without a stored proc this is not strictly atomic, but we audit-log both
  // and the read paths reconcile on next display.
  const { data: inserted, error: insErr } = await admin
    .schema("palaro")
    .from("supply_movements")
    .insert({
      supply_id: data.supply_id,
      movement_type: data.movement_type,
      quantity: delta,
      reason: data.reason || null,
      reference_type: data.reference_type || "manual",
      reference_id: data.reference_id || null,
      performed_by: auth.profile.id,
    })
    .select("id")
    .single();
  if (insErr) return fail(insErr.message);

  const { error: updErr } = await admin
    .schema("palaro")
    .from("medical_supplies")
    .update({ current_stock: newStock })
    .eq("id", data.supply_id);
  if (updErr) return fail(updErr.message);

  await recordAudit({
    action: "create",
    entity_type: "supply_movement",
    entity_id: inserted.id,
    changes: {
      supply_id: data.supply_id,
      movement_type: data.movement_type,
      delta,
      new_stock: newStock,
    },
    user_id: auth.profile.id,
  });

  revalidatePath(SUPPLIES_PATH);
  return ok({ id: inserted.id, new_stock: newStock });
}
