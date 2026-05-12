"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions";
import {
  createGarbageCollectorSchema,
  createGarbageRuleSchema,
  createGarbageSchema,
  deleteGarbageCollectorSchema,
  deleteGarbageRuleSchema,
  deleteGarbageSchema,
  generateGarbageWeekSchema,
  markGarbageCancelledSchema,
  markGarbageCollectedSchema,
  markGarbageMissedSchema,
  markNoCollectionNeededSchema,
  unmarkGarbageCancelledSchema,
  requestGarbageCollectionSchema,
  toggleGarbageCollectedSchema,
  updateGarbageCollectorSchema,
  updateGarbageRuleSchema,
  updateGarbageSchema,
} from "@/lib/schemas/garbage";
import { recordAudit } from "./audit";
import { fail, ok, type ActionResult } from "./types";
import type { Database } from "@/types/database";

type GarbageRow = Database["palaro"]["Tables"]["garbage_collections"]["Row"];
type CollectorRow = Database["palaro"]["Tables"]["garbage_collectors"]["Row"];
type ScheduleRuleRow =
  Database["palaro"]["Tables"]["garbage_schedule_rules"]["Row"];

const GARBAGE_PATH = "/dashboard/logistics/garbage";
const GARBAGE_SETTINGS_PATH = "/dashboard/logistics/garbage/settings";

// Asia/Manila has no DST: a fixed +08:00 offset. Combining a Manila-local
// YYYY-MM-DD + HH:MM into UTC is just a fixed-offset subtraction.
const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;

function manilaLocalToUtcIso(ymd: string, hhmm: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const [h, mi] = hhmm.split(":").map(Number);
  return new Date(Date.UTC(y, m - 1, d, h, mi) - MANILA_OFFSET_MS).toISOString();
}

// time_of_day comes back from Postgres as "HH:MM:SS" (or "HH:MM:SS+00")
// — strip seconds/zone for Manila wall-clock combination.
function trimTimeOfDay(value: string): string {
  return value.slice(0, 5);
}

// ---------- Permission helpers ----------

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

// ============================================================
// Concrete pickups (garbage_collections)
// ============================================================

export async function getGarbageCollections(
  fromIso?: string,
  toIso?: string,
): Promise<ActionResult<GarbageRow[]>> {
  const auth = await requireGarbageLogger();
  if (!auth.ok) return fail(auth.error);

  const admin = createAdminClient();
  let q = admin
    .schema("palaro")
    .from("garbage_collections")
    .select("*")
    .order("scheduled_at", { ascending: true })
    .limit(1000);
  if (fromIso) q = q.gte("scheduled_at", fromIso);
  if (toIso) q = q.lt("scheduled_at", toIso);

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
      collector_id: data.collector_id ?? null,
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
      collector_id: data.collector_id ?? null,
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
      collector_id: data.collector_id ?? null,
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

// Single-tickbox toggle: marks a scheduled pickup collected, or reverts a
// collected one back to scheduled. Used by the weekly grid checkboxes.
export async function toggleGarbageCollected(
  input: unknown,
): Promise<ActionResult<void>> {
  const auth = await requireGarbageLogger();
  if (!auth.ok) return fail(auth.error);

  const parsed = toggleGarbageCollectedSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  const { id, collected } = parsed.data;
  const stamp = new Date().toISOString();

  const admin = createAdminClient();
  const { error } = await admin
    .schema("palaro")
    .from("garbage_collections")
    .update(
      collected
        ? { status: "collected", collected_at: stamp }
        : { status: "scheduled", collected_at: null },
    )
    .eq("id", id);
  if (error) return fail(error.message);

  await recordAudit({
    action: "update",
    entity_type: "garbage_collection",
    entity_id: id,
    changes: collected
      ? { status: "collected", collected_at: stamp }
      : { status: "scheduled", collected_at: null },
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

// Info Hub officer says today's pickup isn't needed for this BQ. Flips the
// row to no_collection_needed and stamps a note so the audit trail is clear.
export async function markNoCollectionNeeded(
  input: unknown,
): Promise<ActionResult<void>> {
  const auth = await requireGarbageLogger();
  if (!auth.ok) return fail(auth.error);

  const parsed = markNoCollectionNeededSchema.safeParse(input);
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
  const note = `[NO COLLECTION NEEDED ${stamp}] ${auth.profile.full_name ?? auth.profile.email}${reason ? `: ${reason}` : ""}`;
  const composedNotes = [existing?.notes, note].filter(Boolean).join("\n");

  const { error } = await admin
    .schema("palaro")
    .from("garbage_collections")
    .update({ status: "no_collection_needed", notes: composedNotes })
    .eq("id", id);
  if (error) return fail(error.message);

  await recordAudit({
    action: "update",
    entity_type: "garbage_collection",
    entity_id: id,
    changes: { status: "no_collection_needed", reason: reason ?? null },
    user_id: auth.profile.id,
  });

  revalidatePath(GARBAGE_PATH);
  return ok();
}

// Cancel a specific scheduled pickup (e.g. venue is closed today, athletes
// already left). Flips the row to "cancelled" and appends an audit note.
// Available to anyone with garbage.log — see unmarkGarbageCancelled for undo.
export async function markGarbageCancelled(
  input: unknown,
): Promise<ActionResult<void>> {
  const auth = await requireGarbageLogger();
  if (!auth.ok) return fail(auth.error);

  const parsed = markGarbageCancelledSchema.safeParse(input);
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
  const note = `[CANCELLED ${stamp}] ${auth.profile.full_name ?? auth.profile.email}${reason ? `: ${reason}` : ""}`;
  const composedNotes = [existing?.notes, note].filter(Boolean).join("\n");

  const { error } = await admin
    .schema("palaro")
    .from("garbage_collections")
    .update({ status: "cancelled", notes: composedNotes })
    .eq("id", id);
  if (error) return fail(error.message);

  await recordAudit({
    action: "update",
    entity_type: "garbage_collection",
    entity_id: id,
    changes: { status: "cancelled", reason: reason ?? null },
    user_id: auth.profile.id,
  });

  revalidatePath(GARBAGE_PATH);
  return ok();
}

// Undo a cancellation — flips the row back to "scheduled" and stamps an
// audit note so the trail records both directions.
export async function unmarkGarbageCancelled(
  input: unknown,
): Promise<ActionResult<void>> {
  const auth = await requireGarbageLogger();
  if (!auth.ok) return fail(auth.error);

  const parsed = unmarkGarbageCancelledSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  const { id } = parsed.data;

  const admin = createAdminClient();
  const { data: existing } = await admin
    .schema("palaro")
    .from("garbage_collections")
    .select("notes")
    .eq("id", id)
    .single();

  const stamp = new Date().toISOString();
  const note = `[CANCEL UNDONE ${stamp}] ${auth.profile.full_name ?? auth.profile.email}`;
  const composedNotes = [existing?.notes, note].filter(Boolean).join("\n");

  const { error } = await admin
    .schema("palaro")
    .from("garbage_collections")
    .update({ status: "scheduled", notes: composedNotes })
    .eq("id", id);
  if (error) return fail(error.message);

  await recordAudit({
    action: "update",
    entity_type: "garbage_collection",
    entity_id: id,
    changes: { status: "scheduled", from: "cancelled" },
    user_id: auth.profile.id,
  });

  revalidatePath(GARBAGE_PATH);
  return ok();
}

// Info Hub officer requests an on-demand garbage pickup for their BQ.
// Creates a special_request row that surfaces alongside scheduled rows.
export async function requestGarbageCollection(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const auth = await requireGarbageLogger();
  if (!auth.ok) return fail(auth.error);

  const parsed = requestGarbageCollectionSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  const data = parsed.data;
  const requestedIso = new Date(data.requested_at).toISOString();

  const admin = createAdminClient();
  const { data: inserted, error } = await admin
    .schema("palaro")
    .from("garbage_collections")
    .insert({
      site_id: data.site_id,
      collector_id: null,
      scheduled_at: requestedIso,
      status: "special_request",
      is_special_request: true,
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
      requested_at: requestedIso,
      is_special_request: true,
    },
    user_id: auth.profile.id,
  });

  revalidatePath(GARBAGE_PATH);
  return ok({ id: inserted.id });
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

// ============================================================
// Collectors registry (garbage_collectors)
// ============================================================

export async function getGarbageCollectors(
  includeInactive = false,
): Promise<ActionResult<CollectorRow[]>> {
  const auth = await requireGarbageLogger();
  if (!auth.ok) return fail(auth.error);

  const admin = createAdminClient();
  let q = admin
    .schema("palaro")
    .from("garbage_collectors")
    .select("*")
    .order("driver_name", { ascending: true });
  if (!includeInactive) q = q.eq("is_active", true);

  const { data, error } = await q;
  if (error) return fail(error.message);
  return ok(data ?? []);
}

export async function createGarbageCollector(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const auth = await requireGarbageManager();
  if (!auth.ok) return fail(auth.error);

  const parsed = createGarbageCollectorSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  const data = parsed.data;

  const admin = createAdminClient();
  const { data: inserted, error } = await admin
    .schema("palaro")
    .from("garbage_collectors")
    .insert({
      driver_name: data.driver_name,
      swm_coordinator_name: data.swm_coordinator_name || null,
      city_enro_coordinator_name: data.city_enro_coordinator_name || null,
      vehicle_description: data.vehicle_description || null,
      contact_number: data.contact_number || null,
      is_active: data.is_active ?? true,
      created_by: auth.profile.id,
    })
    .select("id")
    .single();
  if (error) return fail(error.message);

  await recordAudit({
    action: "create",
    entity_type: "garbage_collector",
    entity_id: inserted.id,
    changes: data,
    user_id: auth.profile.id,
  });

  revalidatePath(GARBAGE_SETTINGS_PATH);
  revalidatePath(GARBAGE_PATH);
  return ok({ id: inserted.id });
}

export async function updateGarbageCollector(
  input: unknown,
): Promise<ActionResult<void>> {
  const auth = await requireGarbageManager();
  if (!auth.ok) return fail(auth.error);

  const parsed = updateGarbageCollectorSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  const { id, ...data } = parsed.data;

  const admin = createAdminClient();
  const { error } = await admin
    .schema("palaro")
    .from("garbage_collectors")
    .update({
      driver_name: data.driver_name,
      swm_coordinator_name: data.swm_coordinator_name || null,
      city_enro_coordinator_name: data.city_enro_coordinator_name || null,
      vehicle_description: data.vehicle_description || null,
      contact_number: data.contact_number || null,
      is_active: data.is_active ?? true,
    })
    .eq("id", id);
  if (error) return fail(error.message);

  await recordAudit({
    action: "update",
    entity_type: "garbage_collector",
    entity_id: id,
    changes: data,
    user_id: auth.profile.id,
  });

  revalidatePath(GARBAGE_SETTINGS_PATH);
  revalidatePath(GARBAGE_PATH);
  return ok();
}

export async function deleteGarbageCollector(
  input: unknown,
): Promise<ActionResult<void>> {
  const auth = await requireGarbageManager();
  if (!auth.ok) return fail(auth.error);

  const parsed = deleteGarbageCollectorSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }

  const admin = createAdminClient();
  const { error } = await admin
    .schema("palaro")
    .from("garbage_collectors")
    .delete()
    .eq("id", parsed.data.id);
  if (error) return fail(error.message);

  await recordAudit({
    action: "delete",
    entity_type: "garbage_collector",
    entity_id: parsed.data.id,
    user_id: auth.profile.id,
  });

  revalidatePath(GARBAGE_SETTINGS_PATH);
  revalidatePath(GARBAGE_PATH);
  return ok();
}

// ============================================================
// Weekly schedule rules (garbage_schedule_rules)
// ============================================================

export async function getGarbageScheduleRules(
  includeInactive = false,
): Promise<ActionResult<ScheduleRuleRow[]>> {
  const auth = await requireGarbageLogger();
  if (!auth.ok) return fail(auth.error);

  const admin = createAdminClient();
  let q = admin
    .schema("palaro")
    .from("garbage_schedule_rules")
    .select("*")
    .order("time_of_day", { ascending: true });
  if (!includeInactive) q = q.eq("is_active", true);

  const { data, error } = await q;
  if (error) return fail(error.message);
  return ok(data ?? []);
}

export async function createGarbageScheduleRule(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const auth = await requireGarbageManager();
  if (!auth.ok) return fail(auth.error);

  const parsed = createGarbageRuleSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  const data = parsed.data;

  const admin = createAdminClient();
  const { data: inserted, error } = await admin
    .schema("palaro")
    .from("garbage_schedule_rules")
    .insert({
      collector_id: data.collector_id,
      site_id: data.site_id,
      days_of_week: Array.from(new Set(data.days_of_week)).sort(
        (a, b) => a - b,
      ),
      time_of_day: data.time_of_day,
      time_of_day_pm: data.time_of_day_pm || null,
      is_active: data.is_active ?? true,
      notes: data.notes || null,
      created_by: auth.profile.id,
    })
    .select("id")
    .single();
  if (error) return fail(error.message);

  await recordAudit({
    action: "create",
    entity_type: "garbage_schedule_rule",
    entity_id: inserted.id,
    changes: data,
    user_id: auth.profile.id,
  });

  revalidatePath(GARBAGE_SETTINGS_PATH);
  revalidatePath(GARBAGE_PATH);
  return ok({ id: inserted.id });
}

export async function updateGarbageScheduleRule(
  input: unknown,
): Promise<ActionResult<void>> {
  const auth = await requireGarbageManager();
  if (!auth.ok) return fail(auth.error);

  const parsed = updateGarbageRuleSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  const { id, ...data } = parsed.data;

  const admin = createAdminClient();
  const { error } = await admin
    .schema("palaro")
    .from("garbage_schedule_rules")
    .update({
      collector_id: data.collector_id,
      site_id: data.site_id,
      days_of_week: Array.from(new Set(data.days_of_week)).sort(
        (a, b) => a - b,
      ),
      time_of_day: data.time_of_day,
      time_of_day_pm: data.time_of_day_pm || null,
      is_active: data.is_active ?? true,
      notes: data.notes || null,
    })
    .eq("id", id);
  if (error) return fail(error.message);

  await recordAudit({
    action: "update",
    entity_type: "garbage_schedule_rule",
    entity_id: id,
    changes: data,
    user_id: auth.profile.id,
  });

  revalidatePath(GARBAGE_SETTINGS_PATH);
  revalidatePath(GARBAGE_PATH);
  return ok();
}

export async function deleteGarbageScheduleRule(
  input: unknown,
): Promise<ActionResult<void>> {
  const auth = await requireGarbageManager();
  if (!auth.ok) return fail(auth.error);

  const parsed = deleteGarbageRuleSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }

  const admin = createAdminClient();

  // Remove pending (not yet collected) rows generated from this rule.
  const { error: collectionsErr } = await admin
    .schema("palaro")
    .from("garbage_collections")
    .delete()
    .eq("schedule_rule_id", parsed.data.id)
    .eq("status", "scheduled");
  if (collectionsErr) return fail(collectionsErr.message);

  const { error } = await admin
    .schema("palaro")
    .from("garbage_schedule_rules")
    .delete()
    .eq("id", parsed.data.id);
  if (error) return fail(error.message);

  await recordAudit({
    action: "delete",
    entity_type: "garbage_schedule_rule",
    entity_id: parsed.data.id,
    user_id: auth.profile.id,
  });

  revalidatePath(GARBAGE_SETTINGS_PATH);
  revalidatePath(GARBAGE_PATH);
  return ok();
}

// ============================================================
// Week generation
// ============================================================

// Materialize one garbage_collections row per active rule for the given week
// (Manila-local Monday → Sunday). Idempotent: queries existing rows for the
// week and only inserts the missing (rule_id, scheduled_at) pairs. Already-
// generated rows are preserved untouched (users may have ticked them off).
//
// Returns the count of newly created rows.
export async function generateGarbageWeek(
  input: unknown,
): Promise<ActionResult<{ created: number }>> {
  const auth = await requireGarbageManager();
  if (!auth.ok) return fail(auth.error);

  const parsed = generateGarbageWeekSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  const { week_start } = parsed.data;

  const admin = createAdminClient();
  const { data: rules, error: rulesErr } = await admin
    .schema("palaro")
    .from("garbage_schedule_rules")
    .select("*")
    .eq("is_active", true);
  if (rulesErr) return fail(rulesErr.message);
  if (!rules || rules.length === 0) return ok({ created: 0 });

  // Map ISO day-of-week (1..7) → Manila YYYY-MM-DD for this week.
  const days: string[] = [];
  const [y, m, d] = week_start.split("-").map(Number);
  const monUtc = Date.UTC(y, m - 1, d);
  for (let i = 0; i < 7; i++) {
    const dt = new Date(monUtc + i * 24 * 60 * 60 * 1000);
    days.push(
      `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`,
    );
  }

  // Each rule fans out into (days_of_week × time slots). Multiple rows per
  // rule share the same rule_id but differ in scheduled_at.
  const targetRows = rules.flatMap((r) => {
    const dayList = (r.days_of_week ?? []).filter((d) => d >= 1 && d <= 7);
    const slots = [trimTimeOfDay(r.time_of_day)];
    if (r.time_of_day_pm) slots.push(trimTimeOfDay(r.time_of_day_pm));
    return dayList.flatMap((dow) => {
      const ymd = days[dow - 1];
      return slots.map((hhmm) => ({
        site_id: r.site_id,
        collector_id: r.collector_id,
        schedule_rule_id: r.id,
        scheduled_at: manilaLocalToUtcIso(ymd, hhmm),
        status: "scheduled" as const,
        is_special_request: false,
        logged_by: auth.profile.id,
      }));
    });
  });

  // Find which (rule_id, scheduled_at) combos already exist in the week so
  // we don't insert duplicates. Compare via epoch-ms so any string-format
  // drift between what we INSERT vs what Supabase returns can't slip past.
  const ruleIds = Array.from(
    new Set(targetRows.map((r) => r.schedule_rule_id)),
  );
  const weekStartUtc = new Date(monUtc - MANILA_OFFSET_MS).toISOString();
  const weekEndUtc = new Date(
    monUtc + 7 * 24 * 60 * 60 * 1000 - MANILA_OFFSET_MS,
  ).toISOString();

  const { data: existing, error: existingErr } = await admin
    .schema("palaro")
    .from("garbage_collections")
    .select("schedule_rule_id, scheduled_at")
    .in("schedule_rule_id", ruleIds)
    .gte("scheduled_at", weekStartUtc)
    .lt("scheduled_at", weekEndUtc);
  if (existingErr) return fail(existingErr.message);

  const keyOf = (ruleId: string | null, scheduledAt: string) =>
    `${ruleId}|${new Date(scheduledAt).getTime()}`;

  const existingKeys = new Set(
    (existing ?? []).map((r) => keyOf(r.schedule_rule_id, r.scheduled_at)),
  );
  const toInsert = targetRows.filter(
    (r) => !existingKeys.has(keyOf(r.schedule_rule_id, r.scheduled_at)),
  );

  if (toInsert.length === 0) return ok({ created: 0 });

  const { data: inserted, error } = await admin
    .schema("palaro")
    .from("garbage_collections")
    .insert(toInsert)
    .select("id");
  if (error) return fail(error.message);

  const created = inserted?.length ?? 0;
  if (created > 0) {
    await recordAudit({
      action: "create",
      entity_type: "garbage_week",
      entity_id: week_start,
      changes: { created, week_start },
      user_id: auth.profile.id,
    });
  }

  // No revalidatePath here: this action is invoked during the page's RSC
  // render, which Next.js 16 forbids. The caller fetches fresh rows
  // immediately after this returns, so revalidation is redundant anyway.
  return ok({ created });
}
