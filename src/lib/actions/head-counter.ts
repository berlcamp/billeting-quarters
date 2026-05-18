"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions";
import {
  isInHeadCountWindow,
  saveHeadCounterSchema,
} from "@/lib/schemas/head-counter";
import { recordAudit } from "./audit";
import { fail, ok, type ActionResult } from "./types";
import type { Database } from "@/types/database";

type HeadCounterCell =
  Database["palaro"]["Tables"]["head_counter_cells"]["Row"];
type Profile = Database["palaro"]["Tables"]["profiles"]["Row"];

const HEAD_COUNTER_PATH = "/dashboard/personnel/head-counter";

// Returns whether the caller may READ this delegation's cells. Admins (anyone
// with view_all) can read any delegation; encoders can only read their own.
function canReadDelegation(profile: Profile, delegationId: string): boolean {
  if (hasPermission(profile, "head_count.view_all")) return true;
  if (!hasPermission(profile, "head_count.encode_own")) return false;
  return profile.delegation_id === delegationId;
}

export async function getHeadCounterCells(args: {
  delegationId: string;
  dateYmd: string;
}): Promise<ActionResult<HeadCounterCell[]>> {
  const profile = await getCurrentProfile();
  if (!profile) return fail("Not authenticated.");
  if (!isInHeadCountWindow(args.dateYmd)) {
    return fail("Date is outside the Palaro 2026 head-count window.");
  }
  if (!canReadDelegation(profile, args.delegationId)) {
    return fail("You don't have permission to view this delegation's counts.");
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .schema("palaro")
    .from("head_counter_cells")
    .select("*")
    .eq("delegation_id", args.delegationId)
    .eq("count_date", args.dateYmd);
  if (error) return fail(error.message);
  return ok(data ?? []);
}

export async function getConsolidatedHeadCounter(
  dateYmd: string,
): Promise<ActionResult<HeadCounterCell[]>> {
  const profile = await getCurrentProfile();
  if (!profile) return fail("Not authenticated.");
  if (!hasPermission(profile, "head_count.view_all")) {
    return fail("You don't have permission to view the consolidated report.");
  }
  if (!isInHeadCountWindow(dateYmd)) {
    return fail("Date is outside the Palaro 2026 head-count window.");
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .schema("palaro")
    .from("head_counter_cells")
    .select("*")
    .eq("count_date", dateYmd);
  if (error) return fail(error.message);
  return ok(data ?? []);
}

// Fetch cells for many (delegation, date) pairs at once — used by the print
// route. Admin only.
export async function getHeadCounterCellsForRange(args: {
  fromYmd: string;
  toYmd: string;
  delegationIds?: string[];
}): Promise<ActionResult<HeadCounterCell[]>> {
  const profile = await getCurrentProfile();
  if (!profile) return fail("Not authenticated.");
  if (!hasPermission(profile, "head_count.view_all")) {
    return fail("You don't have permission to view consolidated counts.");
  }
  if (!isInHeadCountWindow(args.fromYmd) || !isInHeadCountWindow(args.toYmd)) {
    return fail("Range is outside the Palaro 2026 head-count window.");
  }
  if (args.fromYmd > args.toYmd) return fail("Range start is after end.");

  const admin = createAdminClient();
  let q = admin
    .schema("palaro")
    .from("head_counter_cells")
    .select("*")
    .gte("count_date", args.fromYmd)
    .lte("count_date", args.toYmd);
  if (args.delegationIds && args.delegationIds.length > 0) {
    q = q.in("delegation_id", args.delegationIds);
  }
  const { data, error } = await q;
  if (error) return fail(error.message);
  return ok(data ?? []);
}

export async function saveHeadCounter(
  input: unknown,
): Promise<ActionResult<void>> {
  const profile = await getCurrentProfile();
  if (!profile) return fail("Not authenticated.");

  const parsed = saveHeadCounterSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  const data = parsed.data;

  if (!isInHeadCountWindow(data.count_date)) {
    return fail("Date is outside the Palaro 2026 head-count window.");
  }

  const isAdmin = hasPermission(profile, "head_count.view_all");
  const isEncoder = hasPermission(profile, "head_count.encode_own");
  if (!isAdmin) {
    if (!isEncoder) {
      return fail("You don't have permission to edit head counts.");
    }
    if (!profile.delegation_id) {
      return fail(
        "Your account isn't linked to a delegation. Ask an admin to assign one.",
      );
    }
    if (profile.delegation_id !== data.delegation_id) {
      return fail("You can only edit your own delegation's counts.");
    }
  }

  const admin = createAdminClient();

  const positives = data.cells.filter((c) => c.count > 0);
  const zeros = data.cells.filter((c) => c.count === 0);

  if (positives.length > 0) {
    const rows = positives.map((c) => ({
      delegation_id: data.delegation_id,
      count_date: data.count_date,
      direction: c.direction,
      role: c.role,
      count: c.count,
      updated_by: profile.id,
      updated_at: new Date().toISOString(),
    }));
    const { error } = await admin
      .schema("palaro")
      .from("head_counter_cells")
      .upsert(rows, {
        onConflict: "delegation_id,count_date,direction,role",
      });
    if (error) return fail(error.message);
  }

  // Cells the user blanked out — delete one per (direction, role).
  for (const z of zeros) {
    const { error } = await admin
      .schema("palaro")
      .from("head_counter_cells")
      .delete()
      .eq("delegation_id", data.delegation_id)
      .eq("count_date", data.count_date)
      .eq("direction", z.direction)
      .eq("role", z.role);
    if (error) return fail(error.message);
  }

  await recordAudit({
    action: "update",
    entity_type: "head_counter",
    entity_id: `${data.delegation_id}:${data.count_date}`,
    changes: {
      cells_written: positives.length,
      cells_cleared: zeros.length,
    },
    user_id: profile.id,
  });

  revalidatePath(HEAD_COUNTER_PATH);
  return ok();
}
