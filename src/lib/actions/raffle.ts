"use server";

import { revalidatePath } from "next/cache";
import { randomInt } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions";
import {
  addEntriesBulkSchema,
  clearDepartmentEntriesSchema,
  clearWinnersSchema,
  createDepartmentSchema,
  createRaffleSchema,
  deleteDepartmentSchema,
  deleteEntrySchema,
  deleteRaffleSchema,
  drawWinnerSchema,
  resetSessionSchema,
  updateDepartmentSchema,
  updateRaffleSchema,
} from "@/lib/schemas/raffle";
import { recordAudit } from "./audit";
import { fail, ok, type ActionResult } from "./types";
import type { Database } from "@/types/database";

type Raffle = Database["palaro"]["Tables"]["raffles"]["Row"];
type Department = Database["palaro"]["Tables"]["raffle_departments"]["Row"];
type Entry = Database["palaro"]["Tables"]["raffle_entries"]["Row"];
type Winner = Database["palaro"]["Tables"]["raffle_winners"]["Row"];

const ADMIN_LIST_PATH = "/dashboard/raffle";
const adminDetailPath = (raffleId: string) => `/dashboard/raffle/${raffleId}`;

async function requireManager() {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false as const, error: "Not authenticated." };
  if (!hasPermission(profile, "raffle.manage")) {
    return {
      ok: false as const,
      error: "You don't have permission to manage raffles.",
    };
  }
  return { ok: true as const, profile };
}

async function requireDrawer() {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false as const, error: "Not authenticated." };
  if (!hasPermission(profile, "raffle.draw")) {
    return {
      ok: false as const,
      error: "You don't have permission to run the raffle draw.",
    };
  }
  return { ok: true as const, profile };
}

async function requireViewer() {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false as const, error: "Not authenticated." };
  if (!hasPermission(profile, "raffle.view")) {
    return {
      ok: false as const,
      error: "You don't have permission to view raffles.",
    };
  }
  return { ok: true as const, profile };
}

// ── Raffle CRUD ──────────────────────────────────────────────────────────

export async function getRaffles(): Promise<ActionResult<Raffle[]>> {
  const auth = await requireViewer();
  if (!auth.ok) return fail(auth.error);

  const admin = createAdminClient();
  const { data, error } = await admin
    .schema("palaro")
    .from("raffles")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false });
  if (error) return fail(error.message);
  return ok(data ?? []);
}

export type RaffleDetail = {
  raffle: Raffle;
  departments: (Department & { entry_count: number })[];
};

export async function getRaffle(
  id: string,
): Promise<ActionResult<RaffleDetail>> {
  const auth = await requireViewer();
  if (!auth.ok) return fail(auth.error);

  const admin = createAdminClient();
  const { data: raffle, error: raffleError } = await admin
    .schema("palaro")
    .from("raffles")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (raffleError) return fail(raffleError.message);
  if (!raffle) return fail("Raffle not found.");

  const { data: departments, error: deptError } = await admin
    .schema("palaro")
    .from("raffle_departments")
    .select("*")
    .eq("raffle_id", id)
    .order("name", { ascending: true });
  if (deptError) return fail(deptError.message);

  const deptList = departments ?? [];
  const counts = new Map<string, number>();
  if (deptList.length > 0) {
    const { data: entryRows } = await admin
      .schema("palaro")
      .from("raffle_entries")
      .select("department_id")
      .eq("raffle_id", id);
    for (const row of entryRows ?? []) {
      counts.set(row.department_id, (counts.get(row.department_id) ?? 0) + 1);
    }
  }

  return ok({
    raffle,
    departments: deptList.map((d) => ({
      ...d,
      entry_count: counts.get(d.id) ?? 0,
    })),
  });
}

export async function createRaffle(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const auth = await requireManager();
  if (!auth.ok) return fail(auth.error);

  const parsed = createRaffleSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input.");

  const admin = createAdminClient();
  const { data, error } = await admin
    .schema("palaro")
    .from("raffles")
    .insert({
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      created_by: auth.profile.id,
    })
    .select("id")
    .single();
  if (error) return fail(error.message);

  await recordAudit({
    action: "create",
    entity_type: "raffle",
    entity_id: data.id,
    changes: { name: parsed.data.name },
    user_id: auth.profile.id,
  });
  revalidatePath(ADMIN_LIST_PATH);
  return ok({ id: data.id });
}

export async function updateRaffle(
  input: unknown,
): Promise<ActionResult<void>> {
  const auth = await requireManager();
  if (!auth.ok) return fail(auth.error);

  const parsed = updateRaffleSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input.");

  const admin = createAdminClient();
  const { error } = await admin
    .schema("palaro")
    .from("raffles")
    .update({
      name: parsed.data.name,
      description: parsed.data.description ?? null,
    })
    .eq("id", parsed.data.id);
  if (error) return fail(error.message);

  await recordAudit({
    action: "update",
    entity_type: "raffle",
    entity_id: parsed.data.id,
    changes: { name: parsed.data.name },
    user_id: auth.profile.id,
  });
  revalidatePath(ADMIN_LIST_PATH);
  revalidatePath(adminDetailPath(parsed.data.id));
  return ok();
}

export async function deleteRaffle(
  input: unknown,
): Promise<ActionResult<void>> {
  const auth = await requireManager();
  if (!auth.ok) return fail(auth.error);

  const parsed = deleteRaffleSchema.safeParse(input);
  if (!parsed.success) return fail("Invalid input.");

  const admin = createAdminClient();
  // Soft-delete to keep audit/history queryable. Hard cascade would lose names.
  const { error } = await admin
    .schema("palaro")
    .from("raffles")
    .update({ is_active: false })
    .eq("id", parsed.data.id);
  if (error) return fail(error.message);

  await recordAudit({
    action: "delete",
    entity_type: "raffle",
    entity_id: parsed.data.id,
    user_id: auth.profile.id,
  });
  revalidatePath(ADMIN_LIST_PATH);
  return ok();
}

// ── Departments ──────────────────────────────────────────────────────────

export async function createDepartment(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  const auth = await requireManager();
  if (!auth.ok) return fail(auth.error);

  const parsed = createDepartmentSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input.");

  const admin = createAdminClient();
  const { data, error } = await admin
    .schema("palaro")
    .from("raffle_departments")
    .insert({
      raffle_id: parsed.data.raffle_id,
      name: parsed.data.name,
    })
    .select("id")
    .single();
  if (error) {
    if (error.code === "23505") {
      return fail("A department with that name already exists in this raffle.");
    }
    return fail(error.message);
  }

  await recordAudit({
    action: "create",
    entity_type: "raffle_department",
    entity_id: data.id,
    changes: { raffle_id: parsed.data.raffle_id, name: parsed.data.name },
    user_id: auth.profile.id,
  });
  revalidatePath(adminDetailPath(parsed.data.raffle_id));
  return ok({ id: data.id });
}

export async function updateDepartment(
  input: unknown,
): Promise<ActionResult<void>> {
  const auth = await requireManager();
  if (!auth.ok) return fail(auth.error);

  const parsed = updateDepartmentSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input.");

  const admin = createAdminClient();
  const { data, error } = await admin
    .schema("palaro")
    .from("raffle_departments")
    .update({ name: parsed.data.name })
    .eq("id", parsed.data.id)
    .select("raffle_id")
    .single();
  if (error) {
    if (error.code === "23505") {
      return fail("A department with that name already exists in this raffle.");
    }
    return fail(error.message);
  }

  await recordAudit({
    action: "update",
    entity_type: "raffle_department",
    entity_id: parsed.data.id,
    changes: { name: parsed.data.name },
    user_id: auth.profile.id,
  });
  if (data) revalidatePath(adminDetailPath(data.raffle_id));
  return ok();
}

export async function deleteDepartment(
  input: unknown,
): Promise<ActionResult<void>> {
  const auth = await requireManager();
  if (!auth.ok) return fail(auth.error);

  const parsed = deleteDepartmentSchema.safeParse(input);
  if (!parsed.success) return fail("Invalid input.");

  const admin = createAdminClient();
  const { data: existing } = await admin
    .schema("palaro")
    .from("raffle_departments")
    .select("raffle_id")
    .eq("id", parsed.data.id)
    .maybeSingle();

  const { error } = await admin
    .schema("palaro")
    .from("raffle_departments")
    .delete()
    .eq("id", parsed.data.id);
  if (error) return fail(error.message);

  await recordAudit({
    action: "delete",
    entity_type: "raffle_department",
    entity_id: parsed.data.id,
    user_id: auth.profile.id,
  });
  if (existing) revalidatePath(adminDetailPath(existing.raffle_id));
  return ok();
}

// ── Entries ──────────────────────────────────────────────────────────────

export async function getEntriesForDepartment(
  departmentId: string,
): Promise<ActionResult<Entry[]>> {
  const auth = await requireViewer();
  if (!auth.ok) return fail(auth.error);

  const admin = createAdminClient();
  const { data, error } = await admin
    .schema("palaro")
    .from("raffle_entries")
    .select("*")
    .eq("department_id", departmentId)
    .order("name", { ascending: true });
  if (error) return fail(error.message);
  return ok(data ?? []);
}

export async function getRaffleEntries(
  raffleId: string,
  departmentId?: string,
): Promise<ActionResult<Pick<Entry, "id" | "name" | "department_id">[]>> {
  const auth = await requireViewer();
  if (!auth.ok) return fail(auth.error);

  const admin = createAdminClient();
  let q = admin
    .schema("palaro")
    .from("raffle_entries")
    .select("id, name, department_id")
    .eq("raffle_id", raffleId);
  if (departmentId) q = q.eq("department_id", departmentId);
  const { data, error } = await q;
  if (error) return fail(error.message);
  return ok(data ?? []);
}

export async function addEntriesBulk(
  input: unknown,
): Promise<ActionResult<{ inserted: number }>> {
  const auth = await requireManager();
  if (!auth.ok) return fail(auth.error);

  const parsed = addEntriesBulkSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input.");

  const admin = createAdminClient();
  const { data: dept, error: deptError } = await admin
    .schema("palaro")
    .from("raffle_departments")
    .select("id, raffle_id")
    .eq("id", parsed.data.department_id)
    .maybeSingle();
  if (deptError) return fail(deptError.message);
  if (!dept) return fail("Department not found.");

  // Chunk inserts so we don't hit any payload size limit on huge pastes.
  const CHUNK = 500;
  let inserted = 0;
  for (let i = 0; i < parsed.data.names.length; i += CHUNK) {
    const slice = parsed.data.names.slice(i, i + CHUNK).map((name) => ({
      department_id: dept.id,
      raffle_id: dept.raffle_id,
      name,
    }));
    const { error } = await admin
      .schema("palaro")
      .from("raffle_entries")
      .insert(slice);
    if (error) return fail(error.message);
    inserted += slice.length;
  }

  await recordAudit({
    action: "create",
    entity_type: "raffle_entry",
    entity_id: dept.id,
    changes: { inserted, department_id: dept.id },
    user_id: auth.profile.id,
  });
  revalidatePath(adminDetailPath(dept.raffle_id));
  return ok({ inserted });
}

export async function deleteEntry(
  input: unknown,
): Promise<ActionResult<void>> {
  const auth = await requireManager();
  if (!auth.ok) return fail(auth.error);

  const parsed = deleteEntrySchema.safeParse(input);
  if (!parsed.success) return fail("Invalid input.");

  const admin = createAdminClient();
  const { data: existing } = await admin
    .schema("palaro")
    .from("raffle_entries")
    .select("raffle_id")
    .eq("id", parsed.data.id)
    .maybeSingle();

  const { error } = await admin
    .schema("palaro")
    .from("raffle_entries")
    .delete()
    .eq("id", parsed.data.id);
  if (error) return fail(error.message);

  await recordAudit({
    action: "delete",
    entity_type: "raffle_entry",
    entity_id: parsed.data.id,
    user_id: auth.profile.id,
  });
  if (existing) revalidatePath(adminDetailPath(existing.raffle_id));
  return ok();
}

export async function clearDepartmentEntries(
  input: unknown,
): Promise<ActionResult<{ deleted: number }>> {
  const auth = await requireManager();
  if (!auth.ok) return fail(auth.error);

  const parsed = clearDepartmentEntriesSchema.safeParse(input);
  if (!parsed.success) return fail("Invalid input.");

  const admin = createAdminClient();
  const { data: dept } = await admin
    .schema("palaro")
    .from("raffle_departments")
    .select("raffle_id")
    .eq("id", parsed.data.department_id)
    .maybeSingle();

  const { error, count } = await admin
    .schema("palaro")
    .from("raffle_entries")
    .delete({ count: "exact" })
    .eq("department_id", parsed.data.department_id);
  if (error) return fail(error.message);

  await recordAudit({
    action: "delete",
    entity_type: "raffle_entry",
    entity_id: parsed.data.department_id,
    changes: { cleared: count ?? 0 },
    user_id: auth.profile.id,
  });
  if (dept) revalidatePath(adminDetailPath(dept.raffle_id));
  return ok({ deleted: count ?? 0 });
}

// ── Winners ──────────────────────────────────────────────────────────────

export async function getRaffleWinners(
  raffleId: string,
): Promise<ActionResult<Winner[]>> {
  const auth = await requireViewer();
  if (!auth.ok) return fail(auth.error);

  const admin = createAdminClient();
  const { data, error } = await admin
    .schema("palaro")
    .from("raffle_winners")
    .select("*")
    .eq("raffle_id", raffleId)
    .order("drawn_at", { ascending: false });
  if (error) return fail(error.message);
  return ok(data ?? []);
}

export type DrawWinnerResult = {
  id: string;
  entry_id: string;
  entry_name: string;
  department_id: string;
  department_name: string;
  draw_index: number;
  session_id: string;
};

export async function drawWinner(
  input: unknown,
): Promise<ActionResult<DrawWinnerResult>> {
  const auth = await requireDrawer();
  if (!auth.ok) return fail(auth.error);

  const parsed = drawWinnerSchema.safeParse(input);
  if (!parsed.success) return fail(parsed.error.issues[0]?.message ?? "Invalid input.");

  const admin = createAdminClient();

  // Pool: entries scoped to raffle + optional department, minus excluded ids
  // (the caller passes the in-session winners so duplicates are impossible).
  let q = admin
    .schema("palaro")
    .from("raffle_entries")
    .select("id, name, department_id")
    .eq("raffle_id", parsed.data.raffle_id);
  if (parsed.data.department_id) q = q.eq("department_id", parsed.data.department_id);
  const { data: pool, error: poolError } = await q;
  if (poolError) return fail(poolError.message);

  const excluded = new Set(parsed.data.excluded_entry_ids);
  const eligible = (pool ?? []).filter((e) => !excluded.has(e.id));
  if (eligible.length === 0) return fail("No eligible entries to draw.");

  const pick = eligible[randomInt(0, eligible.length)];

  // Look up department name (frozen on the winner row).
  const { data: dept, error: deptError } = await admin
    .schema("palaro")
    .from("raffle_departments")
    .select("id, name")
    .eq("id", pick.department_id)
    .maybeSingle();
  if (deptError) return fail(deptError.message);
  if (!dept) return fail("Department for the drawn entry no longer exists.");

  // Compute the next draw_index for this session.
  const { data: prior, error: priorError } = await admin
    .schema("palaro")
    .from("raffle_winners")
    .select("draw_index")
    .eq("session_id", parsed.data.session_id)
    .order("draw_index", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (priorError) return fail(priorError.message);
  const drawIndex = (prior?.draw_index ?? 0) + 1;

  const { data: inserted, error: insertError } = await admin
    .schema("palaro")
    .from("raffle_winners")
    .insert({
      raffle_id: parsed.data.raffle_id,
      department_id: dept.id,
      entry_id: pick.id,
      entry_name: pick.name,
      department_name: dept.name,
      prize_label: parsed.data.prize_label ?? null,
      session_id: parsed.data.session_id,
      draw_index: drawIndex,
      drawn_by: auth.profile.id,
    })
    .select("id")
    .single();
  if (insertError) return fail(insertError.message);

  await recordAudit({
    action: "create",
    entity_type: "raffle_winner",
    entity_id: inserted.id,
    changes: {
      raffle_id: parsed.data.raffle_id,
      session_id: parsed.data.session_id,
      entry_name: pick.name,
      department_name: dept.name,
      draw_index: drawIndex,
    },
    user_id: auth.profile.id,
  });
  revalidatePath(adminDetailPath(parsed.data.raffle_id));

  return ok({
    id: inserted.id,
    entry_id: pick.id,
    entry_name: pick.name,
    department_id: dept.id,
    department_name: dept.name,
    draw_index: drawIndex,
    session_id: parsed.data.session_id,
  });
}

export async function resetSession(
  input: unknown,
): Promise<ActionResult<{ deleted: number }>> {
  const auth = await requireDrawer();
  if (!auth.ok) return fail(auth.error);

  const parsed = resetSessionSchema.safeParse(input);
  if (!parsed.success) return fail("Invalid input.");

  const admin = createAdminClient();
  const { error, count } = await admin
    .schema("palaro")
    .from("raffle_winners")
    .delete({ count: "exact" })
    .eq("raffle_id", parsed.data.raffle_id)
    .eq("session_id", parsed.data.session_id);
  if (error) return fail(error.message);

  await recordAudit({
    action: "delete",
    entity_type: "raffle_winner",
    entity_id: parsed.data.session_id,
    changes: { reset_session: parsed.data.session_id, removed: count ?? 0 },
    user_id: auth.profile.id,
  });
  revalidatePath(adminDetailPath(parsed.data.raffle_id));
  return ok({ deleted: count ?? 0 });
}

export async function clearWinners(
  input: unknown,
): Promise<ActionResult<{ deleted: number }>> {
  const auth = await requireManager();
  if (!auth.ok) return fail(auth.error);

  const parsed = clearWinnersSchema.safeParse(input);
  if (!parsed.success) return fail("Invalid input.");

  const admin = createAdminClient();
  const { error, count } = await admin
    .schema("palaro")
    .from("raffle_winners")
    .delete({ count: "exact" })
    .eq("raffle_id", parsed.data.raffle_id);
  if (error) return fail(error.message);

  await recordAudit({
    action: "delete",
    entity_type: "raffle_winner",
    entity_id: parsed.data.raffle_id,
    changes: { cleared_all: true, removed: count ?? 0 },
    user_id: auth.profile.id,
  });
  revalidatePath(adminDetailPath(parsed.data.raffle_id));
  return ok({ deleted: count ?? 0 });
}
