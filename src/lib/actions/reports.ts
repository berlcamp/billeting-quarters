"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentProfile } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions";
import { manilaDayBoundsUtc } from "@/lib/timezone";
import { fail, ok, type ActionResult } from "./types";
import type { Database } from "@/types/database";

type IncidentCategory = Database["palaro"]["Enums"]["incident_category"];
type IncidentSeverity = Database["palaro"]["Enums"]["incident_severity"];
type IncidentStatus = Database["palaro"]["Enums"]["incident_status"];
type ReferralStatus = Database["palaro"]["Enums"]["referral_status"];
type ReferralLevel = Database["palaro"]["Enums"]["referral_level"];

export interface DailyIncidentSummary {
  date: string; // YYYY-MM-DD in Asia/Manila
  total_incidents: number;
  by_category: Record<IncidentCategory, number>;
  by_severity: Record<IncidentSeverity, number>;
  by_status: Record<IncidentStatus, number>;
  top_sites: Array<{ site_id: string; site_name: string; count: number }>;
  referrals: {
    total: number;
    by_level: Record<ReferralLevel, number>;
    by_status: Record<ReferralStatus, number>;
  };
}

const EMPTY_CATEGORY: Record<IncidentCategory, number> = {
  medical: 0,
  utility: 0,
  vip_status: 0,
  security: 0,
  facility: 0,
  other: 0,
};

const EMPTY_SEVERITY: Record<IncidentSeverity, number> = {
  low: 0,
  medium: 0,
  high: 0,
  critical: 0,
};

const EMPTY_STATUS: Record<IncidentStatus, number> = {
  open: 0,
  in_progress: 0,
  referred: 0,
  resolved: 0,
  closed: 0,
};

const EMPTY_REFERRAL_LEVEL: Record<ReferralLevel, number> = {
  field_to_ucf: 0,
  ucf_to_hospital: 0,
  hospital_admit: 0,
};

const EMPTY_REFERRAL_STATUS: Record<ReferralStatus, number> = {
  pending: 0,
  accepted: 0,
  in_treatment: 0,
  discharged: 0,
  admitted: 0,
  rejected: 0,
};

export async function getDailyIncidentSummary(
  date: string,
): Promise<ActionResult<DailyIncidentSummary>> {
  const profile = await getCurrentProfile();
  if (!profile) return fail("Not authenticated.");
  if (!hasPermission(profile, "reports.view")) {
    return fail("You don't have permission to view reports.");
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return fail("Invalid date — expected YYYY-MM-DD.");
  }

  const { startUtc, endUtc } = manilaDayBoundsUtc(date);
  const admin = createAdminClient();

  const [incidentsRes, referralsRes, sitesRes] = await Promise.all([
    admin
      .schema("palaro")
      .from("incidents")
      .select("id, category, severity, status, site_id, reported_at")
      .gte("reported_at", startUtc)
      .lt("reported_at", endUtc),
    admin
      .schema("palaro")
      .from("referrals")
      .select("id, level, status, referred_at")
      .gte("referred_at", startUtc)
      .lt("referred_at", endUtc),
    admin
      .schema("palaro")
      .from("sites")
      .select("id, name"),
  ]);

  if (incidentsRes.error) return fail(incidentsRes.error.message);
  if (referralsRes.error) return fail(referralsRes.error.message);
  if (sitesRes.error) return fail(sitesRes.error.message);

  const incidents = incidentsRes.data ?? [];
  const referrals = referralsRes.data ?? [];
  const siteNameById = new Map(
    (sitesRes.data ?? []).map((s) => [s.id, s.name]),
  );

  const by_category = { ...EMPTY_CATEGORY };
  const by_severity = { ...EMPTY_SEVERITY };
  const by_status = { ...EMPTY_STATUS };
  const siteCounts = new Map<string, number>();

  for (const inc of incidents) {
    by_category[inc.category] += 1;
    by_severity[inc.severity] += 1;
    by_status[inc.status] += 1;
    if (inc.site_id) {
      siteCounts.set(inc.site_id, (siteCounts.get(inc.site_id) ?? 0) + 1);
    }
  }

  const top_sites = Array.from(siteCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([site_id, count]) => ({
      site_id,
      site_name: siteNameById.get(site_id) ?? "Unknown site",
      count,
    }));

  const referralByLevel = { ...EMPTY_REFERRAL_LEVEL };
  const referralByStatus = { ...EMPTY_REFERRAL_STATUS };
  for (const ref of referrals) {
    referralByLevel[ref.level] += 1;
    referralByStatus[ref.status] += 1;
  }

  return ok({
    date,
    total_incidents: incidents.length,
    by_category,
    by_severity,
    by_status,
    top_sites,
    referrals: {
      total: referrals.length,
      by_level: referralByLevel,
      by_status: referralByStatus,
    },
  });
}

// =============================================================================
// MEDICAL CHAIN THROUGHPUT
// =============================================================================

// Time-buckets we report on. Median is the headline number — it's robust to
// the long tail of stalled discharges that medians smooth over.
export interface ChainStageMetrics {
  count: number;
  median_minutes: number | null;
  p90_minutes: number | null;
}

export interface MedicalChainReport {
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD inclusive
  totals: {
    referrals: number;
    field_to_ucf: number;
    ucf_to_hospital: number;
    discharged: number;
    admitted: number;
    rejected: number;
    in_flight: number;
  };
  // Time-to-accept = referred_at → received_at
  time_to_accept: ChainStageMetrics;
  // Time-to-discharge = received_at → discharged_at
  time_to_discharge: ChainStageMetrics;
  // Hospitalization rate = (UCF→Hospital + admitted) / total field referrals
  hospitalization_rate_pct: number;
  busiest_destinations: Array<{
    site_id: string;
    site_name: string;
    count: number;
  }>;
}

function quantile(sortedAsc: number[], q: number): number | null {
  if (sortedAsc.length === 0) return null;
  if (sortedAsc.length === 1) return sortedAsc[0];
  const pos = (sortedAsc.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sortedAsc[lo];
  return sortedAsc[lo] + (sortedAsc[hi] - sortedAsc[lo]) * (pos - lo);
}

function summarize(durationsMin: number[]): ChainStageMetrics {
  const sorted = [...durationsMin].sort((a, b) => a - b);
  return {
    count: sorted.length,
    median_minutes: quantile(sorted, 0.5),
    p90_minutes: quantile(sorted, 0.9),
  };
}

export async function getMedicalChainReport(
  fromDate: string,
  toDate: string,
): Promise<ActionResult<MedicalChainReport>> {
  const profile = await getCurrentProfile();
  if (!profile) return fail("Not authenticated.");
  if (!hasPermission(profile, "reports.view")) {
    return fail("You don't have permission to view reports.");
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(fromDate) || !/^\d{4}-\d{2}-\d{2}$/.test(toDate)) {
    return fail("Invalid dates — expected YYYY-MM-DD.");
  }
  if (fromDate > toDate) return fail("From-date must be on or before to-date.");

  const { startUtc } = manilaDayBoundsUtc(fromDate);
  const { endUtc } = manilaDayBoundsUtc(toDate);

  const admin = createAdminClient();
  const [refsRes, sitesRes] = await Promise.all([
    admin
      .schema("palaro")
      .from("referrals")
      .select(
        "id, level, status, referred_at, received_at, discharged_at, to_site_id",
      )
      .gte("referred_at", startUtc)
      .lt("referred_at", endUtc),
    admin.schema("palaro").from("sites").select("id, name"),
  ]);
  if (refsRes.error) return fail(refsRes.error.message);
  if (sitesRes.error) return fail(sitesRes.error.message);

  const referrals = refsRes.data ?? [];
  const siteName = new Map((sitesRes.data ?? []).map((s) => [s.id, s.name]));

  const totals = {
    referrals: referrals.length,
    field_to_ucf: 0,
    ucf_to_hospital: 0,
    discharged: 0,
    admitted: 0,
    rejected: 0,
    in_flight: 0,
  };
  const acceptDurations: number[] = [];
  const dischargeDurations: number[] = [];
  const destinationCounts = new Map<string, number>();

  for (const r of referrals) {
    if (r.level === "field_to_ucf") totals.field_to_ucf += 1;
    if (r.level === "ucf_to_hospital") totals.ucf_to_hospital += 1;
    if (r.status === "discharged") totals.discharged += 1;
    else if (r.status === "admitted") totals.admitted += 1;
    else if (r.status === "rejected") totals.rejected += 1;
    else totals.in_flight += 1;

    if (r.received_at) {
      const dt = (Date.parse(r.received_at) - Date.parse(r.referred_at)) / 60000;
      if (dt >= 0) acceptDurations.push(dt);
    }
    if (r.discharged_at && r.received_at) {
      const dt =
        (Date.parse(r.discharged_at) - Date.parse(r.received_at)) / 60000;
      if (dt >= 0) dischargeDurations.push(dt);
    }
    if (r.to_site_id) {
      destinationCounts.set(
        r.to_site_id,
        (destinationCounts.get(r.to_site_id) ?? 0) + 1,
      );
    }
  }

  const fieldRefs = totals.field_to_ucf;
  const hospitalized = totals.ucf_to_hospital + totals.admitted;
  const hospitalization_rate_pct =
    fieldRefs > 0 ? Math.round((hospitalized / fieldRefs) * 100) : 0;

  const busiest_destinations = Array.from(destinationCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([site_id, count]) => ({
      site_id,
      site_name: siteName.get(site_id) ?? "Unknown site",
      count,
    }));

  return ok({
    from: fromDate,
    to: toDate,
    totals,
    time_to_accept: summarize(acceptDurations),
    time_to_discharge: summarize(dischargeDurations),
    hospitalization_rate_pct,
    busiest_destinations,
  });
}

// =============================================================================
// OPERATIONS SNAPSHOT (multi-day trend)
// =============================================================================

export interface OperationsSnapshot {
  from: string;
  to: string;
  days: Array<{
    date: string; // YYYY-MM-DD in PHT
    incidents: number;
    critical: number;
    referrals: number;
    visits: number;
  }>;
  totals: {
    incidents: number;
    critical: number;
    referrals: number;
    visits: number;
  };
}

function manilaYmdFromUtc(iso: string): string {
  // Asia/Manila is UTC+8, no DST.
  const t = new Date(Date.parse(iso) + 8 * 60 * 60 * 1000);
  return t.toISOString().slice(0, 10);
}

function listDates(fromDate: string, toDate: string): string[] {
  const out: string[] = [];
  const [fy, fm, fd] = fromDate.split("-").map(Number);
  const [ty, tm, td] = toDate.split("-").map(Number);
  const cursor = new Date(Date.UTC(fy, fm - 1, fd));
  const end = new Date(Date.UTC(ty, tm - 1, td));
  while (cursor <= end) {
    out.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}

export async function getOperationsSnapshot(
  fromDate: string,
  toDate: string,
): Promise<ActionResult<OperationsSnapshot>> {
  const profile = await getCurrentProfile();
  if (!profile) return fail("Not authenticated.");
  if (!hasPermission(profile, "reports.view")) {
    return fail("You don't have permission to view reports.");
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(fromDate) || !/^\d{4}-\d{2}-\d{2}$/.test(toDate)) {
    return fail("Invalid dates — expected YYYY-MM-DD.");
  }
  if (fromDate > toDate) return fail("From-date must be on or before to-date.");

  const { startUtc } = manilaDayBoundsUtc(fromDate);
  const { endUtc } = manilaDayBoundsUtc(toDate);

  const admin = createAdminClient();
  const [incRes, refRes, visRes] = await Promise.all([
    admin
      .schema("palaro")
      .from("incidents")
      .select("id, severity, reported_at")
      .gte("reported_at", startUtc)
      .lt("reported_at", endUtc),
    admin
      .schema("palaro")
      .from("referrals")
      .select("id, referred_at")
      .gte("referred_at", startUtc)
      .lt("referred_at", endUtc),
    admin
      .schema("palaro")
      .from("clinic_visits")
      .select("id, visit_date")
      .gte("visit_date", startUtc)
      .lt("visit_date", endUtc),
  ]);
  if (incRes.error) return fail(incRes.error.message);
  if (refRes.error) return fail(refRes.error.message);
  if (visRes.error) return fail(visRes.error.message);

  const dates = listDates(fromDate, toDate);
  const dayMap = new Map<
    string,
    { incidents: number; critical: number; referrals: number; visits: number }
  >();
  for (const d of dates) {
    dayMap.set(d, { incidents: 0, critical: 0, referrals: 0, visits: 0 });
  }
  for (const inc of incRes.data ?? []) {
    const d = manilaYmdFromUtc(inc.reported_at);
    const bucket = dayMap.get(d);
    if (!bucket) continue;
    bucket.incidents += 1;
    if (inc.severity === "critical") bucket.critical += 1;
  }
  for (const ref of refRes.data ?? []) {
    const d = manilaYmdFromUtc(ref.referred_at);
    const bucket = dayMap.get(d);
    if (!bucket) continue;
    bucket.referrals += 1;
  }
  for (const v of visRes.data ?? []) {
    const d = manilaYmdFromUtc(v.visit_date);
    const bucket = dayMap.get(d);
    if (!bucket) continue;
    bucket.visits += 1;
  }

  const days = dates.map((d) => ({ date: d, ...dayMap.get(d)! }));
  const totals = days.reduce(
    (acc, d) => ({
      incidents: acc.incidents + d.incidents,
      critical: acc.critical + d.critical,
      referrals: acc.referrals + d.referrals,
      visits: acc.visits + d.visits,
    }),
    { incidents: 0, critical: 0, referrals: 0, visits: 0 },
  );

  return ok({ from: fromDate, to: toDate, days, totals });
}
