import { Forbidden } from "@/components/shared/forbidden";
import { PageHeader } from "@/components/layout/page-header";
import { CommandCenterOverview } from "@/components/command-center/command-center-overview";
import { getCurrentProfile } from "@/lib/auth/session";
import { hasAnyPermission } from "@/lib/permissions";
import { getIncidents } from "@/lib/actions/incidents";
import { getSites } from "@/lib/actions/sites";
import { createAdminClient } from "@/lib/supabase/admin";

async function getAllReferrals() {
  // Direct query — no dedicated action yet for "all referrals". Gated by the
  // page-level role check above (which is at least incident.view).
  const admin = createAdminClient();
  const { data, error } = await admin
    .schema("palaro")
    .from("referrals")
    .select("*")
    .order("referred_at", { ascending: false })
    .limit(500);
  return error ? [] : (data ?? []);
}

export default async function CommandCenterPage() {
  const profile = await getCurrentProfile();
  // Open to anyone with broad operational visibility; super_admin is included
  // because it has all perms.
  if (
    !profile ||
    !hasAnyPermission(profile, ["incident.view", "admin.manage"])
  ) {
    return (
      <Forbidden message="Command center access requires operational permissions." />
    );
  }

  const [incidentsResult, referrals, sitesResult] = await Promise.all([
    getIncidents(),
    getAllReferrals(),
    getSites(true),
  ]);
  const incidents = incidentsResult.error ? [] : (incidentsResult.data ?? []);
  const sites = sitesResult.error ? [] : (sitesResult.data ?? []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Command Center"
        description="Live operational overview across all delegations, sites, and incidents."
      />
      <CommandCenterOverview
        initialIncidents={incidents}
        initialReferrals={referrals}
        sites={sites}
      />
    </div>
  );
}
