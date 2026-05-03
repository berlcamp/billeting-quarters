"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions";
import {
  createGarbageSchema,
  deleteGarbageSchema,
  markGarbageCollectedSchema,
  markGarbageMissedSchema,
  updateGarbageSchema,
} from "@/lib/schemas/garbage";
import { recordAudit } from "./audit";
import { fail, ok, type ActionResult } from "./types";
import type { Database } from "@/types/database";

type GarbageRow = Database["palaro"]["Tables"]["garbage_collections"]["Row"];

const GARBAGE_PATH = "/dashboard/logistics/garbage";

async function requireGarbageManager() {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false as const, error: "Not authenticated." };
  if (!hasPermission(profile, "garbage.manage")) {
    return {
      ok: false as const,
      error: "You don't have permission to manage garbage collection.",
    };
  }
  return { ok: true as const, profile };
}

async function requireGarbageLogger() {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false as const, error: "Not authenticated." };
  if (
    !hasPermission(profile, "garbage.log") &&
    !hasPermission(profile, "garbage.manage")
  ) {
    return {
      ok: false as const,
      error: "You don't have permission to log garbage collection.",
    };
  }
  return { ok: true as const, profile };
}

export async function getGarbageCollections(
  fromIso?: string,
): Promise<ActionResult<GarbageRow[]>> {
  const auth = await requireGarbageLogger();
  if (!auth.ok) return fail(auth.error);

  const admin = createAdminClient();
  let q = admin
    .schema("palaro")
    .from("garbage_collections")
    .select("*")
    .order("scheduled_at", { ascending: false })
    .limit(500);
  if (fromIso) q = q.gte("scheduled_at", fromIso);

  const { data, error } = await q;
  if (error) return fail(error.message);
  return ok(data ?? []);
}

export async function createGarbageCollection(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const auth = await requireGarbageManager();
  if (!auth.ok) return fail(auth.error);

  const parsed = createGarbageSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  const data = parsed.data;
  const scheduledIso = new Date(data.scheduled_at).toISOString();

  const admin = createAdminClient();
  const { data: inserted, error } = await admin
    .schema("palaro")
    .from("garbage_collections")
    .insert({
      site_id: data.site_id,
      scheduled_at: scheduledIso,
      status: data.is_special_request ? "special_request" : "scheduled",
      is_special_request: data.is_special_request ?? false,
      collector_name: data.collector_name || null,
      notes: data.notes || null,
      logged_by: auth.profile.id,
    })
    .select("id")
    .single();
  if (error) return fail(error.message);

  await recordAudit({
    action: "create",
    entity_type: "garbage_collection",
    entity_id: inserted.id,
    changes: {
      site_id: data.site_id,
      scheduled_at: scheduledIso,
      is_special_request: data.is_special_request ?? false,
    },
    user_id: auth.profile.id,
  });

  revalidatePath(GARBAGE_PATH);
  return ok({ id: inserted.id });
}

export async function updateGarbageCollection(
  input: unknown,
): Promise<ActionResult<void>> {
  const auth = await requireGarbageManager();
  if (!auth.ok) return fail(auth.error);

  const parsed = updateGarbageSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  const { id, ...data } = parsed.data;
  const scheduledIso = new Date(data.scheduled_at).toISOString();

  const admin = createAdminClient();
  const { error } = await admin
    .schema("palaro")
    .from("garbage_collections")
    .update({
      site_id: data.site_id,
      scheduled_at: scheduledIso,
      is_special_request: data.is_special_request ?? false,
      collector_name: data.collector_name || null,
      notes: data.notes || null,
    })
    .eq("id", id);
  if (error) return fail(error.message);

  await recordAudit({
    action: "update",
    entity_type: "garbage_collection",
    entity_id: id,
    changes: { site_id: data.site_id, scheduled_at: scheduledIso },
    user_id: auth.profile.id,
  });

  revalidatePath(GARBAGE_PATH);
  return ok();
}

export async function markGarbageCollected(
  input: unknown,
): Promise<ActionResult<void>> {
  const auth = await requireGarbageLogger();
  if (!auth.ok) return fail(auth.error);

  const parsed = markGarbageCollectedSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  const { id, collector_name, notes } = parsed.data;

  const admin = createAdminClient();
  const { data: existing } = await admin
    .schema("palaro")
    .from("garbage_collections")
    .select("notes")
    .eq("id", id)
    .single();

  const stamp = new Date().toISOString();
  const note = `[COLLECTED ${stamp}] ${auth.profile.full_name ?? auth.profile.email}${notes ? `: ${notes}` : ""}`;
  const composedNotes = [existing?.notes, note].filter(Boolean).join("\n");

  const { error } = await admin
    .schema("palaro")
    .from("garbage_collections")
    .update({
      status: "collected",
      collected_at: stamp,
      collector_name: collector_name ?? undefined,
      notes: composedNotes,
    })
    .eq("id", id);
  if (error) return fail(error.message);

  await recordAudit({
    action: "update",
    entity_type: "garbage_collection",
    entity_id: id,
    changes: { status: "collected", collected_at: stamp },
    user_id: auth.profile.id,
  });

  revalidatePath(GARBAGE_PATH);
  return ok();
}

export async function markGarbageMissed(
  input: unknown,
): Promise<ActionResult<void>> {
  const auth = await requireGarbageLogger();
  if (!auth.ok) return fail(auth.error);

  const parsed = markGarbageMissedSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  const { id, reason } = parsed.data;

  const admin = createAdminClient();
  const { data: existing } = await admin
    .schema("palaro")
    .from("garbage_collections")
    .select("notes")
    .eq("id", id)
    .single();

  const stamp = new Date().toISOString();
  const note = `[MISSED ${stamp}] ${auth.profile.full_name ?? auth.profile.email}${reason ? `: ${reason}` : ""}`;
  const composedNotes = [existing?.notes, note].filter(Boolean).join("\n");

  const { error } = await admin
    .schema("palaro")
    .from("garbage_collections")
    .update({ status: "missed", notes: composedNotes })
    .eq("id", id);
  if (error) return fail(error.message);

  await recordAudit({
    action: "update",
    entity_type: "garbage_collection",
    entity_id: id,
    changes: { status: "missed", reason: reason ?? null },
    user_id: auth.profile.id,
  });

  revalidatePath(GARBAGE_PATH);
  return ok();
}

export async function deleteGarbageCollection(
  input: unknown,
): Promise<ActionResult<void>> {
  const auth = await requireGarbageManager();
  if (!auth.ok) return fail(auth.error);

  const parsed = deleteGarbageSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }

  const admin = createAdminClient();
  const { error } = await admin
    .schema("palaro")
    .from("garbage_collections")
    .delete()
    .eq("id", parsed.data.id);
  if (error) return fail(error.message);

  await recordAudit({
    action: "delete",
    entity_type: "garbage_collection",
    entity_id: parsed.data.id,
    user_id: auth.profile.id,
  });

  revalidatePath(GARBAGE_PATH);
  return ok();
}
