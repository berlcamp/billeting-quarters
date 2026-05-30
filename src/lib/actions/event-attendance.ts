"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions";
import {
  createEventSchema,
  deleteEventSchema,
  manualEventAttendanceSchema,
  scanEventAttendanceSchema,
  updateEventSchema,
} from "@/lib/schemas/event-attendance";
import { recordAudit } from "./audit";
import { fail, ok, type ActionResult } from "./types";
import type { Database } from "@/types/database";

type EventRow = Database["palaro"]["Tables"]["events"]["Row"];
type EventAttendanceLog =
  Database["palaro"]["Tables"]["event_attendance_logs"]["Row"];

const LIST_PATH = "/dashboard/personnel/event-attendance";
const detailPath = (eventId: string) =>
  `/dashboard/personnel/event-attendance/${eventId}`;

// A log row joined with the resolved personnel identity (for QR-scanned rows).
export type EventAttendanceLogWithPerson = EventAttendanceLog & {
  personnel: {
    full_name: string;
    committee: string;
    designation: string | null;
    photo_url: string | null;
  } | null;
};

export type EventWithCount = EventRow & { attendance_count: number };

// "manage" = create/edit/delete events. "record" = scan or manually log time-in.
async function requireEventManager() {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false as const, error: "Not authenticated." };
  if (!hasPermission(profile, "event_attendance.manage")) {
    return {
      ok: false as const,
      error: "You don't have permission to manage events.",
    };
  }
  return { ok: true as const, profile };
}

async function requireEventRecorder() {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false as const, error: "Not authenticated." };
  if (
    !hasPermission(profile, "event_attendance.record") &&
    !hasPermission(profile, "event_attendance.manage")
  ) {
    return {
      ok: false as const,
      error: "You don't have permission to record event attendance.",
    };
  }
  return { ok: true as const, profile };
}

// =============================================================================
// EVENT CRUD
// =============================================================================

export async function getEvents(
  includeInactive = false,
): Promise<ActionResult<EventWithCount[]>> {
  const auth = await requireEventRecorder();
  if (!auth.ok) return fail(auth.error);

  const admin = createAdminClient();
  let q = admin
    .schema("palaro")
    .from("events")
    .select("*")
    .order("created_at", { ascending: false });
  if (!includeInactive) q = q.eq("is_active", true);

  const { data: events, error } = await q;
  if (error) return fail(error.message);

  const list = events ?? [];
  const counts = new Map<string, number>();
  if (list.length > 0) {
    const { data: logRows } = await admin
      .schema("palaro")
      .from("event_attendance_logs")
      .select("event_id")
      .in(
        "event_id",
        list.map((e) => e.id),
      );
    for (const row of logRows ?? []) {
      counts.set(row.event_id, (counts.get(row.event_id) ?? 0) + 1);
    }
  }

  return ok(
    list.map((e) => ({ ...e, attendance_count: counts.get(e.id) ?? 0 })),
  );
}

export async function getEvent(id: string): Promise<ActionResult<EventRow>> {
  const auth = await requireEventRecorder();
  if (!auth.ok) return fail(auth.error);

  const admin = createAdminClient();
  const { data, error } = await admin
    .schema("palaro")
    .from("events")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) return fail(error.message);
  if (!data) return fail("Event not found.");
  return ok(data);
}

export async function createEvent(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const auth = await requireEventManager();
  if (!auth.ok) return fail(auth.error);

  const parsed = createEventSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  const data = parsed.data;

  const admin = createAdminClient();
  const { data: inserted, error } = await admin
    .schema("palaro")
    .from("events")
    .insert({
      name: data.name,
      description: data.description ?? null,
      location: data.location ?? null,
      event_date: data.event_date ?? null,
      created_by: auth.profile.id,
    })
    .select("id")
    .single();
  if (error) return fail(error.message);

  await recordAudit({
    action: "create",
    entity_type: "event",
    entity_id: inserted.id,
    changes: { name: data.name },
    user_id: auth.profile.id,
  });

  revalidatePath(LIST_PATH);
  return ok({ id: inserted.id });
}

export async function updateEvent(input: unknown): Promise<ActionResult> {
  const auth = await requireEventManager();
  if (!auth.ok) return fail(auth.error);

  const parsed = updateEventSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  const { id, ...data } = parsed.data;

  const admin = createAdminClient();
  const { error } = await admin
    .schema("palaro")
    .from("events")
    .update({
      name: data.name,
      description: data.description ?? null,
      location: data.location ?? null,
      event_date: data.event_date ?? null,
    })
    .eq("id", id);
  if (error) return fail(error.message);

  await recordAudit({
    action: "update",
    entity_type: "event",
    entity_id: id,
    changes: { name: data.name },
    user_id: auth.profile.id,
  });

  revalidatePath(LIST_PATH);
  revalidatePath(detailPath(id));
  return ok(undefined);
}

// Soft-delete — attendance history is preserved.
export async function deleteEvent(input: unknown): Promise<ActionResult> {
  const auth = await requireEventManager();
  if (!auth.ok) return fail(auth.error);

  const parsed = deleteEventSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }

  const admin = createAdminClient();
  const { error } = await admin
    .schema("palaro")
    .from("events")
    .update({ is_active: false })
    .eq("id", parsed.data.id);
  if (error) return fail(error.message);

  await recordAudit({
    action: "delete",
    entity_type: "event",
    entity_id: parsed.data.id,
    user_id: auth.profile.id,
  });

  revalidatePath(LIST_PATH);
  return ok(undefined);
}

// =============================================================================
// ATTENDANCE LOGGING
// =============================================================================

// Higher row cap than a typical list — a popular event can exceed 500 time-ins.
const LOG_ROW_CAP = 10000;

export async function getEventAttendanceLogs(
  eventId: string,
): Promise<ActionResult<EventAttendanceLogWithPerson[]>> {
  const auth = await requireEventRecorder();
  if (!auth.ok) return fail(auth.error);

  const admin = createAdminClient();
  const { data, error } = await admin
    .schema("palaro")
    .from("event_attendance_logs")
    .select(
      "*, personnel:personnel_id (full_name, committee, designation, photo_url)",
    )
    .eq("event_id", eventId)
    .order("time_in", { ascending: false })
    .limit(LOG_ROW_CAP);
  if (error) return fail(error.message);
  return ok((data ?? []) as unknown as EventAttendanceLogWithPerson[]);
}

// QR scan path. Duplicates are allowed by design — every scan inserts a row.
export async function scanEventAttendance(input: unknown): Promise<
  ActionResult<{
    id: string;
    full_name: string | null;
    photo_url: string | null;
  }>
> {
  const auth = await requireEventRecorder();
  if (!auth.ok) return fail(auth.error);

  const parsed = scanEventAttendanceSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  const { event_id, scanned_value } = parsed.data;

  // The QR encodes {"v":1,"id":"<uuid>"}; older/hand-typed values may be a raw
  // UUID — accept both. (Mirrors scanAttendance in personnel.ts.)
  let personnelId: string | null = null;
  if (/^[0-9a-fA-F-]{36}$/.test(scanned_value.trim())) {
    personnelId = scanned_value.trim();
  } else {
    try {
      const env = JSON.parse(scanned_value) as { v?: number; id?: string };
      if (env?.id && /^[0-9a-fA-F-]{36}$/.test(env.id)) {
        personnelId = env.id;
      }
    } catch {
      // fall through
    }
  }
  if (!personnelId) {
    return fail("Scan value is not a recognized Palaro Bayugan Command ID.");
  }

  const admin = createAdminClient();

  // Guard against logging into a deleted event.
  const { data: event } = await admin
    .schema("palaro")
    .from("events")
    .select("id, is_active")
    .eq("id", event_id)
    .maybeSingle();
  if (!event || !event.is_active) {
    return fail("Event not found or no longer active.");
  }

  const { data: target } = await admin
    .schema("palaro")
    .from("personnel")
    .select("id, full_name, is_active, photo_url")
    .eq("id", personnelId)
    .maybeSingle();
  if (!target) return fail("Personnel not found for scanned ID.");
  if (!target.is_active) return fail("That personnel record is inactive.");

  const { data: inserted, error } = await admin
    .schema("palaro")
    .from("event_attendance_logs")
    .insert({
      event_id,
      personnel_id: personnelId,
      recorded_by: auth.profile.id,
    })
    .select("id")
    .single();
  if (error) return fail(error.message);

  await recordAudit({
    action: "create",
    entity_type: "event_attendance_log",
    entity_id: inserted.id,
    changes: { event_id, personnel_id: personnelId, via: "qr_scan" },
    user_id: auth.profile.id,
  });

  revalidatePath(detailPath(event_id));
  return ok({
    id: inserted.id,
    full_name: target.full_name,
    photo_url: target.photo_url,
  });
}

// Manual entry for a guest not yet in the personnel table.
export async function logManualEventAttendance(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const auth = await requireEventRecorder();
  if (!auth.ok) return fail(auth.error);

  const parsed = manualEventAttendanceSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  const { event_id, full_name, committee, designation } = parsed.data;

  const admin = createAdminClient();

  const { data: event } = await admin
    .schema("palaro")
    .from("events")
    .select("id, is_active")
    .eq("id", event_id)
    .maybeSingle();
  if (!event || !event.is_active) {
    return fail("Event not found or no longer active.");
  }

  const { data: inserted, error } = await admin
    .schema("palaro")
    .from("event_attendance_logs")
    .insert({
      event_id,
      guest_name: full_name,
      guest_committee: committee ?? null,
      guest_designation: designation ?? null,
      recorded_by: auth.profile.id,
    })
    .select("id")
    .single();
  if (error) return fail(error.message);

  await recordAudit({
    action: "create",
    entity_type: "event_attendance_log",
    entity_id: inserted.id,
    changes: { event_id, guest_name: full_name, via: "manual" },
    user_id: auth.profile.id,
  });

  revalidatePath(detailPath(event_id));
  return ok({ id: inserted.id });
}
