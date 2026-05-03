"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions";
import {
  createDutySchema,
  deleteDutySchema,
  recordAttendanceSchema,
  scanAttendanceSchema,
  updateDutySchema,
} from "@/lib/schemas/personnel";
import { recordAudit } from "./audit";
import { fail, ok, type ActionResult } from "./types";
import type { Database } from "@/types/database";

type Profile = Database["palaro"]["Tables"]["profiles"]["Row"];
type Duty = Database["palaro"]["Tables"]["duty_schedules"]["Row"];
type AttendanceLog = Database["palaro"]["Tables"]["attendance_logs"]["Row"];
type AttendanceType = Database["palaro"]["Enums"]["attendance_type"];

const DUTY_PATH = "/dashboard/personnel/duty";
const ATTENDANCE_PATH = "/dashboard/personnel/attendance";

async function requirePersonnelManager() {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false as const, error: "Not authenticated." };
  if (!hasPermission(profile, "personnel.manage")) {
    return {
      ok: false as const,
      error: "You don't have permission to manage personnel.",
    };
  }
  return { ok: true as const, profile };
}

async function requireAttendanceRecorder() {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false as const, error: "Not authenticated." };
  if (
    !hasPermission(profile, "attendance.record") &&
    !hasPermission(profile, "personnel.manage")
  ) {
    return {
      ok: false as const,
      error: "You don't have permission to record attendance.",
    };
  }
  return { ok: true as const, profile };
}

// =============================================================================
// PERSONNEL LISTING
// =============================================================================

export async function getPersonnel(): Promise<ActionResult<Profile[]>> {
  const auth = await requirePersonnelManager();
  if (!auth.ok) return fail(auth.error);

  const admin = createAdminClient();
  // Active profiles only — duty + attendance only meaningful for live staff.
  const { data, error } = await admin
    .schema("palaro")
    .from("profiles")
    .select("*")
    .eq("status", "active")
    .order("full_name", { nullsFirst: false });
  if (error) return fail(error.message);
  return ok(data ?? []);
}

// Lightweight listing — readable by anyone with attendance.record so the
// scan/manual-entry UI can resolve a scanned profile id to a display name.
export async function getPersonnelForAttendance(): Promise<
  ActionResult<Pick<Profile, "id" | "full_name" | "email" | "role" | "agency">[]>
> {
  const auth = await requireAttendanceRecorder();
  if (!auth.ok) return fail(auth.error);

  const admin = createAdminClient();
  const { data, error } = await admin
    .schema("palaro")
    .from("profiles")
    .select("id, full_name, email, role, agency")
    .eq("status", "active")
    .order("full_name", { nullsFirst: false });
  if (error) return fail(error.message);
  return ok(data ?? []);
}

// =============================================================================
// DUTY SCHEDULES
// =============================================================================

export async function getDutySchedules(
  fromIso?: string,
): Promise<ActionResult<Duty[]>> {
  const auth = await requirePersonnelManager();
  if (!auth.ok) return fail(auth.error);

  const admin = createAdminClient();
  let q = admin
    .schema("palaro")
    .from("duty_schedules")
    .select("*")
    .order("duty_start", { ascending: false })
    .limit(500);
  if (fromIso) q = q.gte("duty_start", fromIso);

  const { data, error } = await q;
  if (error) return fail(error.message);
  return ok(data ?? []);
}

export async function createDuty(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const auth = await requirePersonnelManager();
  if (!auth.ok) return fail(auth.error);

  const parsed = createDutySchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  const data = parsed.data;

  const admin = createAdminClient();
  const { data: inserted, error } = await admin
    .schema("palaro")
    .from("duty_schedules")
    .insert({
      personnel_id: data.personnel_id,
      site_id: data.site_id || null,
      duty_start: data.duty_start,
      duty_end: data.duty_end,
      shift_label: data.shift_label || null,
      notes: data.notes || null,
      created_by: auth.profile.id,
    })
    .select("id")
    .single();
  if (error) return fail(error.message);

  await recordAudit({
    action: "create",
    entity_type: "duty_schedule",
    entity_id: inserted.id,
    changes: {
      personnel_id: data.personnel_id,
      site_id: data.site_id ?? null,
      duty_start: data.duty_start,
      duty_end: data.duty_end,
      shift_label: data.shift_label ?? null,
    },
    user_id: auth.profile.id,
  });

  revalidatePath(DUTY_PATH);
  return ok({ id: inserted.id });
}

export async function updateDuty(input: unknown): Promise<ActionResult<void>> {
  const auth = await requirePersonnelManager();
  if (!auth.ok) return fail(auth.error);

  const parsed = updateDutySchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  const { id, ...data } = parsed.data;

  const admin = createAdminClient();
  const { error } = await admin
    .schema("palaro")
    .from("duty_schedules")
    .update({
      personnel_id: data.personnel_id,
      site_id: data.site_id || null,
      duty_start: data.duty_start,
      duty_end: data.duty_end,
      shift_label: data.shift_label || null,
      notes: data.notes || null,
    })
    .eq("id", id);
  if (error) return fail(error.message);

  await recordAudit({
    action: "update",
    entity_type: "duty_schedule",
    entity_id: id,
    changes: {
      personnel_id: data.personnel_id,
      duty_start: data.duty_start,
      duty_end: data.duty_end,
    },
    user_id: auth.profile.id,
  });

  revalidatePath(DUTY_PATH);
  return ok();
}

export async function deleteDuty(input: unknown): Promise<ActionResult<void>> {
  const auth = await requirePersonnelManager();
  if (!auth.ok) return fail(auth.error);

  const parsed = deleteDutySchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }

  const admin = createAdminClient();
  const { error } = await admin
    .schema("palaro")
    .from("duty_schedules")
    .delete()
    .eq("id", parsed.data.id);
  if (error) return fail(error.message);

  await recordAudit({
    action: "delete",
    entity_type: "duty_schedule",
    entity_id: parsed.data.id,
    user_id: auth.profile.id,
  });

  revalidatePath(DUTY_PATH);
  return ok();
}

// =============================================================================
// ATTENDANCE
// =============================================================================

export async function getAttendanceLogs(
  fromIso?: string,
  toIso?: string,
): Promise<ActionResult<AttendanceLog[]>> {
  const auth = await requireAttendanceRecorder();
  if (!auth.ok) return fail(auth.error);

  const admin = createAdminClient();
  let q = admin
    .schema("palaro")
    .from("attendance_logs")
    .select("*")
    .order("scanned_at", { ascending: false })
    .limit(500);
  if (fromIso) q = q.gte("scanned_at", fromIso);
  if (toIso) q = q.lt("scanned_at", toIso);

  const { data, error } = await q;
  if (error) return fail(error.message);
  return ok(data ?? []);
}

export async function recordAttendance(
  input: unknown,
): Promise<ActionResult<{ id: string; type: AttendanceType }>> {
  const auth = await requireAttendanceRecorder();
  if (!auth.ok) return fail(auth.error);

  const parsed = recordAttendanceSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  const data = parsed.data;

  const admin = createAdminClient();
  const { data: inserted, error } = await admin
    .schema("palaro")
    .from("attendance_logs")
    .insert({
      personnel_id: data.personnel_id,
      site_id: data.site_id || null,
      type: data.type,
      scanned_by: auth.profile.id,
      notes: data.notes || null,
    })
    .select("id, type")
    .single();
  if (error) return fail(error.message);

  await recordAudit({
    action: "create",
    entity_type: "attendance_log",
    entity_id: inserted.id,
    changes: {
      personnel_id: data.personnel_id,
      type: data.type,
      site_id: data.site_id ?? null,
    },
    user_id: auth.profile.id,
  });

  revalidatePath(ATTENDANCE_PATH);
  return ok({ id: inserted.id, type: inserted.type });
}

// QR scan path:
//  - Scanned value is interpreted as a profile UUID
//  - Looks up the personnel's most recent log today; if none → time_in,
//    if last is time_in → time_out, else → time_in
//  - Used by `/dashboard/personnel/attendance` scan dialog
export async function scanAttendance(
  input: unknown,
): Promise<
  ActionResult<{
    id: string;
    type: AttendanceType;
    personnel_id: string;
    full_name: string | null;
  }>
> {
  const auth = await requireAttendanceRecorder();
  if (!auth.ok) return fail(auth.error);

  const parsed = scanAttendanceSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  const { scanned_value, site_id } = parsed.data;

  // The QR encodes a JSON envelope: {"v":1,"id":"<uuid>"}.
  // Older or hand-typed values may be a raw UUID — accept both.
  let personnelId: string | null = null;
  if (/^[0-9a-fA-F-]{36}$/.test(scanned_value.trim())) {
    personnelId = scanned_value.trim();
  } else {
    try {
      const parsed = JSON.parse(scanned_value) as {
        v?: number;
        id?: string;
      };
      if (parsed?.id && /^[0-9a-fA-F-]{36}$/.test(parsed.id)) {
        personnelId = parsed.id;
      }
    } catch {
      // fall through
    }
  }
  if (!personnelId) {
    return fail("Scan value is not a recognized Palaro Command ID.");
  }

  const admin = createAdminClient();
  const { data: target } = await admin
    .schema("palaro")
    .from("profiles")
    .select("id, full_name, status")
    .eq("id", personnelId)
    .single();
  if (!target) return fail("Personnel not found for scanned ID.");
  if (target.status !== "active") {
    return fail("That personnel record is not active.");
  }

  // Decide direction by checking the last log today (Asia/Manila day).
  const nowMs = Date.now();
  const startOfDayUtcMs =
    nowMs - ((nowMs + 8 * 60 * 60 * 1000) % (24 * 60 * 60 * 1000));
  const startOfDay = new Date(startOfDayUtcMs).toISOString();

  const { data: lastToday } = await admin
    .schema("palaro")
    .from("attendance_logs")
    .select("type, scanned_at")
    .eq("personnel_id", personnelId)
    .gte("scanned_at", startOfDay)
    .order("scanned_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextType: AttendanceType =
    lastToday?.type === "time_in" ? "time_out" : "time_in";

  const { data: inserted, error } = await admin
    .schema("palaro")
    .from("attendance_logs")
    .insert({
      personnel_id: personnelId,
      site_id: site_id || null,
      type: nextType,
      scanned_by: auth.profile.id,
    })
    .select("id, type")
    .single();
  if (error) return fail(error.message);

  await recordAudit({
    action: "create",
    entity_type: "attendance_log",
    entity_id: inserted.id,
    changes: {
      personnel_id: personnelId,
      type: nextType,
      site_id: site_id ?? null,
      via: "qr_scan",
    },
    user_id: auth.profile.id,
  });

  revalidatePath(ATTENDANCE_PATH);
  return ok({
    id: inserted.id,
    type: inserted.type,
    personnel_id: personnelId,
    full_name: target.full_name,
  });
}

// =============================================================================
// ID GENERATOR
// =============================================================================

export async function getPersonnelForIds(): Promise<ActionResult<Profile[]>> {
  const auth = await requirePersonnelManager();
  if (!auth.ok) return fail(auth.error);

  const admin = createAdminClient();
  const { data, error } = await admin
    .schema("palaro")
    .from("profiles")
    .select("*")
    .eq("status", "active")
    .not("role", "is", null)
    .order("full_name", { nullsFirst: false });
  if (error) return fail(error.message);

  // Audit a "view" on the bulk list — useful for tracking who exported IDs.
  await recordAudit({
    action: "view",
    entity_type: "personnel_ids",
    user_id: auth.profile.id,
  });

  return ok(data ?? []);
}
