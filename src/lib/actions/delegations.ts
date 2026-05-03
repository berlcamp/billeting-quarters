"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions";
import {
  createDelegationSchema,
  deleteDelegationSchema,
  updateDelegationSchema,
} from "@/lib/schemas/delegations";
import { recordAudit } from "./audit";
import { fail, ok, type ActionResult } from "./types";
import type { Database } from "@/types/database";

type Delegation = Database["palaro"]["Tables"]["delegations"]["Row"];

const DELEGATIONS_PATH = "/dashboard/admin/delegations";

async function requireDelegationManager() {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false as const, error: "Not authenticated." };
  if (!hasPermission(profile, "delegations.manage")) {
    return {
      ok: false as const,
      error: "You don't have permission to manage delegations.",
    };
  }
  return { ok: true as const, profile };
}

function normalizeColor(input: string | null | undefined): string | null {
  if (!input) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  return trimmed.startsWith("#") ? trimmed.toLowerCase() : `#${trimmed.toLowerCase()}`;
}

export async function getDelegations(
  includeInactive = false,
): Promise<ActionResult<Delegation[]>> {
  const profile = await getCurrentProfile();
  if (!profile) return fail("Not authenticated.");

  const admin = createAdminClient();
  let q = admin
    .schema("palaro")
    .from("delegations")
    .select("*")
    .order("region_code");
  if (!includeInactive) q = q.eq("is_active", true);
  const { data, error } = await q;
  if (error) return fail(error.message);
  return ok(data ?? []);
}

export async function createDelegation(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const auth = await requireDelegationManager();
  if (!auth.ok) return fail(auth.error);

  const parsed = createDelegationSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  const data = parsed.data;

  const admin = createAdminClient();

  const { data: existing } = await admin
    .schema("palaro")
    .from("delegations")
    .select("id")
    .eq("region_code", data.region_code)
    .maybeSingle();
  if (existing) return fail("Region code already exists.");

  const { data: inserted, error } = await admin
    .schema("palaro")
    .from("delegations")
    .insert({
      region_code: data.region_code,
      region_name: data.region_name,
      short_name: data.short_name || null,
      head_of_delegation: data.head_of_delegation || null,
      contact_number: data.contact_number || null,
      total_athletes: data.total_athletes,
      total_coaches: data.total_coaches,
      total_officials: data.total_officials,
      color_hex: normalizeColor(data.color_hex),
      assigned_bq_id: data.assigned_bq_id || null,
    })
    .select("id")
    .single();

  if (error) return fail(error.message);

  await recordAudit({
    action: "create",
    entity_type: "delegation",
    entity_id: inserted.id,
    changes: { region_code: data.region_code, region_name: data.region_name },
    user_id: auth.profile.id,
  });

  revalidatePath(DELEGATIONS_PATH);
  return ok({ id: inserted.id });
}

export async function updateDelegation(
  input: unknown,
): Promise<ActionResult<void>> {
  const auth = await requireDelegationManager();
  if (!auth.ok) return fail(auth.error);

  const parsed = updateDelegationSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  const { id, ...data } = parsed.data;

  const admin = createAdminClient();

  // Detect region_code conflicts on rename.
  const { data: clash } = await admin
    .schema("palaro")
    .from("delegations")
    .select("id")
    .eq("region_code", data.region_code)
    .neq("id", id)
    .maybeSingle();
  if (clash) return fail("Region code already exists on another delegation.");

  const { error } = await admin
    .schema("palaro")
    .from("delegations")
    .update({
      region_code: data.region_code,
      region_name: data.region_name,
      short_name: data.short_name || null,
      head_of_delegation: data.head_of_delegation || null,
      contact_number: data.contact_number || null,
      total_athletes: data.total_athletes,
      total_coaches: data.total_coaches,
      total_officials: data.total_officials,
      color_hex: normalizeColor(data.color_hex),
      assigned_bq_id: data.assigned_bq_id || null,
    })
    .eq("id", id);
  if (error) return fail(error.message);

  await recordAudit({
    action: "update",
    entity_type: "delegation",
    entity_id: id,
    changes: { region_code: data.region_code, region_name: data.region_name },
    user_id: auth.profile.id,
  });

  revalidatePath(DELEGATIONS_PATH);
  return ok();
}

export async function deleteDelegation(
  input: unknown,
): Promise<ActionResult<void>> {
  const auth = await requireDelegationManager();
  if (!auth.ok) return fail(auth.error);

  const parsed = deleteDelegationSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }

  const admin = createAdminClient();
  const { error } = await admin
    .schema("palaro")
    .from("delegations")
    .update({ is_active: false })
    .eq("id", parsed.data.id);
  if (error) return fail(error.message);

  await recordAudit({
    action: "delete",
    entity_type: "delegation",
    entity_id: parsed.data.id,
    changes: { is_active: false },
    user_id: auth.profile.id,
  });

  revalidatePath(DELEGATIONS_PATH);
  return ok();
}
