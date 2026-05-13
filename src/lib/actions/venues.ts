"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions";
import {
  approveScheduleSchema,
  cancelScheduleSchema,
  completeScheduleSchema,
  createScheduleSchema,
  deleteScheduleSchema,
  updateScheduleSchema,
} from "@/lib/schemas/venues";
import { recordAudit } from "./audit";
import { fail, ok, type ActionResult } from "./types";
import type { Database } from "@/types/database";

type Schedule = Database["palaro"]["Tables"]["venue_schedules"]["Row"];

const VENUES_PATH = "/dashboard/venues";

async function requireBooker() {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false as const, error: "Not authenticated." };
  if (
    !hasPermission(profile, "venue.book") &&
    !hasPermission(profile, "venue.approve_special")
  ) {
    return {
      ok: false as const,
      error: "You don't have permission to book venues.",
    };
  }
  return { ok: true as const, profile };
}

async function requireApprover() {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false as const, error: "Not authenticated." };
  if (!hasPermission(profile, "venue.approve_special")) {
    return {
      ok: false as const,
      error: "You don't have permission to approve special requests.",
    };
  }
  return { ok: true as const, profile };
}

// Returns true if the proposed slot overlaps any active (non-cancelled) booking
// at the same venue AND court. Special-request slots also count as conflicts.
async function findConflict(opts: {
  venueId: string;
  courtNumber: number;
  start: string;
  end: string;
  excludeId?: string;
}): Promise<Schedule | null> {
  const admin = createAdminClient();
  let q = admin
    .schema("palaro")
    .from("venue_schedules")
    .select("*")
    .eq("venue_id", opts.venueId)
    .eq("court_number", opts.courtNumber)
    .neq("status", "cancelled")
    .lt("scheduled_start", opts.end)
    .gt("scheduled_end", opts.start);
  if (opts.excludeId) q = q.neq("id", opts.excludeId);
  const { data } = await q.limit(1).maybeSingle();
  return data ?? null;
}

export async function getSchedules(
  fromIso?: string,
  toIso?: string,
): Promise<ActionResult<Schedule[]>> {
  const profile = await getCurrentProfile();
  if (!profile) return fail("Not authenticated.");

  const admin = createAdminClient();
  let q = admin
    .schema("palaro")
    .from("venue_schedules")
    .select("*")
    .order("scheduled_start", { ascending: true })
    .limit(1000);
  if (fromIso) q = q.gte("scheduled_start", fromIso);
  if (toIso) q = q.lt("scheduled_start", toIso);

  const { data, error } = await q;
  if (error) return fail(error.message);
  return ok(data ?? []);
}

export async function createSchedule(
  input: unknown,
): Promise<ActionResult<{ id: string; conflict: boolean }>> {
  const auth = await requireBooker();
  if (!auth.ok) return fail(auth.error);

  const parsed = createScheduleSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  const data = parsed.data;

  const startIso = new Date(data.scheduled_start).toISOString();
  const endIso = new Date(data.scheduled_end).toISOString();

  const admin = createAdminClient();

  // Confirm venue is a playing venue.
  const { data: venue } = await admin
    .schema("palaro")
    .from("sites")
    .select("id, site_type, name")
    .eq("id", data.venue_id)
    .single();
  if (!venue) return fail("Venue not found.");
  if (venue.site_type !== "playing_venue") {
    return fail("Selected site is not a playing venue.");
  }

  const conflict = await findConflict({
    venueId: data.venue_id,
    courtNumber: data.court_number,
    start: startIso,
    end: endIso,
  });

  // Conflicts are blocked unless the booker explicitly marks this as a
  // special request (which requires a reason and command-center approval).
  if (conflict && !data.is_special_request) {
    return fail(
      `Court ${data.court_number} at this venue is already booked from ${conflict.scheduled_start.slice(11, 16)}–${conflict.scheduled_end.slice(11, 16)}. Pick another court, or mark this as a special request to override.`,
    );
  }

  const status: Database["palaro"]["Enums"]["schedule_status"] =
    data.is_special_request ? "special_request" : "booked";

  const { data: inserted, error } = await admin
    .schema("palaro")
    .from("venue_schedules")
    .insert({
      venue_id: data.venue_id,
      delegation_id: data.delegation_id,
      sport: data.sport || null,
      court_number: data.court_number,
      scheduled_start: startIso,
      scheduled_end: endIso,
      status,
      is_special_request: data.is_special_request ?? false,
      special_request_reason: data.special_request_reason || null,
      booked_by: auth.profile.id,
      notes: data.notes || null,
    })
    .select("id")
    .single();
  if (error) return fail(error.message);

  await recordAudit({
    action: "create",
    entity_type: "venue_schedule",
    entity_id: inserted.id,
    changes: {
      venue_id: data.venue_id,
      delegation_id: data.delegation_id,
      scheduled_start: startIso,
      scheduled_end: endIso,
      status,
    },
    user_id: auth.profile.id,
  });

  revalidatePath(VENUES_PATH);
  return ok({ id: inserted.id, conflict: !!conflict });
}

export async function updateSchedule(
  input: unknown,
): Promise<ActionResult<void>> {
  const auth = await requireBooker();
  if (!auth.ok) return fail(auth.error);

  const parsed = updateScheduleSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  const { id, ...data } = parsed.data;

  const startIso = new Date(data.scheduled_start).toISOString();
  const endIso = new Date(data.scheduled_end).toISOString();

  const conflict = await findConflict({
    venueId: data.venue_id,
    courtNumber: data.court_number,
    start: startIso,
    end: endIso,
    excludeId: id,
  });
  if (conflict && !data.is_special_request) {
    return fail(
      `Court ${data.court_number} at this venue is already booked in that window.`,
    );
  }

  const admin = createAdminClient();
  const { error } = await admin
    .schema("palaro")
    .from("venue_schedules")
    .update({
      venue_id: data.venue_id,
      delegation_id: data.delegation_id,
      sport: data.sport || null,
      court_number: data.court_number,
      scheduled_start: startIso,
      scheduled_end: endIso,
      is_special_request: data.is_special_request ?? false,
      special_request_reason: data.special_request_reason || null,
      notes: data.notes || null,
    })
    .eq("id", id);
  if (error) return fail(error.message);

  await recordAudit({
    action: "update",
    entity_type: "venue_schedule",
    entity_id: id,
    changes: { scheduled_start: startIso, scheduled_end: endIso },
    user_id: auth.profile.id,
  });

  revalidatePath(VENUES_PATH);
  return ok();
}

export async function cancelSchedule(
  input: unknown,
): Promise<ActionResult<void>> {
  const auth = await requireBooker();
  if (!auth.ok) return fail(auth.error);

  const parsed = cancelScheduleSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }

  const admin = createAdminClient();
  const { data: existing } = await admin
    .schema("palaro")
    .from("venue_schedules")
    .select("notes, status")
    .eq("id", parsed.data.id)
    .single();
  if (!existing) return fail("Schedule not found.");
  if (existing.status === "cancelled") return fail("Already cancelled.");

  const stamp = new Date().toISOString();
  const cancelLine = `[CANCEL ${stamp}] ${auth.profile.full_name ?? auth.profile.email}${
    parsed.data.reason ? `: ${parsed.data.reason}` : ""
  }`;
  const composedNotes = [existing.notes, cancelLine].filter(Boolean).join("\n");

  const { error } = await admin
    .schema("palaro")
    .from("venue_schedules")
    .update({ status: "cancelled", notes: composedNotes })
    .eq("id", parsed.data.id);
  if (error) return fail(error.message);

  await recordAudit({
    action: "update",
    entity_type: "venue_schedule",
    entity_id: parsed.data.id,
    changes: { status: "cancelled", reason: parsed.data.reason ?? null },
    user_id: auth.profile.id,
  });

  revalidatePath(VENUES_PATH);
  return ok();
}

// Approve a special-request slot — converts it from special_request → booked.
export async function approveSchedule(
  input: unknown,
): Promise<ActionResult<void>> {
  const auth = await requireApprover();
  if (!auth.ok) return fail(auth.error);

  const parsed = approveScheduleSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }

  const admin = createAdminClient();
  const { error } = await admin
    .schema("palaro")
    .from("venue_schedules")
    .update({
      status: "booked",
      approved_by: auth.profile.id,
      approved_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.id)
    .eq("status", "special_request");
  if (error) return fail(error.message);

  await recordAudit({
    action: "update",
    entity_type: "venue_schedule",
    entity_id: parsed.data.id,
    changes: { status: "booked", approved_by: auth.profile.id },
    user_id: auth.profile.id,
  });

  revalidatePath(VENUES_PATH);
  return ok();
}

// Hard-delete a schedule. Audit-logged. Cancellation lives in cancelSchedule —
// this is for the operator-initiated "remove from calendar" action.
export async function deleteSchedule(
  input: unknown,
): Promise<ActionResult<void>> {
  const auth = await requireBooker();
  if (!auth.ok) return fail(auth.error);

  const parsed = deleteScheduleSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }

  const admin = createAdminClient();
  const { data: existing } = await admin
    .schema("palaro")
    .from("venue_schedules")
    .select("venue_id, delegation_id, court_number, scheduled_start, scheduled_end")
    .eq("id", parsed.data.id)
    .single();
  if (!existing) return fail("Schedule not found.");

  const { error } = await admin
    .schema("palaro")
    .from("venue_schedules")
    .delete()
    .eq("id", parsed.data.id);
  if (error) return fail(error.message);

  await recordAudit({
    action: "delete",
    entity_type: "venue_schedule",
    entity_id: parsed.data.id,
    changes: existing,
    user_id: auth.profile.id,
  });

  revalidatePath(VENUES_PATH);
  return ok();
}

export async function completeSchedule(
  input: unknown,
): Promise<ActionResult<void>> {
  const auth = await requireBooker();
  if (!auth.ok) return fail(auth.error);

  const parsed = completeScheduleSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }

  const admin = createAdminClient();
  const { error } = await admin
    .schema("palaro")
    .from("venue_schedules")
    .update({ status: "completed" })
    .eq("id", parsed.data.id);
  if (error) return fail(error.message);

  await recordAudit({
    action: "update",
    entity_type: "venue_schedule",
    entity_id: parsed.data.id,
    changes: { status: "completed" },
    user_id: auth.profile.id,
  });

  revalidatePath(VENUES_PATH);
  return ok();
}
