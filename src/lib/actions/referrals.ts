"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions";
import {
  acceptReferralSchema,
  admitReferralSchema,
  createFieldReferralSchema,
  createHospitalAdmitSchema,
  createUcfToHospitalReferralSchema,
  dischargeReferralSchema,
  rejectReferralSchema,
  submitHospitalAssessmentSchema,
  submitUcfAssessmentSchema,
} from "@/lib/schemas/referrals";
import { recordAudit } from "./audit";
import { fail, ok, type ActionResult } from "./types";
import type { Database, Json } from "@/types/database";

type Referral = Database["palaro"]["Tables"]["referrals"]["Row"];
type NotificationInsert = Database["palaro"]["Tables"]["notifications"]["Insert"];

const MEDICAL_INCIDENTS_PATH = "/dashboard/medical/incidents";
const UCF_PATH = "/dashboard/medical/ucf";
const HOSPITAL_PATH = "/dashboard/medical/hospital";
const INCIDENTS_PATH = "/dashboard/incidents";

// All-referrals feed for the command center overview. Gated to anyone with
// broad operational visibility (incident.view) — the same gate the page itself
// uses, so this stays consistent with the dashboard's audience.
export async function getAllReferrals(): Promise<ActionResult<Referral[]>> {
  const profile = await getCurrentProfile();
  if (!profile) return fail("Not authenticated.");
  if (
    !hasPermission(profile, "incident.view") &&
    !hasPermission(profile, "admin.manage")
  ) {
    return fail("You don't have permission to view referrals.");
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .schema("palaro")
    .from("referrals")
    .select("*")
    .order("referred_at", { ascending: false })
    .limit(500);
  if (error) return fail(error.message);
  return ok(data ?? []);
}

// For a given set of incident IDs, returns the most recent referral per incident.
// Used by the incidents list to show "where it was referred" alongside status.
export async function getLatestReferralByIncident(
  incidentIds: string[],
): Promise<
  ActionResult<
    Map<
      string,
      Pick<Referral, "id" | "to_site_id" | "level" | "status" | "referred_at">
    >
  >
> {
  const profile = await getCurrentProfile();
  if (!profile) return fail("Not authenticated.");
  if (!hasPermission(profile, "incident.view")) {
    return fail("You don't have permission to view referrals.");
  }
  if (incidentIds.length === 0) return ok(new Map());

  const admin = createAdminClient();
  const { data, error } = await admin
    .schema("palaro")
    .from("referrals")
    .select("id, incident_id, to_site_id, level, status, referred_at")
    .in("incident_id", incidentIds)
    .order("referred_at", { ascending: false });
  if (error) return fail(error.message);

  const latest = new Map<
    string,
    Pick<Referral, "id" | "to_site_id" | "level" | "status" | "referred_at">
  >();
  for (const r of data ?? []) {
    if (!r.incident_id) continue;
    if (!latest.has(r.incident_id)) {
      latest.set(r.incident_id, {
        id: r.id,
        to_site_id: r.to_site_id,
        level: r.level,
        status: r.status,
        referred_at: r.referred_at,
      });
    }
  }
  return ok(latest);
}

// Returns all field-to-UCF referrals visible to the caller.
// Future: filter to user's primary_assignment_site_id when role is medical_ucf and assignment is set.
export async function getUcfInbox(): Promise<ActionResult<Referral[]>> {
  const profile = await getCurrentProfile();
  if (!profile) return fail("Not authenticated.");
  if (
    !hasPermission(profile, "referral.accept") &&
    !hasPermission(profile, "referral.assess") &&
    !hasPermission(profile, "referral.discharge")
  ) {
    return fail("You don't have permission to view the UCF inbox.");
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .schema("palaro")
    .from("referrals")
    .select("*")
    .eq("level", "field_to_ucf")
    .order("referred_at", { ascending: false })
    .limit(500);
  if (error) return fail(error.message);
  return ok(data ?? []);
}

export async function getReferral(
  id: string,
): Promise<ActionResult<Referral>> {
  const profile = await getCurrentProfile();
  if (!profile) return fail("Not authenticated.");

  const admin = createAdminClient();
  const { data, error } = await admin
    .schema("palaro")
    .from("referrals")
    .select("*")
    .eq("id", id)
    .single();
  if (error) return fail(error.message);
  return ok(data);
}

export async function acceptReferral(
  input: unknown,
): Promise<ActionResult<void>> {
  const profile = await getCurrentProfile();
  if (!profile) return fail("Not authenticated.");
  if (!hasPermission(profile, "referral.accept")) {
    return fail("You don't have permission to accept referrals.");
  }

  const parsed = acceptReferralSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }

  const admin = createAdminClient();
  const { error } = await admin
    .schema("palaro")
    .from("referrals")
    .update({
      status: "accepted",
      received_by: profile.id,
      received_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.id)
    .eq("status", "pending"); // optimistic concurrency: only flip from pending
  if (error) return fail(error.message);

  await recordAudit({
    action: "update",
    entity_type: "referral",
    entity_id: parsed.data.id,
    changes: { status: "accepted", received_by: profile.id },
    user_id: profile.id,
  });

  revalidatePath(UCF_PATH);
  revalidatePath(`${UCF_PATH}/${parsed.data.id}`);
  return ok();
}

export async function submitUcfAssessment(
  input: unknown,
): Promise<ActionResult<void>> {
  const profile = await getCurrentProfile();
  if (!profile) return fail("Not authenticated.");
  if (!hasPermission(profile, "referral.assess")) {
    return fail("You don't have permission to submit UCF assessments.");
  }

  const parsed = submitUcfAssessmentSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  const data = parsed.data;

  const admin = createAdminClient();

  // Merge new on-arrival vitals with existing field vitals (preserving both).
  let mergedVitals: Json | null = null;
  if (data.vitals_on_arrival) {
    const arrival = Object.fromEntries(
      Object.entries(data.vitals_on_arrival).filter(
        ([, v]) => v !== undefined && v !== "",
      ),
    );
    if (Object.keys(arrival).length > 0) {
      const { data: existing } = await admin
        .schema("palaro")
        .from("referrals")
        .select("vital_signs")
        .eq("id", data.id)
        .single();
      const existingVitals =
        (existing?.vital_signs as Record<string, unknown> | null) ?? {};
      mergedVitals = { ...existingVitals, on_arrival: arrival } as Json;
    }
  }

  const updates: Database["palaro"]["Tables"]["referrals"]["Update"] = {
    status: "in_treatment",
    initial_diagnosis: data.initial_diagnosis || null,
    treatment_plan: data.treatment_plan || null,
    assessment_notes: data.assessment_notes || null,
  };
  if (mergedVitals !== null) updates.vital_signs = mergedVitals;

  const { error } = await admin
    .schema("palaro")
    .from("referrals")
    .update(updates)
    .eq("id", data.id);
  if (error) return fail(error.message);

  await recordAudit({
    action: "update",
    entity_type: "referral",
    entity_id: data.id,
    changes: { stage: "ucf_assessment", status: "in_treatment" },
    user_id: profile.id,
  });

  revalidatePath(UCF_PATH);
  revalidatePath(`${UCF_PATH}/${data.id}`);
  return ok();
}

export async function dischargeReferral(
  input: unknown,
): Promise<ActionResult<void>> {
  const profile = await getCurrentProfile();
  if (!profile) return fail("Not authenticated.");
  if (!hasPermission(profile, "referral.discharge")) {
    return fail("You don't have permission to discharge patients.");
  }

  const parsed = dischargeReferralSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  const { id, discharge_notes } = parsed.data;

  const admin = createAdminClient();
  const { error } = await admin
    .schema("palaro")
    .from("referrals")
    .update({
      status: "discharged",
      discharge_notes,
      discharged_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return fail(error.message);

  await recordAudit({
    action: "update",
    entity_type: "referral",
    entity_id: id,
    changes: { status: "discharged" },
    user_id: profile.id,
  });

  revalidatePath(UCF_PATH);
  revalidatePath(`${UCF_PATH}/${id}`);
  revalidatePath(MEDICAL_INCIDENTS_PATH);
  return ok();
}

export async function createFieldReferral(
  input: unknown,
): Promise<ActionResult<{ id: string; referral_number: string }>> {
  const profile = await getCurrentProfile();
  if (!profile) return fail("Not authenticated.");
  if (!hasPermission(profile, "referral.create_field_to_ucf")) {
    return fail("You don't have permission to create referrals.");
  }

  const parsed = createFieldReferralSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  const data = parsed.data;

  const admin = createAdminClient();

  // Verify target site is actually a UCF.
  const { data: target } = await admin
    .schema("palaro")
    .from("sites")
    .select("id, site_type, name")
    .eq("id", data.to_site_id)
    .single();
  if (!target) return fail("Target UCF not found.");
  if (target.site_type !== "urgent_care_facility") {
    return fail("Target site must be an Urgent Care Facility.");
  }

  // Strip undefined fields out of vitals so we don't store noisy nulls.
  const cleanedVitals = data.vital_signs
    ? Object.fromEntries(
        Object.entries(data.vital_signs).filter(([, v]) => v !== undefined && v !== ""),
      )
    : null;
  const vitals: Json | null =
    cleanedVitals && Object.keys(cleanedVitals).length > 0
      ? (cleanedVitals as Json)
      : null;

  const { data: inserted, error } = await admin
    .schema("palaro")
    .from("referrals")
    .insert({
      level: "field_to_ucf",
      status: "pending",
      incident_id: data.incident_id || null,
      from_site_id: data.from_site_id || profile.primary_assignment_site_id || null,
      to_site_id: data.to_site_id,
      patient_name: data.patient_name,
      patient_age: data.patient_age ?? null,
      patient_gender: data.patient_gender || null,
      delegation_id: data.delegation_id || null,
      chief_complaint: data.chief_complaint || null,
      treatment_given: data.treatment_given || null,
      vital_signs: vitals,
      referred_by: profile.id,
      referred_at: new Date().toISOString(),
    })
    .select("id, referral_number")
    .single();
  if (error) return fail(error.message);

  // Side effects (best-effort — don't fail the whole action if these fail):
  // 1. Flip the source incident to 'referred'
  // 2. Notify the receiving UCF
  if (data.incident_id) {
    await admin
      .schema("palaro")
      .from("incidents")
      .update({ status: "referred" })
      .eq("id", data.incident_id);
  }

  // Per-user notifications for everyone whose primary assignment is the target UCF…
  const { data: assignedMedics } = await admin
    .schema("palaro")
    .from("profiles")
    .select("id")
    .eq("role", "medical_ucf")
    .eq("status", "active")
    .eq("primary_assignment_site_id", data.to_site_id);

  const notificationRows: NotificationInsert[] = (assignedMedics ?? []).map(
    (m) => ({
      recipient_id: m.id,
      recipient_role: null,
      title: `New referral: ${data.patient_name}`,
      body: data.chief_complaint
        ? data.chief_complaint.slice(0, 240)
        : "Pending UCF assessment",
      category: "referral",
      severity: "warning",
      reference_type: "referral",
      reference_id: inserted.id,
      link_url: `${UCF_PATH}/${inserted.id}`,
    }),
  );

  // …plus a role-broadcast as a fallback in case nobody is assigned to that UCF yet.
  notificationRows.push({
    recipient_id: null,
    recipient_role: "medical_ucf",
    title: `New referral at ${target.name}: ${data.patient_name}`,
    body: data.chief_complaint
      ? data.chief_complaint.slice(0, 240)
      : "Pending UCF assessment",
    category: "referral",
    severity: "warning",
    reference_type: "referral",
    reference_id: inserted.id,
    link_url: `${UCF_PATH}/${inserted.id}`,
  });

  if (notificationRows.length > 0) {
    await admin
      .schema("palaro")
      .from("notifications")
      .insert(notificationRows);
  }

  await recordAudit({
    action: "create",
    entity_type: "referral",
    entity_id: inserted.id,
    changes: {
      referral_number: inserted.referral_number,
      level: "field_to_ucf",
      to_site_id: data.to_site_id,
      patient_name: data.patient_name,
    },
    user_id: profile.id,
  });

  revalidatePath(MEDICAL_INCIDENTS_PATH);
  revalidatePath(UCF_PATH);
  if (data.incident_id) {
    revalidatePath(`${INCIDENTS_PATH}/${data.incident_id}`);
    revalidatePath(INCIDENTS_PATH);
  }
  return ok({ id: inserted.id, referral_number: inserted.referral_number });
}

export async function createUcfToHospitalReferral(
  input: unknown,
): Promise<ActionResult<{ id: string; referral_number: string }>> {
  const profile = await getCurrentProfile();
  if (!profile) return fail("Not authenticated.");
  if (!hasPermission(profile, "referral.create_ucf_to_hospital")) {
    return fail("You don't have permission to escalate to hospital.");
  }

  const parsed = createUcfToHospitalReferralSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  const data = parsed.data;

  const admin = createAdminClient();

  // Load the source UCF referral so we can carry forward patient + assessment data.
  const { data: source, error: sourceError } = await admin
    .schema("palaro")
    .from("referrals")
    .select("*")
    .eq("id", data.source_ucf_referral_id)
    .single();
  if (sourceError) return fail(sourceError.message);
  if (source.level !== "field_to_ucf") {
    return fail("Source referral must be a field-to-UCF referral.");
  }
  if (source.status !== "accepted" && source.status !== "in_treatment") {
    return fail(
      "Source referral must be accepted or in treatment to escalate.",
    );
  }

  // Verify target is a hospital.
  const { data: target } = await admin
    .schema("palaro")
    .from("sites")
    .select("id, site_type, name")
    .eq("id", data.to_site_id)
    .single();
  if (!target) return fail("Target hospital not found.");
  if (target.site_type !== "hospital") {
    return fail("Target site must be a Hospital.");
  }

  // Insert hospital-level referral, carrying forward patient + assessment.
  const { data: inserted, error } = await admin
    .schema("palaro")
    .from("referrals")
    .insert({
      level: "ucf_to_hospital",
      status: "pending",
      incident_id: source.incident_id,
      from_site_id: source.to_site_id,
      to_site_id: data.to_site_id,
      patient_name: source.patient_name,
      patient_age: source.patient_age,
      patient_gender: source.patient_gender,
      delegation_id: source.delegation_id,
      chief_complaint: source.chief_complaint,
      initial_diagnosis: source.initial_diagnosis,
      vital_signs: source.vital_signs,
      treatment_given: [
        source.treatment_given,
        source.treatment_plan ? `UCF plan: ${source.treatment_plan}` : null,
        data.escalation_notes
          ? `Escalation: ${data.escalation_notes}`
          : null,
      ]
        .filter(Boolean)
        .join("\n\n") || null,
      referred_by: profile.id,
      referred_at: new Date().toISOString(),
    })
    .select("id, referral_number")
    .single();
  if (error) return fail(error.message);

  // Mark the source UCF referral as admitted (patient left UCF for hospital).
  await admin
    .schema("palaro")
    .from("referrals")
    .update({
      status: "admitted",
      discharge_notes: data.escalation_notes
        ? `Escalated to ${target.name}: ${data.escalation_notes}`
        : `Escalated to ${target.name}`,
      discharged_at: new Date().toISOString(),
    })
    .eq("id", source.id);

  // Notify hospital users assigned to the target site + role broadcast as fallback.
  const { data: assignedHospitalStaff } = await admin
    .schema("palaro")
    .from("profiles")
    .select("id")
    .eq("role", "medical_hospital")
    .eq("status", "active")
    .eq("primary_assignment_site_id", data.to_site_id);

  const notificationRows: NotificationInsert[] = (
    assignedHospitalStaff ?? []
  ).map((m) => ({
    recipient_id: m.id,
    recipient_role: null,
    title: `Hospital referral: ${source.patient_name}`,
    body:
      source.initial_diagnosis ||
      source.chief_complaint ||
      "Pending hospital reception",
    category: "referral",
    severity: "warning",
    reference_type: "referral",
    reference_id: inserted.id,
    link_url: `${HOSPITAL_PATH}/${inserted.id}`,
  }));
  notificationRows.push({
    recipient_id: null,
    recipient_role: "medical_hospital",
    title: `Hospital referral at ${target.name}: ${source.patient_name}`,
    body:
      source.initial_diagnosis ||
      source.chief_complaint ||
      "Pending hospital reception",
    category: "referral",
    severity: "warning",
    reference_type: "referral",
    reference_id: inserted.id,
    link_url: `${HOSPITAL_PATH}/${inserted.id}`,
  });

  if (notificationRows.length > 0) {
    await admin
      .schema("palaro")
      .from("notifications")
      .insert(notificationRows);
  }

  await recordAudit({
    action: "create",
    entity_type: "referral",
    entity_id: inserted.id,
    changes: {
      referral_number: inserted.referral_number,
      level: "ucf_to_hospital",
      source_referral_id: source.id,
      to_site_id: data.to_site_id,
    },
    user_id: profile.id,
  });

  revalidatePath(UCF_PATH);
  revalidatePath(`${UCF_PATH}/${source.id}`);
  revalidatePath(HOSPITAL_PATH);
  if (source.incident_id) {
    revalidatePath(`${INCIDENTS_PATH}/${source.incident_id}`);
  }
  return ok({ id: inserted.id, referral_number: inserted.referral_number });
}

// Returns all referrals connected to the same incident (the patient's chain).
// If the referral is not linked to an incident, returns just that referral.
export async function getReferralChain(
  referralId: string,
): Promise<
  ActionResult<{
    referrals: Referral[];
    incident: Database["palaro"]["Tables"]["incidents"]["Row"] | null;
  }>
> {
  const profile = await getCurrentProfile();
  if (!profile) return fail("Not authenticated.");
  if (!hasPermission(profile, "incident.view")) {
    return fail("You don't have permission to view patient timelines.");
  }

  const admin = createAdminClient();

  const { data: anchor, error: anchorError } = await admin
    .schema("palaro")
    .from("referrals")
    .select("*")
    .eq("id", referralId)
    .single();
  if (anchorError) return fail(anchorError.message);

  if (!anchor.incident_id) {
    return ok({ referrals: [anchor], incident: null });
  }

  const [{ data: referrals }, { data: incident }] = await Promise.all([
    admin
      .schema("palaro")
      .from("referrals")
      .select("*")
      .eq("incident_id", anchor.incident_id)
      .order("referred_at", { ascending: true }),
    admin
      .schema("palaro")
      .from("incidents")
      .select("*")
      .eq("id", anchor.incident_id)
      .single(),
  ]);

  return ok({
    referrals: referrals ?? [anchor],
    incident: incident ?? null,
  });
}

// =============================================================================
// HOSPITAL FLOW
// =============================================================================

export async function getHospitalInbox(): Promise<ActionResult<Referral[]>> {
  const profile = await getCurrentProfile();
  if (!profile) return fail("Not authenticated.");
  if (
    !hasPermission(profile, "referral.accept") &&
    !hasPermission(profile, "referral.assess") &&
    !hasPermission(profile, "referral.discharge")
  ) {
    return fail("You don't have permission to view the hospital inbox.");
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .schema("palaro")
    .from("referrals")
    .select("*")
    .in("level", ["ucf_to_hospital", "hospital_admit"])
    .order("referred_at", { ascending: false })
    .limit(500);
  if (error) return fail(error.message);
  return ok(data ?? []);
}

export async function submitHospitalAssessment(
  input: unknown,
): Promise<ActionResult<void>> {
  const profile = await getCurrentProfile();
  if (!profile) return fail("Not authenticated.");
  if (!hasPermission(profile, "referral.assess")) {
    return fail("You don't have permission to submit hospital assessments.");
  }

  const parsed = submitHospitalAssessmentSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  const data = parsed.data;

  const admin = createAdminClient();

  let mergedVitals: Json | null = null;
  if (data.vitals_on_arrival) {
    const arrival = Object.fromEntries(
      Object.entries(data.vitals_on_arrival).filter(
        ([, v]) => v !== undefined && v !== "",
      ),
    );
    if (Object.keys(arrival).length > 0) {
      const { data: existing } = await admin
        .schema("palaro")
        .from("referrals")
        .select("vital_signs")
        .eq("id", data.id)
        .single();
      const existingVitals =
        (existing?.vital_signs as Record<string, unknown> | null) ?? {};
      mergedVitals = { ...existingVitals, on_arrival: arrival } as Json;
    }
  }

  const updates: Database["palaro"]["Tables"]["referrals"]["Update"] = {
    status: "in_treatment",
    initial_diagnosis: data.initial_diagnosis || null,
    treatment_plan: data.treatment_plan || null,
    assessment_notes: data.assessment_notes || null,
  };
  if (mergedVitals !== null) updates.vital_signs = mergedVitals;

  const { error } = await admin
    .schema("palaro")
    .from("referrals")
    .update(updates)
    .eq("id", data.id);
  if (error) return fail(error.message);

  await recordAudit({
    action: "update",
    entity_type: "referral",
    entity_id: data.id,
    changes: { stage: "hospital_assessment", status: "in_treatment" },
    user_id: profile.id,
  });

  revalidatePath(HOSPITAL_PATH);
  revalidatePath(`${HOSPITAL_PATH}/${data.id}`);
  return ok();
}

export async function admitReferral(
  input: unknown,
): Promise<ActionResult<void>> {
  const profile = await getCurrentProfile();
  if (!profile) return fail("Not authenticated.");
  if (!hasPermission(profile, "referral.assess")) {
    return fail("You don't have permission to admit patients.");
  }

  const parsed = admitReferralSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  const { id, admission_notes } = parsed.data;

  const admin = createAdminClient();
  // Append admission notes to assessment_notes (preserves prior assessment).
  const { data: existing } = await admin
    .schema("palaro")
    .from("referrals")
    .select("assessment_notes")
    .eq("id", id)
    .single();
  const composedNotes = [
    existing?.assessment_notes,
    admission_notes ? `Admission: ${admission_notes}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");

  const { error } = await admin
    .schema("palaro")
    .from("referrals")
    .update({
      status: "admitted",
      assessment_notes: composedNotes || null,
    })
    .eq("id", id);
  if (error) return fail(error.message);

  await recordAudit({
    action: "update",
    entity_type: "referral",
    entity_id: id,
    changes: { status: "admitted" },
    user_id: profile.id,
  });

  revalidatePath(HOSPITAL_PATH);
  revalidatePath(`${HOSPITAL_PATH}/${id}`);
  return ok();
}

export async function rejectReferral(
  input: unknown,
): Promise<ActionResult<void>> {
  const profile = await getCurrentProfile();
  if (!profile) return fail("Not authenticated.");
  if (!hasPermission(profile, "referral.accept")) {
    return fail("You don't have permission to reject referrals.");
  }

  const parsed = rejectReferralSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  const { id, reason } = parsed.data;

  const admin = createAdminClient();
  const { error } = await admin
    .schema("palaro")
    .from("referrals")
    .update({
      status: "rejected",
      discharge_notes: `Rejected: ${reason}`,
      discharged_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) return fail(error.message);

  await recordAudit({
    action: "update",
    entity_type: "referral",
    entity_id: id,
    changes: { status: "rejected", reason },
    user_id: profile.id,
  });

  revalidatePath(HOSPITAL_PATH);
  revalidatePath(`${HOSPITAL_PATH}/${id}`);
  return ok();
}

export async function createHospitalAdmit(
  input: unknown,
): Promise<ActionResult<{ id: string; referral_number: string }>> {
  const profile = await getCurrentProfile();
  if (!profile) return fail("Not authenticated.");
  // Hospital staff who can accept referrals can also create direct admits.
  if (!hasPermission(profile, "referral.accept")) {
    return fail("You don't have permission to create hospital admissions.");
  }

  const parsed = createHospitalAdmitSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  const data = parsed.data;

  const admin = createAdminClient();

  const { data: target } = await admin
    .schema("palaro")
    .from("sites")
    .select("id, site_type")
    .eq("id", data.to_site_id)
    .single();
  if (!target) return fail("Hospital site not found.");
  if (target.site_type !== "hospital") {
    return fail("Target site must be a Hospital.");
  }

  const cleanedVitals = data.vital_signs
    ? Object.fromEntries(
        Object.entries(data.vital_signs).filter(
          ([, v]) => v !== undefined && v !== "",
        ),
      )
    : null;
  const vitals: Json | null =
    cleanedVitals && Object.keys(cleanedVitals).length > 0
      ? (cleanedVitals as Json)
      : null;

  const { data: inserted, error } = await admin
    .schema("palaro")
    .from("referrals")
    .insert({
      level: "hospital_admit",
      status: "pending",
      to_site_id: data.to_site_id,
      from_site_id: profile.primary_assignment_site_id || null,
      patient_name: data.patient_name,
      patient_age: data.patient_age ?? null,
      patient_gender: data.patient_gender || null,
      delegation_id: data.delegation_id || null,
      chief_complaint: data.chief_complaint || null,
      initial_diagnosis: data.initial_diagnosis || null,
      treatment_given: data.treatment_given || null,
      vital_signs: vitals,
      referred_by: profile.id,
      referred_at: new Date().toISOString(),
    })
    .select("id, referral_number")
    .single();
  if (error) return fail(error.message);

  await recordAudit({
    action: "create",
    entity_type: "referral",
    entity_id: inserted.id,
    changes: {
      referral_number: inserted.referral_number,
      level: "hospital_admit",
      to_site_id: data.to_site_id,
      patient_name: data.patient_name,
    },
    user_id: profile.id,
  });

  revalidatePath(HOSPITAL_PATH);
  return ok({ id: inserted.id, referral_number: inserted.referral_number });
}
