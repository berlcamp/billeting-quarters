"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions";
import {
  isInHeadCountWindow,
  saveHeadCounterVenueSchema,
} from "@/lib/schemas/head-counter";
import { recordAudit } from "./audit";
import { fail, ok, type ActionResult } from "./types";
import type { Database } from "@/types/database";

type HeadCounterVenueCell =
  Database["palaro"]["Tables"]["head_counter_venue_cells"]["Row"];

const HEAD_COUNTER_PATH = "/dashboard/personnel/head-counter";

// Venue-tab read gate. Anyone with venue_view_all can read every site's
// cells; venue_encode (e.g. venue_manager) can also read any site so the
// switcher works.
function canReadVenue(profile: {
  roles: readonly Database["palaro"]["Enums"]["user_role"][] | null;
}): boolean {
  return (
    hasPermission(profile, "head_count.venue_view_all") ||
    hasPermission(profile, "head_count.venue_encode")
  );
}

export async function getHeadCounterVenueCells(args: {
  siteId: string;
  dateYmd: string;
}): Promise<ActionResult<HeadCounterVenueCell[]>> {
  const profile = await getCurrentProfile();
  if (!profile) return fail("Not authenticated.");
  if (!isInHeadCountWindow(args.dateYmd)) {
    return fail("Date is outside the Palaro 2026 head-count window.");
  }
  if (!canReadVenue(profile)) {
    return fail("You don't have permission to view venue counts.");
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .schema("palaro")
    .from("head_counter_venue_cells")
    .select("*")
    .eq("site_id", args.siteId)
    .eq("count_date", args.dateYmd);
  if (error) return fail(error.message);
  return ok(data ?? []);
}

export async function getConsolidatedHeadCounterVenue(
  dateYmd: string,
): Promise<ActionResult<HeadCounterVenueCell[]>> {
  const profile = await getCurrentProfile();
  if (!profile) return fail("Not authenticated.");
  if (!hasPermission(profile, "head_count.venue_view_all")) {
    return fail("You don't have permission to view the consolidated report.");
  }
  if (!isInHeadCountWindow(dateYmd)) {
    return fail("Date is outside the Palaro 2026 head-count window.");
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .schema("palaro")
    .from("head_counter_venue_cells")
    .select("*")
    .eq("count_date", dateYmd);
  if (error) return fail(error.message);
  return ok(data ?? []);
}

export async function getHeadCounterVenueCellsForRange(args: {
  fromYmd: string;
  toYmd: string;
  siteIds?: string[];
}): Promise<ActionResult<HeadCounterVenueCell[]>> {
  const profile = await getCurrentProfile();
  if (!profile) return fail("Not authenticated.");
  if (!hasPermission(profile, "head_count.venue_view_all")) {
    return fail("You don't have permission to view consolidated venue counts.");
  }
  if (!isInHeadCountWindow(args.fromYmd) || !isInHeadCountWindow(args.toYmd)) {
    return fail("Range is outside the Palaro 2026 head-count window.");
  }
  if (args.fromYmd > args.toYmd) return fail("Range start is after end.");

  const admin = createAdminClient();
  let q = admin
    .schema("palaro")
    .from("head_counter_venue_cells")
    .select("*")
    .gte("count_date", args.fromYmd)
    .lte("count_date", args.toYmd);
  if (args.siteIds && args.siteIds.length > 0) {
    q = q.in("site_id", args.siteIds);
  }
  const { data, error } = await q;
  if (error) return fail(error.message);
  return ok(data ?? []);
}

export async function saveHeadCounterVenue(
  input: unknown,
): Promise<ActionResult<void>> {
  const profile = await getCurrentProfile();
  if (!profile) return fail("Not authenticated.");

  const parsed = saveHeadCounterVenueSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  const data = parsed.data;

  if (!isInHeadCountWindow(data.count_date)) {
    return fail("Date is outside the Palaro 2026 head-count window.");
  }

  if (!hasPermission(profile, "head_count.venue_encode")) {
    return fail("You don't have permission to edit venue head counts.");
  }

  const admin = createAdminClient();

  // Confirm the target site is actually a playing venue. Prevents accidental
  // writes against BQ / hospital / UCF sites through a stale UI.
  const { data: site, error: siteError } = await admin
    .schema("palaro")
    .from("sites")
    .select("id, site_type")
    .eq("id", data.site_id)
    .maybeSingle();
  if (siteError) return fail(siteError.message);
  if (!site) return fail("Venue not found.");
  if (site.site_type !== "playing_venue") {
    return fail("Head Counter (Venue) only accepts playing-venue sites.");
  }

  const positives = data.cells.filter((c) => c.count > 0);
  const zeros = data.cells.filter((c) => c.count === 0);

  if (positives.length > 0) {
    const rows = positives.map((c) => ({
      site_id: data.site_id,
      count_date: data.count_date,
      direction: c.direction,
      role: c.role,
      count: c.count,
      updated_by: profile.id,
      updated_at: new Date().toISOString(),
    }));
    const { error } = await admin
      .schema("palaro")
      .from("head_counter_venue_cells")
      .upsert(rows, {
        onConflict: "site_id,count_date,direction,role",
      });
    if (error) return fail(error.message);
  }

  for (const z of zeros) {
    const { error } = await admin
      .schema("palaro")
      .from("head_counter_venue_cells")
      .delete()
      .eq("site_id", data.site_id)
      .eq("count_date", data.count_date)
      .eq("direction", z.direction)
      .eq("role", z.role);
    if (error) return fail(error.message);
  }

  await recordAudit({
    action: "update",
    entity_type: "head_counter_venue",
    entity_id: `${data.site_id}:${data.count_date}`,
    changes: {
      cells_written: positives.length,
      cells_cleared: zeros.length,
    },
    user_id: profile.id,
  });

  revalidatePath(HEAD_COUNTER_PATH);
  return ok();
}
