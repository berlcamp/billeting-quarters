"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions";
import {
  createRequestSchema,
  createSupplierSchema,
  deleteRequestSchema,
  deleteSupplierSchema,
  reassignRequestSupplierSchema,
  setRequestStatusSchema,
  setSupplierDelegationsSchema,
  updateRequestSchema,
  updateSupplierSchema,
} from "@/lib/schemas/food";
import { recordAudit } from "./audit";
import { fail, ok, type ActionResult } from "./types";
import type { Database } from "@/types/database";

type Supplier = Database["palaro"]["Tables"]["food_suppliers"]["Row"];
type Request = Database["palaro"]["Tables"]["food_requests"]["Row"];
type SupplierDelegation =
  Database["palaro"]["Tables"]["food_supplier_delegations"]["Row"];

const FOOD_PATH = "/dashboard/logistics/food";

async function requireFoodManager() {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false as const, error: "Not authenticated." };
  if (!hasPermission(profile, "food.manage")) {
    return {
      ok: false as const,
      error: "You don't have permission to manage food supply.",
    };
  }
  return { ok: true as const, profile };
}

async function requireFoodRequester() {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false as const, error: "Not authenticated." };
  if (
    !hasPermission(profile, "food.request") &&
    !hasPermission(profile, "food.manage")
  ) {
    return {
      ok: false as const,
      error: "You don't have permission to file food requests.",
    };
  }
  return { ok: true as const, profile };
}

// =============================================================================
// SUPPLIERS
// =============================================================================

export async function getSuppliers(
  includeInactive = false,
): Promise<ActionResult<Supplier[]>> {
  const profile = await getCurrentProfile();
  if (!profile) return fail("Not authenticated.");

  const admin = createAdminClient();
  let q = admin.schema("palaro").from("food_suppliers").select("*").order("name");
  if (!includeInactive) q = q.eq("is_active", true);
  const { data, error } = await q;
  if (error) return fail(error.message);
  return ok(data ?? []);
}

export async function createSupplier(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const auth = await requireFoodManager();
  if (!auth.ok) return fail(auth.error);

  const parsed = createSupplierSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  const data = parsed.data;

  const admin = createAdminClient();
  const { data: inserted, error } = await admin
    .schema("palaro")
    .from("food_suppliers")
    .insert({
      name: data.name,
      contact_person: data.contact_person || null,
      contact_number: data.contact_number || null,
      email: data.email || null,
      business_category: data.business_category || null,
      notes: data.notes || null,
    })
    .select("id")
    .single();
  if (error) return fail(error.message);

  await recordAudit({
    action: "create",
    entity_type: "food_supplier",
    entity_id: inserted.id,
    changes: { name: data.name },
    user_id: auth.profile.id,
  });

  revalidatePath(FOOD_PATH);
  return ok({ id: inserted.id });
}

export async function updateSupplier(
  input: unknown,
): Promise<ActionResult<void>> {
  const auth = await requireFoodManager();
  if (!auth.ok) return fail(auth.error);

  const parsed = updateSupplierSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  const { id, ...data } = parsed.data;

  const admin = createAdminClient();
  const { error } = await admin
    .schema("palaro")
    .from("food_suppliers")
    .update({
      name: data.name,
      contact_person: data.contact_person || null,
      contact_number: data.contact_number || null,
      email: data.email || null,
      business_category: data.business_category || null,
      notes: data.notes || null,
    })
    .eq("id", id);
  if (error) return fail(error.message);

  await recordAudit({
    action: "update",
    entity_type: "food_supplier",
    entity_id: id,
    changes: { name: data.name },
    user_id: auth.profile.id,
  });

  revalidatePath(FOOD_PATH);
  return ok();
}

export async function deleteSupplier(
  input: unknown,
): Promise<ActionResult<void>> {
  const auth = await requireFoodManager();
  if (!auth.ok) return fail(auth.error);

  const parsed = deleteSupplierSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }

  const admin = createAdminClient();
  const { error } = await admin
    .schema("palaro")
    .from("food_suppliers")
    .update({ is_active: false })
    .eq("id", parsed.data.id);
  if (error) return fail(error.message);

  await recordAudit({
    action: "delete",
    entity_type: "food_supplier",
    entity_id: parsed.data.id,
    changes: { is_active: false },
    user_id: auth.profile.id,
  });

  revalidatePath(FOOD_PATH);
  return ok();
}

// =============================================================================
// MEAL REQUESTS
// =============================================================================

export async function getRequests(): Promise<ActionResult<Request[]>> {
  const auth = await requireFoodRequester();
  if (!auth.ok) return fail(auth.error);

  const admin = createAdminClient();
  const { data, error } = await admin
    .schema("palaro")
    .from("food_requests")
    .select("*")
    .order("required_at", { ascending: true })
    .limit(500);
  if (error) return fail(error.message);
  return ok(data ?? []);
}

export async function createRequest(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const auth = await requireFoodRequester();
  if (!auth.ok) return fail(auth.error);

  const parsed = createRequestSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  const data = parsed.data;
  const requiredIso = new Date(data.required_at).toISOString();

  const admin = createAdminClient();

  // Delegation must exist and be active.
  const { data: delegation } = await admin
    .schema("palaro")
    .from("delegations")
    .select("id, is_active")
    .eq("id", data.delegation_id)
    .single();
  if (!delegation) return fail("Delegation not found.");
  if (!delegation.is_active) return fail("Delegation is inactive.");

  // Auto-pick a supplier from the delegation's roster when the caller
  // didn't pick one explicitly.
  let supplierId = data.supplier_id || null;
  if (!supplierId) {
    const { data: rosters } = await admin
      .schema("palaro")
      .from("food_supplier_delegations")
      .select("supplier_id, priority")
      .eq("delegation_id", data.delegation_id)
      .order("priority", { ascending: true })
      .limit(1);
    if (rosters && rosters.length > 0) {
      supplierId = rosters[0].supplier_id;
    }
  }

  const { data: inserted, error } = await admin
    .schema("palaro")
    .from("food_requests")
    .insert({
      delegation_id: data.delegation_id,
      supplier_id: supplierId,
      item_name: data.item_name,
      unit: data.unit,
      quantity: data.quantity,
      required_at: requiredIso,
      status: "pending",
      notes: data.notes || null,
      requested_by: auth.profile.id,
    })
    .select("id")
    .single();
  if (error) return fail(error.message);

  await recordAudit({
    action: "create",
    entity_type: "food_request",
    entity_id: inserted.id,
    changes: {
      delegation_id: data.delegation_id,
      item_name: data.item_name,
      unit: data.unit,
      quantity: data.quantity,
      required_at: requiredIso,
    },
    user_id: auth.profile.id,
  });

  revalidatePath(FOOD_PATH);
  return ok({ id: inserted.id });
}

export async function updateRequest(
  input: unknown,
): Promise<ActionResult<void>> {
  const auth = await requireFoodRequester();
  if (!auth.ok) return fail(auth.error);

  const parsed = updateRequestSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  const { id, ...data } = parsed.data;
  const requiredIso = new Date(data.required_at).toISOString();

  const admin = createAdminClient();
  const { error } = await admin
    .schema("palaro")
    .from("food_requests")
    .update({
      delegation_id: data.delegation_id,
      supplier_id: data.supplier_id || null,
      item_name: data.item_name,
      unit: data.unit,
      quantity: data.quantity,
      required_at: requiredIso,
      notes: data.notes || null,
    })
    .eq("id", id);
  if (error) return fail(error.message);

  await recordAudit({
    action: "update",
    entity_type: "food_request",
    entity_id: id,
    changes: {
      item_name: data.item_name,
      unit: data.unit,
      quantity: data.quantity,
    },
    user_id: auth.profile.id,
  });

  revalidatePath(FOOD_PATH);
  return ok();
}

export async function setRequestStatus(
  input: unknown,
): Promise<ActionResult<void>> {
  const auth = await requireFoodManager();
  if (!auth.ok) return fail(auth.error);

  const parsed = setRequestStatusSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  const { id, status, notes } = parsed.data;

  const admin = createAdminClient();
  const { data: existing } = await admin
    .schema("palaro")
    .from("food_requests")
    .select("notes")
    .eq("id", id)
    .single();

  const stamp = new Date().toISOString();
  const note = `[${status.toUpperCase()} ${stamp}] ${auth.profile.full_name ?? auth.profile.email}${notes ? `: ${notes}` : ""}`;
  const composedNotes = [existing?.notes, note].filter(Boolean).join("\n");

  const { error } = await admin
    .schema("palaro")
    .from("food_requests")
    .update({ status, notes: composedNotes })
    .eq("id", id);
  if (error) return fail(error.message);

  await recordAudit({
    action: "update",
    entity_type: "food_request",
    entity_id: id,
    changes: { status },
    user_id: auth.profile.id,
  });

  revalidatePath(FOOD_PATH);
  return ok();
}

export async function deleteRequest(
  input: unknown,
): Promise<ActionResult<void>> {
  const auth = await requireFoodRequester();
  if (!auth.ok) return fail(auth.error);

  const parsed = deleteRequestSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }

  const admin = createAdminClient();
  const { error } = await admin
    .schema("palaro")
    .from("food_requests")
    .delete()
    .eq("id", parsed.data.id);
  if (error) return fail(error.message);

  await recordAudit({
    action: "delete",
    entity_type: "food_request",
    entity_id: parsed.data.id,
    user_id: auth.profile.id,
  });

  revalidatePath(FOOD_PATH);
  return ok();
}

// =============================================================================
// SUPPLIER ↔ DELEGATION ASSIGNMENTS
// =============================================================================

export async function getSupplierDelegations(): Promise<
  ActionResult<SupplierDelegation[]>
> {
  const profile = await getCurrentProfile();
  if (!profile) return fail("Not authenticated.");

  const admin = createAdminClient();
  const { data, error } = await admin
    .schema("palaro")
    .from("food_supplier_delegations")
    .select("*")
    .order("priority", { ascending: true });
  if (error) return fail(error.message);
  return ok(data ?? []);
}

// Replace a supplier's entire delegation assignment list in one shot. Simpler
// than incremental add/remove and matches the "edit roster" dialog UX.
export async function setSupplierDelegations(
  input: unknown,
): Promise<ActionResult<void>> {
  const auth = await requireFoodManager();
  if (!auth.ok) return fail(auth.error);

  const parsed = setSupplierDelegationsSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  const { supplier_id, delegation_ids } = parsed.data;

  const admin = createAdminClient();
  const { error: delErr } = await admin
    .schema("palaro")
    .from("food_supplier_delegations")
    .delete()
    .eq("supplier_id", supplier_id);
  if (delErr) return fail(delErr.message);

  if (delegation_ids.length > 0) {
    const rows = delegation_ids.map((delegation_id, idx) => ({
      supplier_id,
      delegation_id,
      priority: idx + 1,
      created_by: auth.profile.id,
    }));
    const { error: insErr } = await admin
      .schema("palaro")
      .from("food_supplier_delegations")
      .insert(rows);
    if (insErr) return fail(insErr.message);
  }

  await recordAudit({
    action: "update",
    entity_type: "food_supplier_delegations",
    entity_id: supplier_id,
    changes: { delegation_ids },
    user_id: auth.profile.id,
  });

  revalidatePath(FOOD_PATH);
  return ok();
}

// Food admin / Command Center overriding the auto-assigned supplier for a
// given request — used when the original supplier can't fulfill.
export async function reassignRequestSupplier(
  input: unknown,
): Promise<ActionResult<void>> {
  const auth = await requireFoodManager();
  if (!auth.ok) return fail(auth.error);

  const parsed = reassignRequestSupplierSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  const { id, supplier_id } = parsed.data;

  const admin = createAdminClient();
  const { error } = await admin
    .schema("palaro")
    .from("food_requests")
    .update({ supplier_id })
    .eq("id", id);
  if (error) return fail(error.message);

  await recordAudit({
    action: "update",
    entity_type: "food_request",
    entity_id: id,
    changes: { supplier_id },
    user_id: auth.profile.id,
  });

  revalidatePath(FOOD_PATH);
  return ok();
}
