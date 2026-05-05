"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions";
import { createIncidentSchema } from "@/lib/schemas/incidents";
import { recordAudit } from "./audit";
import { fail, ok, type ActionResult } from "./types";
import type { Database } from "@/types/database";

type Incident = Database["palaro"]["Tables"]["incidents"]["Row"];
type IncidentCategory = Database["palaro"]["Enums"]["incident_category"];

const INCIDENTS_PATH = "/dashboard/incidents";
const INCIDENT_PHOTO_BUCKET = "incident-photos";

export async function getIncidents(
  category?: IncidentCategory,
): Promise<ActionResult<Incident[]>> {
  const profile = await getCurrentProfile();
  if (!profile) return fail("Not authenticated.");
  if (!hasPermission(profile, "incident.view")) {
    return fail("You don't have permission to view incidents.");
  }

  const admin = createAdminClient();
  let query = admin
    .schema("palaro")
    .from("incidents")
    .select("*")
    .order("reported_at", { ascending: false })
    .limit(500);
  if (category) query = query.eq("category", category);
  const { data, error } = await query;
  if (error) return fail(error.message);
  return ok(data ?? []);
}

export async function getIncident(
  id: string,
): Promise<ActionResult<Incident>> {
  const profile = await getCurrentProfile();
  if (!profile) return fail("Not authenticated.");
  if (!hasPermission(profile, "incident.view")) {
    return fail("You don't have permission to view incidents.");
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .schema("palaro")
    .from("incidents")
    .select("*")
    .eq("id", id)
    .single();
  if (error) return fail(error.message);
  return ok(data);
}

const updateStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(["open", "in_progress", "referred", "resolved", "closed"]),
  resolution_notes: z.string().trim().max(2000).optional(),
});

export async function updateIncidentStatus(
  input: unknown,
): Promise<ActionResult<void>> {
  const profile = await getCurrentProfile();
  if (!profile) return fail("Not authenticated.");
  if (!hasPermission(profile, "incident.update")) {
    return fail("You don't have permission to update incidents.");
  }

  const parsed = updateStatusSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  const { id, status, resolution_notes } = parsed.data;

  const isResolution = status === "resolved" || status === "closed";

  const admin = createAdminClient();
  const { error } = await admin
    .schema("palaro")
    .from("incidents")
    .update({
      status,
      resolution_notes: resolution_notes || null,
      resolved_by: isResolution ? profile.id : null,
      resolved_at: isResolution ? new Date().toISOString() : null,
    })
    .eq("id", id);
  if (error) return fail(error.message);

  await recordAudit({
    action: "update",
    entity_type: "incident",
    entity_id: id,
    changes: { status, resolution_notes: resolution_notes ?? null },
    user_id: profile.id,
  });

  revalidatePath(INCIDENTS_PATH);
  revalidatePath(`${INCIDENTS_PATH}/${id}`);
  return ok();
}

export async function createIncident(
  input: unknown,
): Promise<ActionResult<{ id: string; incident_number: string }>> {
  const profile = await getCurrentProfile();
  if (!profile) return fail("Not authenticated.");
  if (!hasPermission(profile, "incident.create")) {
    return fail("You don't have permission to create incidents.");
  }

  const parsed = createIncidentSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  const data = parsed.data;

  const admin = createAdminClient();
  const { data: inserted, error } = await admin
    .schema("palaro")
    .from("incidents")
    .insert({
      category: data.category,
      severity: data.severity,
      title: data.title,
      description: data.description || null,
      site_id: data.site_id || null,
      location_details: data.location_details || null,
      latitude: data.latitude ?? null,
      longitude: data.longitude ?? null,
      delegation_id: data.delegation_id || null,
      affected_person_name: data.affected_person_name || null,
      affected_person_age: data.affected_person_age ?? null,
      affected_person_role: data.affected_person_role || null,
      photo_urls: data.photo_paths && data.photo_paths.length > 0 ? data.photo_paths : null,
      reported_by: profile.id,
      reported_at: new Date().toISOString(),
    })
    .select("id, incident_number")
    .single();

  if (error) return fail(error.message);

  // Notification fan-out:
  //  - severity >= medium → broadcast to command_center
  //  - severity = critical → also broadcast to medical_field
  // Best-effort — don't fail the create if notification insert errors.
  type NotificationInsert =
    Database["palaro"]["Tables"]["notifications"]["Insert"];
  const notificationRows: NotificationInsert[] = [];
  if (
    data.severity === "medium" ||
    data.severity === "high" ||
    data.severity === "critical"
  ) {
    const sev =
      data.severity === "critical"
        ? "critical"
        : data.severity === "high"
          ? "warning"
          : "info";
    notificationRows.push({
      recipient_id: null,
      recipient_role: "command_center",
      title: `${data.severity.toUpperCase()}: ${data.title}`,
      body: data.description?.slice(0, 240) ?? null,
      category: "incident",
      severity: sev,
      reference_type: "incident",
      reference_id: inserted.id,
      link_url: `${INCIDENTS_PATH}/${inserted.id}`,
    });
  }
  if (data.severity === "critical") {
    notificationRows.push({
      recipient_id: null,
      recipient_role: "medical_field",
      title: `CRITICAL incident: ${data.title}`,
      body: data.description?.slice(0, 240) ?? null,
      category: "incident",
      severity: "critical",
      reference_type: "incident",
      reference_id: inserted.id,
      link_url: `${INCIDENTS_PATH}/${inserted.id}`,
    });
  }
  if (notificationRows.length > 0) {
    await admin
      .schema("palaro")
      .from("notifications")
      .insert(notificationRows);
  }

  await recordAudit({
    action: "create",
    entity_type: "incident",
    entity_id: inserted.id,
    changes: {
      incident_number: inserted.incident_number,
      category: data.category,
      severity: data.severity,
      title: data.title,
      site_id: data.site_id ?? null,
    },
    user_id: profile.id,
  });

  revalidatePath(INCIDENTS_PATH);
  return ok({ id: inserted.id, incident_number: inserted.incident_number });
}

// Server-side photo upload. The browser compresses + posts the file via FormData;
// we route it through service_role so the storage bucket doesn't need RLS policies.
export async function uploadIncidentPhoto(
  formData: FormData,
): Promise<ActionResult<{ path: string }>> {
  const profile = await getCurrentProfile();
  if (!profile) return fail("Not authenticated.");
  if (!hasPermission(profile, "incident.create")) {
    return fail("You don't have permission to upload incident photos.");
  }

  const file = formData.get("file");
  if (!(file instanceof File)) return fail("No file provided.");
  if (file.size === 0) return fail("Empty file.");
  if (file.size > 2_500_000) {
    return fail("File too large after compression. Try a smaller photo.");
  }

  const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase().replace(/[^a-z0-9]/g, "");
  const stamp = Date.now();
  const random = Math.random().toString(36).slice(2, 8);
  const path = `${profile.id}/${stamp}-${random}.${ext || "jpg"}`;

  const admin = createAdminClient();
  const { error } = await admin.storage
    .from(INCIDENT_PHOTO_BUCKET)
    .upload(path, file, {
      contentType: file.type || "image/jpeg",
      upsert: false,
    });

  if (error) return fail(error.message);
  return ok({ path });
}

// Generates a 1-hour signed URL for displaying a private incident photo.
export async function getIncidentPhotoUrl(
  path: string,
): Promise<ActionResult<{ url: string }>> {
  const profile = await getCurrentProfile();
  if (!profile) return fail("Not authenticated.");

  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from(INCIDENT_PHOTO_BUCKET)
    .createSignedUrl(path, 60 * 60);
  if (error) return fail(error.message);
  return ok({ url: data.signedUrl });
}
