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
