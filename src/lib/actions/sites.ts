"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions";
import {
  createSiteSchema,
  deleteSiteSchema,
  updateSiteSchema,
} from "@/lib/schemas/sites";
import { recordAudit } from "./audit";
import { fail, ok, type ActionResult } from "./types";
import type { Database } from "@/types/database";

type Site = Database["palaro"]["Tables"]["sites"]["Row"];

const SITES_PATH = "/dashboard/admin/sites";
const DELEGATIONS_PATH = "/dashboard/admin/delegations";

async function requireSiteManager() {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false as const, error: "Not authenticated." };
  if (!hasPermission(profile, "sites.manage")) {
    return { ok: false as const, error: "You don't have permission to manage sites." };
  }
  return { ok: true as const, profile };
}

export async function getSites(includeInactive = false): Promise<ActionResult<Site[]>> {
  // Public-ish read for any authenticated user — site lists feed many parts of the app.
  const profile = await getCurrentProfile();
  if (!profile) return fail("Not authenticated.");

  const admin = createAdminClient();
  let q = admin.schema("palaro").from("sites").select("*").order("name");
  if (!includeInactive) q = q.eq("is_active", true);
  const { data, error } = await q;
  if (error) return fail(error.message);
  return ok(data ?? []);
}

export async function createSite(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const auth = await requireSiteManager();
  if (!auth.ok) return fail(auth.error);

  const parsed = createSiteSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  const data = parsed.data;

  const admin = createAdminClient();
  const { data: inserted, error } = await admin
    .schema("palaro")
    .from("sites")
    .insert({
      name: data.name,
      site_type: data.site_type,
      address: data.address || null,
      contact_person: data.contact_person || null,
      contact_number: data.contact_number || null,
      capacity: data.capacity ?? null,
      latitude: data.latitude ?? null,
      longitude: data.longitude ?? null,
      notes: data.notes || null,
    })
    .select("id")
    .single();

  if (error) return fail(error.message);

  await recordAudit({
    action: "create",
    entity_type: "site",
    entity_id: inserted.id,
    changes: { name: data.name, site_type: data.site_type },
    user_id: auth.profile.id,
  });

  revalidatePath(SITES_PATH);
  revalidatePath(DELEGATIONS_PATH); // delegations reference BQ sites
  return ok({ id: inserted.id });
}

export async function updateSite(input: unknown): Promise<ActionResult<void>> {
  const auth = await requireSiteManager();
  if (!auth.ok) return fail(auth.error);

  const parsed = updateSiteSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  const { id, ...data } = parsed.data;

  const admin = createAdminClient();
  const { error } = await admin
    .schema("palaro")
    .from("sites")
    .update({
      name: data.name,
      site_type: data.site_type,
      address: data.address || null,
      contact_person: data.contact_person || null,
      contact_number: data.contact_number || null,
      capacity: data.capacity ?? null,
      latitude: data.latitude ?? null,
      longitude: data.longitude ?? null,
      notes: data.notes || null,
    })
    .eq("id", id);
  if (error) return fail(error.message);

  await recordAudit({
    action: "update",
    entity_type: "site",
    entity_id: id,
    changes: { name: data.name, site_type: data.site_type },
    user_id: auth.profile.id,
  });

  revalidatePath(SITES_PATH);
  revalidatePath(DELEGATIONS_PATH);
  return ok();
}

// Soft delete — flips is_active=false. Records are preserved (medical retention rules).
export async function deleteSite(input: unknown): Promise<ActionResult<void>> {
  const auth = await requireSiteManager();
  if (!auth.ok) return fail(auth.error);

  const parsed = deleteSiteSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }

  const admin = createAdminClient();
  const { error } = await admin
    .schema("palaro")
    .from("sites")
    .update({ is_active: false })
    .eq("id", parsed.data.id);
  if (error) return fail(error.message);

  await recordAudit({
    action: "delete",
    entity_type: "site",
    entity_id: parsed.data.id,
    changes: { is_active: false },
    user_id: auth.profile.id,
  });

  revalidatePath(SITES_PATH);
  revalidatePath(DELEGATIONS_PATH);
  return ok();
}
