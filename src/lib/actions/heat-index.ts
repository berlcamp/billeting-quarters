"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions";
import {
  classifyHeatDanger,
  computeHeatIndexCelsius,
  HEAT_DANGER_LABELS,
  shouldSuspendGames,
} from "@/lib/heat-index";
import {
  overrideSuspensionSchema,
  recordHeatReadingSchema,
} from "@/lib/schemas/heat-index";
import { recordAudit } from "./audit";
import { fail, ok, type ActionResult } from "./types";
import type { Database } from "@/types/database";

type HeatReading = Database["palaro"]["Tables"]["heat_index_readings"]["Row"];
type NotificationInsert = Database["palaro"]["Tables"]["notifications"]["Insert"];

const HEAT_PATH = "/dashboard/heat-index";

export async function getReadings(
  siteId?: string,
  limit = 100,
): Promise<ActionResult<HeatReading[]>> {
  const profile = await getCurrentProfile();
  if (!profile) return fail("Not authenticated.");

  const admin = createAdminClient();
  let q = admin
    .schema("palaro")
    .from("heat_index_readings")
    .select("*")
    .order("recorded_at", { ascending: false })
    .limit(limit);
  if (siteId) q = q.eq("site_id", siteId);

  const { data, error } = await q;
  if (error) return fail(error.message);
  return ok(data ?? []);
}

// Returns the latest reading for each site that has at least one reading.
// Sorts client-side after the fetch — fine at our scale (dozens of venues).
export async function getLatestPerSite(): Promise<ActionResult<HeatReading[]>> {
  const profile = await getCurrentProfile();
  if (!profile) return fail("Not authenticated.");

  const admin = createAdminClient();
  const { data, error } = await admin
    .schema("palaro")
    .from("heat_index_readings")
    .select("*")
    .order("recorded_at", { ascending: false })
    .limit(2000);
  if (error) return fail(error.message);

  const seen = new Set<string>();
  const latest: HeatReading[] = [];
  for (const row of data ?? []) {
    if (seen.has(row.site_id)) continue;
    seen.add(row.site_id);
    latest.push(row);
  }
  return ok(latest);
}

export async function recordReading(
  input: unknown,
): Promise<ActionResult<{ id: string; danger_level: string }>> {
  const profile = await getCurrentProfile();
  if (!profile) return fail("Not authenticated.");
  if (!hasPermission(profile, "heat_index.record")) {
    return fail("You don't have permission to record heat-index readings.");
  }

  const parsed = recordHeatReadingSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  const data = parsed.data;

  const admin = createAdminClient();

  // Compute heat index server-side — never trust a client-supplied value for
  // a reading that may trigger game suspension.
  const heatIndex = computeHeatIndexCelsius(
    data.temperature_c,
    data.humidity_percent,
  );
  const dangerLevel = classifyHeatDanger(heatIndex);
  const suspensionRecommended = shouldSuspendGames(dangerLevel);

  // Verify site exists and is a playing venue (the only context where the
  // suspension flag has operational meaning). We allow any site for tracking,
  // but only PV readings fan out venue_manager notifications.
  const { data: site } = await admin
    .schema("palaro")
    .from("sites")
    .select("id, name, site_type")
    .eq("id", data.site_id)
    .single();
  if (!site) return fail("Site not found.");

  const { data: inserted, error } = await admin
    .schema("palaro")
    .from("heat_index_readings")
    .insert({
      site_id: data.site_id,
      temperature_c: data.temperature_c,
      humidity_percent: data.humidity_percent,
      heat_index_c: Number(heatIndex.toFixed(1)),
      danger_level: dangerLevel,
      game_suspension_recommended: suspensionRecommended,
      recorded_by: profile.id,
      notes: data.notes || null,
    })
    .select("id")
    .single();
  if (error) return fail(error.message);

  await recordAudit({
    action: "create",
    entity_type: "heat_index_reading",
    entity_id: inserted.id,
    changes: {
      site_id: data.site_id,
      temperature_c: data.temperature_c,
      humidity_percent: data.humidity_percent,
      heat_index_c: Number(heatIndex.toFixed(1)),
      danger_level: dangerLevel,
      game_suspension_recommended: suspensionRecommended,
    },
    user_id: profile.id,
  });

  // Notify on danger / extreme_danger only — caution and extreme_caution
  // are advisory and would create alert fatigue if broadcast.
  if (dangerLevel === "danger" || dangerLevel === "extreme_danger") {
    const severity = dangerLevel === "extreme_danger" ? "critical" : "warning";
    const title =
      dangerLevel === "extreme_danger"
        ? `EXTREME HEAT at ${site.name} — ${heatIndex.toFixed(1)}°C HI`
        : `Heat danger at ${site.name} — ${heatIndex.toFixed(1)}°C HI`;
    const body = `${HEAT_DANGER_LABELS[dangerLevel]} · Game suspension recommended. Temp ${data.temperature_c}°C / RH ${data.humidity_percent}%.`;

    const rows: NotificationInsert[] = [
      {
        recipient_id: null,
        recipient_role: "command_center",
        title,
        body,
        category: "heat_index",
        severity,
        reference_type: "heat_index_reading",
        reference_id: inserted.id,
        link_url: HEAT_PATH,
      },
    ];

    if (site.site_type === "playing_venue") {
      rows.push({
        recipient_id: null,
        recipient_role: "venue_manager",
        title,
        body,
        category: "heat_index",
        severity,
        reference_type: "heat_index_reading",
        reference_id: inserted.id,
        link_url: HEAT_PATH,
      });
    }

    await admin.schema("palaro").from("notifications").insert(rows);
  }

  revalidatePath(HEAT_PATH);
  return ok({ id: inserted.id, danger_level: dangerLevel });
}

export async function setSuspensionOverride(
  input: unknown,
): Promise<ActionResult<void>> {
  const profile = await getCurrentProfile();
  if (!profile) return fail("Not authenticated.");
  if (!hasPermission(profile, "heat_index.override")) {
    return fail("You don't have permission to override suspension flags.");
  }

  const parsed = overrideSuspensionSchema.safeParse(input);
  if (!parsed.success) {
    return fail(parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  const { reading_id, game_suspension_recommended, reason } = parsed.data;

  const admin = createAdminClient();
  const { data: existing } = await admin
    .schema("palaro")
    .from("heat_index_readings")
    .select("notes, game_suspension_recommended")
    .eq("id", reading_id)
    .single();

  const overrideStamp = new Date().toISOString();
  const overrideLine = `[OVERRIDE ${overrideStamp}] ${profile.full_name ?? profile.email}: ${
    game_suspension_recommended ? "Suspension flag SET" : "Suspension flag CLEARED"
  }. Reason: ${reason}`;
  const composedNotes = [existing?.notes, overrideLine]
    .filter(Boolean)
    .join("\n");

  const { error } = await admin
    .schema("palaro")
    .from("heat_index_readings")
    .update({
      game_suspension_recommended,
      notes: composedNotes,
    })
    .eq("id", reading_id);
  if (error) return fail(error.message);

  await recordAudit({
    action: "update",
    entity_type: "heat_index_reading",
    entity_id: reading_id,
    changes: {
      game_suspension_recommended,
      override_reason: reason,
      previous: existing?.game_suspension_recommended ?? null,
    },
    user_id: profile.id,
  });

  revalidatePath(HEAT_PATH);
  return ok();
}
