"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions";
import {
  createPatientSchema,
  createVisitSchema,
  updatePatientSchema,
} from "@/lib/schemas/clinic";
import { recordAudit } from "./audit";
import { fail, ok, type ActionResult } from "./types";
import type { Database, Json } from "@/types/database";

type Patient = Database["palaro"]["Tables"]["clinic_patients"]["Row"];
type Visit = Database["palaro"]["Tables"]["clinic_visits"]["Row"];

const CLINIC_PATH = "/dashboard/medical/clinic";

async function requireClinicStaff() {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false as const, error: "Not authenticated." };
  if (!hasPermission(profile, "clinic.manage")) {
    return {
      ok: false as const,
      error: "You don't have permission to manage the clinic.",
    };
  }
  return { ok: true as const, profile };
}

// =============================================================================
// PATIENTS
// =============================================================================

export async function getPatients(): Promise<ActionResult<Patient[]>> {
  const auth = await requireClinicStaff();
  if (!auth.ok) return fail(auth.error);

  const admin = createAdminClient();
  const { data, error } = await admin
    .schema("palaro")
    .from("clinic_patients")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1000);
  if (error) return fail(error.message);
  return ok(data ?? []);
}

export async function getPatient(
  id: string,
): Promise<ActionResult<Patient>> {
  const auth = await requireClinicStaff();
  if (!auth.ok) return fail(auth.error);

  const admin = createAdminClient();
  const { data, error } = await admin
    .schema("palaro")
    .from("clinic_patients")
    .select("*")
    .eq("id", id)
    .single();
  if (error) return fail(error.message);
  return ok(data);
}

export async function createPatient(
  input: unknown,
): Promise<ActionResult<{ id: string; patient_number: string }>> {
  const auth = await requireClinicStaff();
  if (!auth.ok) return fail(auth.error);

  const parsed = createPatientSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  const data = parsed.data;

  const admin = createAdminClient();
  const { data: inserted, error } = await admin
    .schema("palaro")
    .from("clinic_patients")
    .insert({
      full_name: data.full_name,
      age: data.age ?? null,
      gender: data.gender ?? null,
      delegation_id: data.delegation_id || null,
      phone: data.phone || null,
      emergency_contact: data.emergency_contact || null,
      allergies: data.allergies || null,
      medical_history: data.medical_history || null,
    })
    .select("id, patient_number")
    .single();
  if (error) return fail(error.message);

  await recordAudit({
    action: "create",
    entity_type: "clinic_patient",
    entity_id: inserted.id,
    changes: {
      patient_number: inserted.patient_number,
      full_name: data.full_name,
      delegation_id: data.delegation_id ?? null,
    },
    user_id: auth.profile.id,
  });

  revalidatePath(CLINIC_PATH);
  return ok({ id: inserted.id, patient_number: inserted.patient_number });
}

export async function updatePatient(
  input: unknown,
): Promise<ActionResult<void>> {
  const auth = await requireClinicStaff();
  if (!auth.ok) return fail(auth.error);

  const parsed = updatePatientSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  const { id, ...data } = parsed.data;

  const admin = createAdminClient();
  const { error } = await admin
    .schema("palaro")
    .from("clinic_patients")
    .update({
      full_name: data.full_name,
      age: data.age ?? null,
      gender: data.gender ?? null,
      delegation_id: data.delegation_id || null,
      phone: data.phone || null,
      emergency_contact: data.emergency_contact || null,
      allergies: data.allergies || null,
      medical_history: data.medical_history || null,
    })
    .eq("id", id);
  if (error) return fail(error.message);

  await recordAudit({
    action: "update",
    entity_type: "clinic_patient",
    entity_id: id,
    changes: { full_name: data.full_name },
    user_id: auth.profile.id,
  });

  revalidatePath(CLINIC_PATH);
  return ok();
}

// =============================================================================
// VISITS
// =============================================================================

export async function getVisits(limit = 200): Promise<ActionResult<Visit[]>> {
  const auth = await requireClinicStaff();
  if (!auth.ok) return fail(auth.error);

  const admin = createAdminClient();
  const { data, error } = await admin
    .schema("palaro")
    .from("clinic_visits")
    .select("*")
    .order("visit_date", { ascending: false })
    .limit(limit);
  if (error) return fail(error.message);
  return ok(data ?? []);
}

export async function getPatientVisits(
  patientId: string,
): Promise<ActionResult<Visit[]>> {
  const auth = await requireClinicStaff();
  if (!auth.ok) return fail(auth.error);

  const admin = createAdminClient();
  const { data, error } = await admin
    .schema("palaro")
    .from("clinic_visits")
    .select("*")
    .eq("patient_id", patientId)
    .order("visit_date", { ascending: false });
  if (error) return fail(error.message);
  return ok(data ?? []);
}

export async function createVisit(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const auth = await requireClinicStaff();
  if (!auth.ok) return fail(auth.error);

  const parsed = createVisitSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  const data = parsed.data;

  const admin = createAdminClient();

  // Verify the chosen site is actually a clinic. Walk-in visits should not
  // be logged at hospitals or playing venues.
  const { data: site } = await admin
    .schema("palaro")
    .from("sites")
    .select("id, site_type")
    .eq("id", data.site_id)
    .single();
  if (!site) return fail("Site not found.");
  if (site.site_type !== "clinic") {
    return fail("Selected site is not a clinic.");
  }

  // Strip empty/undefined vitals.
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
    .from("clinic_visits")
    .insert({
      patient_id: data.patient_id,
      site_id: data.site_id,
      vital_signs: vitals,
      chief_complaint: data.chief_complaint || null,
      diagnosis: data.diagnosis || null,
      prescription: data.prescription || null,
      notes: data.notes || null,
      attended_by: auth.profile.id,
    })
    .select("id")
    .single();
  if (error) return fail(error.message);

  await recordAudit({
    action: "create",
    entity_type: "clinic_visit",
    entity_id: inserted.id,
    changes: {
      patient_id: data.patient_id,
      site_id: data.site_id,
      chief_complaint: data.chief_complaint ?? null,
    },
    user_id: auth.profile.id,
  });

  revalidatePath(CLINIC_PATH);
  return ok({ id: inserted.id });
}
