"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth/session";
import { fail, ok, type ActionResult } from "./types";
import type { Database } from "@/types/database";

type Incident = Database["palaro"]["Tables"]["incidents"]["Row"];
type IncidentCategory = Database["palaro"]["Enums"]["incident_category"];
type Movement = Database["palaro"]["Tables"]["vip_movements"]["Row"];
type HeatReading = Database["palaro"]["Tables"]["heat_index_readings"]["Row"];
type VenueSchedule = Database["palaro"]["Tables"]["venue_schedules"]["Row"];
type GarbageRow = Database["palaro"]["Tables"]["garbage_collections"]["Row"];
type FoodRequest = Database["palaro"]["Tables"]["food_requests"]["Row"];

export interface DashboardSnapshot {
  // Live counters surfaced beside the existing StatCards.
  clinicPatientsTotal: number;
  clinicPatientsToday: number;
  incidentsByCategory: Record<IncidentCategory, number>;
  // 10-20 most recent VIP movements (mixed active + closed).
  recentVipMovements: Movement[];
  // Latest per-site heat index reading; the front-end picks band / suspension.
  latestHeatReadings: HeatReading[];
  // Today's venue schedules (Manila local day).
  venueSchedulesToday: VenueSchedule[];
  // Today's garbage rows (Manila local day) — surfaces requests, no-need,
  // collected, not-collected counters.
  garbageToday: GarbageRow[];
  // Today's food requests.
  foodRequestsToday: FoodRequest[];
}

const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;

// Manila local day window [startUtcIso, endUtcIso] for "today".
function manilaTodayWindow(): { startIso: string; endIso: string } {
  const now = new Date();
  const ph = new Date(now.getTime() + MANILA_OFFSET_MS);
  const ymd = ph.toISOString().slice(0, 10);
  const [y, m, d] = ymd.split("-").map(Number);
  const startUtc = new Date(
    Date.UTC(y, m - 1, d) - MANILA_OFFSET_MS,
  ).toISOString();
  const endUtc = new Date(
    Date.UTC(y, m - 1, d) + 24 * 60 * 60 * 1000 - MANILA_OFFSET_MS,
  ).toISOString();
  return { startIso: startUtc, endIso: endUtc };
}

export async function getDashboardSnapshot(): Promise<
  ActionResult<DashboardSnapshot>
> {
  const profile = await getCurrentProfile();
  if (!profile) return fail("Not authenticated.");

  const admin = createAdminClient();
  const { startIso, endIso } = manilaTodayWindow();

  // Run all the count / list queries in parallel — service role bypasses RLS;
  // the underlying tables are aggregate counts only, no PII surfacing here.
  const [
    clinicTotal,
    clinicToday,
    allIncidents,
    movements,
    heat,
    venueToday,
    garbToday,
    foodToday,
  ] = await Promise.all([
    admin.schema("palaro").from("clinic_visits").select("id", {
      count: "exact",
      head: true,
    }),
    admin
      .schema("palaro")
      .from("clinic_visits")
      .select("id", { count: "exact", head: true })
      .gte("visit_date", startIso)
      .lt("visit_date", endIso),
    admin
      .schema("palaro")
      .from("incidents")
      .select("category, status")
      .neq("status", "closed")
      .limit(2000),
    admin
      .schema("palaro")
      .from("vip_movements")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(20),
    admin
      .schema("palaro")
      .from("heat_index_readings")
      .select("*")
      .order("recorded_at", { ascending: false })
      .limit(200),
    admin
      .schema("palaro")
      .from("venue_schedules")
      .select("*")
      .gte("scheduled_start", startIso)
      .lt("scheduled_start", endIso)
      .order("scheduled_start", { ascending: true })
      .limit(200),
    admin
      .schema("palaro")
      .from("garbage_collections")
      .select("*")
      .gte("scheduled_at", startIso)
      .lt("scheduled_at", endIso)
      .order("scheduled_at", { ascending: true })
      .limit(500),
    admin
      .schema("palaro")
      .from("food_requests")
      .select("*")
      .gte("required_at", startIso)
      .lt("required_at", endIso)
      .order("required_at", { ascending: true })
      .limit(500),
  ]);

  const incidentsByCategory: Record<IncidentCategory, number> = {
    medical: 0,
    utility: 0,
    vip_status: 0,
    security: 0,
    facility: 0,
    other: 0,
  };
  type IncidentLite = Pick<Incident, "category" | "status">;
  const rows = (allIncidents.data ?? []) as IncidentLite[];
  for (const r of rows) {
    if (!r.category) continue;
    incidentsByCategory[r.category as IncidentCategory] =
      (incidentsByCategory[r.category as IncidentCategory] ?? 0) + 1;
  }

  // Latest reading per site — clients render bands / suspensions from this.
  const seenSite = new Set<string>();
  const latestHeatReadings: HeatReading[] = [];
  for (const r of (heat.data ?? []) as HeatReading[]) {
    if (seenSite.has(r.site_id)) continue;
    seenSite.add(r.site_id);
    latestHeatReadings.push(r);
  }

  return ok({
    clinicPatientsTotal: clinicTotal.count ?? 0,
    clinicPatientsToday: clinicToday.count ?? 0,
    incidentsByCategory,
    recentVipMovements: (movements.data ?? []) as Movement[],
    latestHeatReadings,
    venueSchedulesToday: (venueToday.data ?? []) as VenueSchedule[],
    garbageToday: (garbToday.data ?? []) as GarbageRow[],
    foodRequestsToday: (foodToday.data ?? []) as FoodRequest[],
  });
}
