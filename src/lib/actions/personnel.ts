"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions";
import {
  createDutySchema,
  createPersonnelSchema,
  deleteDutySchema,
  deletePersonnelSchema,
  scanAttendanceSchema,
  updateAttendanceLogSchema,
  updateDutySchema,
  updatePersonnelSchema,
} from "@/lib/schemas/personnel";
import { recordAudit } from "./audit";
import { fail, ok, type ActionResult } from "./types";
import type { Database } from "@/types/database";

type Personnel = Database["palaro"]["Tables"]["personnel"]["Row"];
type Duty = Database["palaro"]["Tables"]["duty_schedules"]["Row"];
type AttendanceLog = Database["palaro"]["Tables"]["attendance_logs"]["Row"];
type AttendanceType = Database["palaro"]["Enums"]["attendance_type"];

const PERSONNEL_PATH = "/dashboard/personnel/list";
const DUTY_PATH = "/dashboard/personnel/duty";
const ATTENDANCE_PATH = "/dashboard/personnel/attendance";
const IDS_PATH = "/dashboard/personnel/ids";
const DTR_PATH = "/dashboard/personnel/dtr";
const PERSONNEL_PHOTO_BUCKET = "personnel-photos";

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

// Read-only access to the personnel roster and attendance history for
// the DTR generator. Granted to personnel managers and attendance
// checkers (who staff the time-in/out station and print DTRs).
async function requireDtrReader() {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false as const, error: "Not authenticated." };
  if (
    !hasPermission(profile, "personnel.manage") &&
    !hasPermission(profile, "attendance.record") &&
    !hasPermission(profile, "dtr.view")
  ) {
    return {
      ok: false as const,
      error: "You don't have permission to view DTR data.",
    };
  }
  return { ok: true as const, profile };
}

// Lightweight projection for selectors and tables — avoids over-fetching when
// the consumer only needs the label/lookup columns.
export type PersonnelSummary = Pick<
  Personnel,
  "id" | "full_name" | "committee" | "designation" | "agency" | "site_id"
>;

// =============================================================================
// PERSONNEL CRUD
// =============================================================================

export async function getPersonnel(
  includeInactive = false,
): Promise<ActionResult<Personnel[]>> {
  const auth = await requirePersonnelManager();
  if (!auth.ok) return fail(auth.error);

  const admin = createAdminClient();
  let q = admin
    .schema("palaro")
    .from("personnel")
    .select("*")
    .order("full_name", { ascending: true });
  if (!includeInactive) q = q.eq("is_active", true);

  const { data, error } = await q;
  if (error) return fail(error.message);
  return ok(data ?? []);
}

// Selector projection used by attendance/duty pickers. Available to anyone
// with attendance.record so the scan UI can map scanned id → display name.
export async function getPersonnelForAttendance(): Promise<
  ActionResult<PersonnelSummary[]>
> {
  const auth = await requireAttendanceRecorder();
  if (!auth.ok) return fail(auth.error);

  const admin = createAdminClient();
  const { data, error } = await admin
    .schema("palaro")
    .from("personnel")
    .select("id, full_name, committee, designation, agency, site_id")
    .eq("is_active", true)
    .order("full_name", { ascending: true });
  if (error) return fail(error.message);
  return ok(data ?? []);
}

export async function createPersonnel(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const auth = await requirePersonnelManager();
  if (!auth.ok) return fail(auth.error);

  const parsed = createPersonnelSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  const data = parsed.data;

  const admin = createAdminClient();
  const { data: inserted, error } = await admin
    .schema("palaro")
    .from("personnel")
    .insert({
      full_name: data.full_name,
      designation: data.designation || null,
      committee: data.committee,
      area_assigned: data.area_assigned || null,
      site_id: data.site_id || null,
      agency: data.agency || null,
      contact_number: data.contact_number || null,
      photo_url: data.photo_url || null,
      is_active: data.is_active ?? true,
      created_by: auth.profile.id,
    })
    .select("id")
    .single();
  if (error) return fail(error.message);

  await recordAudit({
    action: "create",
    entity_type: "personnel",
    entity_id: inserted.id,
    changes: {
      full_name: data.full_name,
      committee: data.committee,
      site_id: data.site_id ?? null,
    },
    user_id: auth.profile.id,
  });

  revalidatePath(PERSONNEL_PATH);
  revalidatePath(IDS_PATH);
  revalidatePath(DTR_PATH);
  return ok({ id: inserted.id });
}

export async function updatePersonnel(
  input: unknown,
): Promise<ActionResult<void>> {
  const auth = await requirePersonnelManager();
  if (!auth.ok) return fail(auth.error);

  const parsed = updatePersonnelSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  const { id, ...data } = parsed.data;

  const admin = createAdminClient();
  const { error } = await admin
    .schema("palaro")
    .from("personnel")
    .update({
      full_name: data.full_name,
      designation: data.designation || null,
      committee: data.committee,
      area_assigned: data.area_assigned || null,
      site_id: data.site_id || null,
      agency: data.agency || null,
      contact_number: data.contact_number || null,
      photo_url: data.photo_url || null,
      is_active: data.is_active ?? true,
    })
    .eq("id", id);
  if (error) return fail(error.message);

  await recordAudit({
    action: "update",
    entity_type: "personnel",
    entity_id: id,
    changes: {
      full_name: data.full_name,
      committee: data.committee,
      site_id: data.site_id ?? null,
      is_active: data.is_active ?? true,
    },
    user_id: auth.profile.id,
  });

  revalidatePath(PERSONNEL_PATH);
  revalidatePath(IDS_PATH);
  revalidatePath(DTR_PATH);
  return ok();
}

// Soft delete — flips is_active to false. Hard-delete is unsafe because
// attendance_logs FK-cascades and we don't want to silently drop scan history.
export async function deletePersonnel(
  input: unknown,
): Promise<ActionResult<void>> {
  const auth = await requirePersonnelManager();
  if (!auth.ok) return fail(auth.error);

  const parsed = deletePersonnelSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }

  const admin = createAdminClient();
  const { error } = await admin
    .schema("palaro")
    .from("personnel")
    .update({ is_active: false })
    .eq("id", parsed.data.id);
  if (error) return fail(error.message);

  await recordAudit({
    action: "delete",
    entity_type: "personnel",
    entity_id: parsed.data.id,
    user_id: auth.profile.id,
  });

  revalidatePath(PERSONNEL_PATH);
  revalidatePath(IDS_PATH);
  return ok();
}

// Reverse of deletePersonnel — flips is_active back to true so the row is
// pickable again in ID generator, attendance, and DTR.
export async function reactivatePersonnel(
  input: unknown,
): Promise<ActionResult<void>> {
  const auth = await requirePersonnelManager();
  if (!auth.ok) return fail(auth.error);

  const parsed = deletePersonnelSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }

  const admin = createAdminClient();
  const { error } = await admin
    .schema("palaro")
    .from("personnel")
    .update({ is_active: true })
    .eq("id", parsed.data.id);
  if (error) return fail(error.message);

  await recordAudit({
    action: "update",
    entity_type: "personnel",
    entity_id: parsed.data.id,
    user_id: auth.profile.id,
    changes: { is_active: true },
  });

  revalidatePath(PERSONNEL_PATH);
  revalidatePath(IDS_PATH);
  return ok();
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
  // A single Manila day at a national event can exceed 500 scans (hundreds of
  // personnel × time-in + time-out). Any fixed row cap silently truncates the
  // logs — scans outside the kept window vanish from this view — so page through
  // the whole range instead. Same fix as getAttendanceLogsForDtr below.
  const PAGE_SIZE = 1000;
  const all: AttendanceLog[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    let q = admin
      .schema("palaro")
      .from("attendance_logs")
      .select("*")
      .order("scanned_at", { ascending: false })
      .range(offset, offset + PAGE_SIZE - 1);
    if (fromIso) q = q.gte("scanned_at", fromIso);
    if (toIso) q = q.lt("scanned_at", toIso);

    const { data, error } = await q;
    if (error) return fail(error.message);
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE_SIZE) break;
  }

  return ok(all);
}

export async function updateAttendanceLog(
  input: unknown,
): Promise<ActionResult<void>> {
  const auth = await requireAttendanceRecorder();
  if (!auth.ok) return fail(auth.error);

  const parsed = updateAttendanceLogSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  const data = parsed.data;

  const admin = createAdminClient();
  const { data: before } = await admin
    .schema("palaro")
    .from("attendance_logs")
    .select("scanned_at, type, site_id, notes")
    .eq("id", data.id)
    .maybeSingle();
  if (!before) return fail("Attendance log not found.");

  const { error } = await admin
    .schema("palaro")
    .from("attendance_logs")
    .update({
      scanned_at: data.scanned_at,
      type: data.type,
      site_id: data.site_id || null,
      notes: data.notes || null,
    })
    .eq("id", data.id);
  if (error) return fail(error.message);

  await recordAudit({
    action: "update",
    entity_type: "attendance_log",
    entity_id: data.id,
    changes: {
      before,
      after: {
        scanned_at: data.scanned_at,
        type: data.type,
        site_id: data.site_id ?? null,
        notes: data.notes ?? null,
      },
    },
    user_id: auth.profile.id,
  });

  revalidatePath(ATTENDANCE_PATH);
  return ok(undefined);
}

// QR scan path:
//  - Scanned value is interpreted as a personnel UUID (envelope or raw)
//  - Looks up the personnel's most recent log overall (not restricted to
//    today's Asia/Manila day). If last is time_in → time_out, else → time_in.
//    Using "today only" broke overnight shifts: a time_in at 11 PM and a
//    time_out at 1 AM the next morning would otherwise both be recorded as
//    time_in because the prior log fell outside today's window.
//  - Used by `/dashboard/personnel/attendance` scan dialog
export async function scanAttendance(
  input: unknown,
): Promise<
  ActionResult<{
    id: string;
    type: AttendanceType;
    personnel_id: string;
    full_name: string | null;
    photo_url: string | null;
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
    return fail("Scan value is not a recognized Palaro Bayugan Command ID.");
  }

  const admin = createAdminClient();
  const { data: target } = await admin
    .schema("palaro")
    .from("personnel")
    .select("id, full_name, is_active, photo_url")
    .eq("id", personnelId)
    .single();
  if (!target) return fail("Personnel not found for scanned ID.");
  if (!target.is_active) {
    return fail("That personnel record is inactive.");
  }

  // Decide direction by toggling off the personnel's most recent log,
  // regardless of which calendar day it falls on. This preserves the
  // time_in → time_out pairing across the midnight rollover.
  const nowMs = Date.now();

  const { data: lastLog } = await admin
    .schema("palaro")
    .from("attendance_logs")
    .select("type, scanned_at")
    .eq("personnel_id", personnelId)
    .order("scanned_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Enforce 5-minute cooldown between scans of the same QR.
  const COOLDOWN_MS = 5 * 60 * 1000;
  if (lastLog) {
    const elapsed = nowMs - new Date(lastLog.scanned_at).getTime();
    if (elapsed < COOLDOWN_MS) {
      const secsLeft = Math.ceil((COOLDOWN_MS - elapsed) / 1000);
      const m = Math.floor(secsLeft / 60);
      const s = secsLeft % 60;
      const wait = m > 0 ? `${m}m ${s}s` : `${s}s`;
      return fail(
        `${target.full_name ?? "This personnel"} was scanned recently. Try again in ${wait}.`,
      );
    }
  }

  const nextType: AttendanceType =
    lastLog?.type === "time_in" ? "time_out" : "time_in";

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
    photo_url: target.photo_url,
  });
}

// =============================================================================
// DTR (Daily Time Record)
// =============================================================================

// Range fetch over attendance_logs for DTR generation. Pages through the whole
// range instead of using a fixed row cap: at a national event the logs in a
// 1-month window (hundreds of personnel × time-in + time-out) exceed any single
// cap, and a cap silently drops the *latest* days (ascending order keeps the
// oldest), making a month-range DTR disagree with a week-range DTR for the same
// person. Looping in pages keeps the result complete for any range length.
export async function getAttendanceLogsForDtr(
  fromIso: string,
  toIso: string,
): Promise<ActionResult<AttendanceLog[]>> {
  const auth = await requireDtrReader();
  if (!auth.ok) return fail(auth.error);

  const admin = createAdminClient();
  const PAGE_SIZE = 1000;
  const all: AttendanceLog[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await admin
      .schema("palaro")
      .from("attendance_logs")
      .select("*")
      .gte("scanned_at", fromIso)
      .lt("scanned_at", toIso)
      .order("scanned_at", { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) return fail(error.message);
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE_SIZE) break;
  }

  return ok(all);
}

// =============================================================================
// ID GENERATOR
// =============================================================================

export async function getPersonnelForIds(): Promise<ActionResult<Personnel[]>> {
  // Used by both the ID generator (personnel.manage) and the DTR generator
  // (attendance.record also allowed so attendance checkers can print DTRs).
  const auth = await requireDtrReader();
  if (!auth.ok) return fail(auth.error);

  const admin = createAdminClient();
  const { data, error } = await admin
    .schema("palaro")
    .from("personnel")
    .select("*")
    .eq("is_active", true)
    .order("full_name", { ascending: true });
  if (error) return fail(error.message);

  return ok(data ?? []);
}

// =============================================================================
// PERSONNEL PHOTOS
// =============================================================================

// Browser posts a (compressed) image as FormData; service-role uploads it to a
// private bucket. The returned `path` is what we persist in personnel.photo_url.
export async function uploadPersonnelPhoto(
  formData: FormData,
): Promise<ActionResult<{ path: string }>> {
  const auth = await requirePersonnelManager();
  if (!auth.ok) return fail(auth.error);

  const file = formData.get("file");
  if (!(file instanceof File)) return fail("No file provided.");
  if (file.size === 0) return fail("Empty file.");
  if (file.size > 2_500_000) {
    return fail("File too large after compression. Try a smaller photo.");
  }

  const ext = (file.name.split(".").pop() ?? "jpg")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  const stamp = Date.now();
  const random = Math.random().toString(36).slice(2, 8);
  const path = `${auth.profile.id}/${stamp}-${random}.${ext || "jpg"}`;

  const admin = createAdminClient();
  const { error } = await admin.storage
    .from(PERSONNEL_PHOTO_BUCKET)
    .upload(path, file, {
      contentType: file.type || "image/jpeg",
      upsert: false,
    });

  if (error) return fail(error.message);
  return ok({ path });
}

// 1-hour signed URL for displaying a personnel photo from the private bucket.
export async function getPersonnelPhotoUrl(
  path: string,
): Promise<ActionResult<{ url: string }>> {
  const profile = await getCurrentProfile();
  if (!profile) return fail("Not authenticated.");

  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from(PERSONNEL_PHOTO_BUCKET)
    .createSignedUrl(path, 60 * 60);
  if (error) return fail(error.message);
  return ok({ url: data.signedUrl });
}

// Batch variant for the IDs roster — one round-trip instead of N.
// Returns a map of path → signed URL; missing paths are simply omitted.
export async function getPersonnelPhotoUrls(
  paths: string[],
): Promise<ActionResult<Record<string, string>>> {
  const profile = await getCurrentProfile();
  if (!profile) return fail("Not authenticated.");
  if (paths.length === 0) return ok({});

  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from(PERSONNEL_PHOTO_BUCKET)
    .createSignedUrls(paths, 60 * 60);
  if (error) return fail(error.message);

  const out: Record<string, string> = {};
  for (const item of data ?? []) {
    if (item.path && item.signedUrl && !item.error) {
      out[item.path] = item.signedUrl;
    }
  }
  return ok(out);
}
