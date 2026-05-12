"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions";
import {
  createEndOfDaySchema,
  createExternalPersonnelSchema,
  createVisitSchema,
  deleteEndOfDaySchema,
  deleteExternalPersonnelSchema,
  deleteVisitSchema,
  setExternalPersonnelStatusSchema,
  updateEndOfDaySchema,
  updateExternalPersonnelSchema,
  updateVisitSchema,
} from "@/lib/schemas/site-monitoring";
import { recordAudit } from "./audit";
import { fail, ok, type ActionResult } from "./types";
import type { Database } from "@/types/database";

type VisitRow = Database["palaro"]["Tables"]["site_monitoring_visits"]["Row"];
type ExternalPersonnelRow =
  Database["palaro"]["Tables"]["external_personnel_logs"]["Row"];
type EndOfDayRow = Database["palaro"]["Tables"]["end_of_day_reports"]["Row"];

const SITE_MONITORING_PATH = "/dashboard/site-monitoring";

// Visit / external-personnel / end-of-day logging is open to anyone who
// physically sits at an Information Hub plus Command Center / Super Admin.
async function requireVisitLogger() {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false as const, error: "Not authenticated." };
  if (
    !hasPermission(profile, "site_monitoring.log") &&
    !hasPermission(profile, "site_monitoring.manage")
  ) {
    return {
      ok: false as const,
      error: "You don't have permission to log site monitoring entries.",
    };
  }
  return { ok: true as const, profile };
}

async function requireExternalPersonnelLogger() {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false as const, error: "Not authenticated." };
  if (
    !hasPermission(profile, "external_personnel.log") &&
    !hasPermission(profile, "site_monitoring.manage")
  ) {
    return {
      ok: false as const,
      error: "You don't have permission to log external personnel.",
    };
  }
  return { ok: true as const, profile };
}

async function requireEndOfDayLogger() {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false as const, error: "Not authenticated." };
  if (
    !hasPermission(profile, "end_of_day.log") &&
    !hasPermission(profile, "site_monitoring.manage")
  ) {
    return {
      ok: false as const,
      error: "You don't have permission to log end-of-day reports.",
    };
  }
  return { ok: true as const, profile };
}

// ============================================================
// VISITS
// ============================================================

export async function getVisits(
  limit = 200,
): Promise<ActionResult<VisitRow[]>> {
  const auth = await requireVisitLogger();
  if (!auth.ok) return fail(auth.error);

  const admin = createAdminClient();
  const { data, error } = await admin
    .schema("palaro")
    .from("site_monitoring_visits")
    .select("*")
    .order("visited_at", { ascending: false })
    .limit(limit);
  if (error) return fail(error.message);
  return ok(data ?? []);
}

export async function createVisit(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const auth = await requireVisitLogger();
  if (!auth.ok) return fail(auth.error);

  const parsed = createVisitSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  const data = parsed.data;
  const visitedIso = new Date(data.visited_at).toISOString();

  const admin = createAdminClient();
  const { data: inserted, error } = await admin
    .schema("palaro")
    .from("site_monitoring_visits")
    .insert({
      site_id: data.site_id,
      visit_title: data.visit_title,
      individuals: data.individuals,
      visited_at: visitedIso,
      observations: data.observations || null,
      notes_to_admin: data.notes_to_admin || null,
      logged_by: auth.profile.id,
    })
    .select("id")
    .single();
  if (error) return fail(error.message);

  await recordAudit({
    action: "create",
    entity_type: "site_monitoring_visit",
    entity_id: inserted.id,
    changes: {
      site_id: data.site_id,
      visit_title: data.visit_title,
      visited_at: visitedIso,
    },
    user_id: auth.profile.id,
  });

  revalidatePath(SITE_MONITORING_PATH);
  return ok({ id: inserted.id });
}

export async function updateVisit(
  input: unknown,
): Promise<ActionResult<void>> {
  const auth = await requireVisitLogger();
  if (!auth.ok) return fail(auth.error);

  const parsed = updateVisitSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  const { id, ...data } = parsed.data;
  const visitedIso = new Date(data.visited_at).toISOString();

  const admin = createAdminClient();
  const { error } = await admin
    .schema("palaro")
    .from("site_monitoring_visits")
    .update({
      site_id: data.site_id,
      visit_title: data.visit_title,
      individuals: data.individuals,
      visited_at: visitedIso,
      observations: data.observations || null,
      notes_to_admin: data.notes_to_admin || null,
    })
    .eq("id", id);
  if (error) return fail(error.message);

  await recordAudit({
    action: "update",
    entity_type: "site_monitoring_visit",
    entity_id: id,
    changes: { visit_title: data.visit_title, visited_at: visitedIso },
    user_id: auth.profile.id,
  });

  revalidatePath(SITE_MONITORING_PATH);
  return ok();
}

export async function deleteVisit(
  input: unknown,
): Promise<ActionResult<void>> {
  const auth = await requireVisitLogger();
  if (!auth.ok) return fail(auth.error);

  const parsed = deleteVisitSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }

  const admin = createAdminClient();
  const { error } = await admin
    .schema("palaro")
    .from("site_monitoring_visits")
    .delete()
    .eq("id", parsed.data.id);
  if (error) return fail(error.message);

  await recordAudit({
    action: "delete",
    entity_type: "site_monitoring_visit",
    entity_id: parsed.data.id,
    user_id: auth.profile.id,
  });

  revalidatePath(SITE_MONITORING_PATH);
  return ok();
}

// ============================================================
// EXTERNAL PERSONNEL
// ============================================================

export async function getExternalPersonnel(
  limit = 500,
): Promise<ActionResult<ExternalPersonnelRow[]>> {
  const auth = await requireExternalPersonnelLogger();
  if (!auth.ok) return fail(auth.error);

  const admin = createAdminClient();
  const { data, error } = await admin
    .schema("palaro")
    .from("external_personnel_logs")
    .select("*")
    .order("logged_at", { ascending: false })
    .limit(limit);
  if (error) return fail(error.message);
  return ok(data ?? []);
}

export async function createExternalPersonnel(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const auth = await requireExternalPersonnelLogger();
  if (!auth.ok) return fail(auth.error);

  const parsed = createExternalPersonnelSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  const data = parsed.data;
  const loggedIso = new Date(data.logged_at).toISOString();

  const admin = createAdminClient();
  const { data: inserted, error } = await admin
    .schema("palaro")
    .from("external_personnel_logs")
    .insert({
      site_id: data.site_id || null,
      full_name: data.full_name,
      position: data.position,
      organization: data.organization || null,
      logged_at: loggedIso,
      status: data.status,
      notes: data.notes || null,
      logged_by: auth.profile.id,
    })
    .select("id")
    .single();
  if (error) return fail(error.message);

  await recordAudit({
    action: "create",
    entity_type: "external_personnel_log",
    entity_id: inserted.id,
    changes: {
      full_name: data.full_name,
      position: data.position,
      organization: data.organization ?? null,
      site_id: data.site_id ?? null,
    },
    user_id: auth.profile.id,
  });

  revalidatePath(SITE_MONITORING_PATH);
  return ok({ id: inserted.id });
}

export async function updateExternalPersonnel(
  input: unknown,
): Promise<ActionResult<void>> {
  const auth = await requireExternalPersonnelLogger();
  if (!auth.ok) return fail(auth.error);

  const parsed = updateExternalPersonnelSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  const { id, ...data } = parsed.data;
  const loggedIso = new Date(data.logged_at).toISOString();

  const admin = createAdminClient();
  const { error } = await admin
    .schema("palaro")
    .from("external_personnel_logs")
    .update({
      site_id: data.site_id || null,
      full_name: data.full_name,
      position: data.position,
      organization: data.organization || null,
      logged_at: loggedIso,
      status: data.status,
      notes: data.notes || null,
    })
    .eq("id", id);
  if (error) return fail(error.message);

  await recordAudit({
    action: "update",
    entity_type: "external_personnel_log",
    entity_id: id,
    changes: { full_name: data.full_name, status: data.status },
    user_id: auth.profile.id,
  });

  revalidatePath(SITE_MONITORING_PATH);
  return ok();
}

export async function setExternalPersonnelStatus(
  input: unknown,
): Promise<ActionResult<void>> {
  const auth = await requireExternalPersonnelLogger();
  if (!auth.ok) return fail(auth.error);

  const parsed = setExternalPersonnelStatusSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  const { id, status } = parsed.data;

  const admin = createAdminClient();
  const { error } = await admin
    .schema("palaro")
    .from("external_personnel_logs")
    .update({ status })
    .eq("id", id);
  if (error) return fail(error.message);

  await recordAudit({
    action: "update",
    entity_type: "external_personnel_log",
    entity_id: id,
    changes: { status },
    user_id: auth.profile.id,
  });

  revalidatePath(SITE_MONITORING_PATH);
  return ok();
}

export async function deleteExternalPersonnel(
  input: unknown,
): Promise<ActionResult<void>> {
  const auth = await requireExternalPersonnelLogger();
  if (!auth.ok) return fail(auth.error);

  const parsed = deleteExternalPersonnelSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }

  const admin = createAdminClient();
  const { error } = await admin
    .schema("palaro")
    .from("external_personnel_logs")
    .delete()
    .eq("id", parsed.data.id);
  if (error) return fail(error.message);

  await recordAudit({
    action: "delete",
    entity_type: "external_personnel_log",
    entity_id: parsed.data.id,
    user_id: auth.profile.id,
  });

  revalidatePath(SITE_MONITORING_PATH);
  return ok();
}

// ============================================================
// END-OF-DAY REPORTS
// ============================================================

export async function getEndOfDayReports(
  limit = 200,
): Promise<ActionResult<EndOfDayRow[]>> {
  const auth = await requireEndOfDayLogger();
  if (!auth.ok) return fail(auth.error);

  const admin = createAdminClient();
  const { data, error } = await admin
    .schema("palaro")
    .from("end_of_day_reports")
    .select("*")
    .order("report_date", { ascending: false })
    .limit(limit);
  if (error) return fail(error.message);
  return ok(data ?? []);
}

export async function createEndOfDayReport(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const auth = await requireEndOfDayLogger();
  if (!auth.ok) return fail(auth.error);

  const parsed = createEndOfDaySchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  const data = parsed.data;

  const admin = createAdminClient();
  const { data: inserted, error } = await admin
    .schema("palaro")
    .from("end_of_day_reports")
    .insert({
      site_id: data.site_id,
      report_date: data.report_date,
      all_accounted_for: data.all_accounted_for,
      outside_athletes: data.outside_athletes,
      outside_personnel: data.outside_personnel,
      outside_officials: data.outside_officials,
      outside_details: data.outside_details || null,
      reporting_officer_name: data.reporting_officer_name,
      reporting_officer_position: data.reporting_officer_position || null,
      notes: data.notes || null,
      logged_by: auth.profile.id,
    })
    .select("id")
    .single();
  if (error) return fail(error.message);

  await recordAudit({
    action: "create",
    entity_type: "end_of_day_report",
    entity_id: inserted.id,
    changes: {
      site_id: data.site_id,
      report_date: data.report_date,
      all_accounted_for: data.all_accounted_for,
    },
    user_id: auth.profile.id,
  });

  revalidatePath(SITE_MONITORING_PATH);
  return ok({ id: inserted.id });
}

export async function updateEndOfDayReport(
  input: unknown,
): Promise<ActionResult<void>> {
  const auth = await requireEndOfDayLogger();
  if (!auth.ok) return fail(auth.error);

  const parsed = updateEndOfDaySchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  const { id, ...data } = parsed.data;

  const admin = createAdminClient();
  const { error } = await admin
    .schema("palaro")
    .from("end_of_day_reports")
    .update({
      site_id: data.site_id,
      report_date: data.report_date,
      all_accounted_for: data.all_accounted_for,
      outside_athletes: data.outside_athletes,
      outside_personnel: data.outside_personnel,
      outside_officials: data.outside_officials,
      outside_details: data.outside_details || null,
      reporting_officer_name: data.reporting_officer_name,
      reporting_officer_position: data.reporting_officer_position || null,
      notes: data.notes || null,
    })
    .eq("id", id);
  if (error) return fail(error.message);

  await recordAudit({
    action: "update",
    entity_type: "end_of_day_report",
    entity_id: id,
    changes: { all_accounted_for: data.all_accounted_for },
    user_id: auth.profile.id,
  });

  revalidatePath(SITE_MONITORING_PATH);
  return ok();
}

export async function deleteEndOfDayReport(
  input: unknown,
): Promise<ActionResult<void>> {
  const auth = await requireEndOfDayLogger();
  if (!auth.ok) return fail(auth.error);

  const parsed = deleteEndOfDaySchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }

  const admin = createAdminClient();
  const { error } = await admin
    .schema("palaro")
    .from("end_of_day_reports")
    .delete()
    .eq("id", parsed.data.id);
  if (error) return fail(error.message);

  await recordAudit({
    action: "delete",
    entity_type: "end_of_day_report",
    entity_id: parsed.data.id,
    user_id: auth.profile.id,
  });

  revalidatePath(SITE_MONITORING_PATH);
  return ok();
}
