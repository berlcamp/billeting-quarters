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
  markGarbageCollectedSchema,
  markGarbageMissedSchema,
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
    .order("coordinator_name", { ascending: true });
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
      coordinator_name: data.coordinator_name,
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
      coordinator_name: data.coordinator_name,
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
    .order("day_of_week", { ascending: true })
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
      day_of_week: data.day_of_week,
      time_of_day: data.time_of_day,
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
      day_of_week: data.day_of_week,
      time_of_day: data.time_of_day,
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
// (Manila-local Monday → Sunday). Idempotent: re-running doesn't duplicate
// rows because of the (schedule_rule_id, scheduled_at) unique index.
//
// Returns the count of newly created rows. Existing rows are not touched —
// users may have already ticked them off.
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

  const rows = rules.map((r) => {
    const ymd = days[r.day_of_week - 1];
    const hhmm = trimTimeOfDay(r.time_of_day);
    return {
      site_id: r.site_id,
      collector_id: r.collector_id,
      schedule_rule_id: r.id,
      scheduled_at: manilaLocalToUtcIso(ymd, hhmm),
      status: "scheduled" as const,
      is_special_request: false,
      logged_by: auth.profile.id,
    };
  });

  // onConflict matches the partial unique index uq_garbage_collections_rule_time.
  // ignoreDuplicates so already-generated rows (possibly already ticked off)
  // are preserved untouched.
  const { data: inserted, error } = await admin
    .schema("palaro")
    .from("garbage_collections")
    .upsert(rows, {
      onConflict: "schedule_rule_id,scheduled_at",
      ignoreDuplicates: true,
    })
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

  revalidatePath(GARBAGE_PATH);
  return ok({ created });
}
