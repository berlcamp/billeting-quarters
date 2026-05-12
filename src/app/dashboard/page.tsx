import { Forbidden } from "@/components/shared/forbidden";
import { PageHeader } from "@/components/layout/page-header";
import { CommandCenterOverview } from "@/components/command-center/command-center-overview";
import { DashboardExtras } from "@/components/command-center/dashboard-extras";
import { FullscreenButton } from "@/components/command-center/fullscreen-button";
import { getCurrentProfile } from "@/lib/auth/session";
import { hasAnyPermission, hasPermission } from "@/lib/permissions";
import { getIncidents } from "@/lib/actions/incidents";
import { getAllReferrals } from "@/lib/actions/referrals";
import { getSites } from "@/lib/actions/sites";
import { getDashboardSnapshot } from "@/lib/actions/dashboard";
import { getVips } from "@/lib/actions/vip";

export default async function CommandCenterPage() {
  const profile = await getCurrentProfile();
  // The Command Center dashboard itself is open to every signed-in user.
  // Specific items (incidents, referrals) link out only when the viewer
  // holds the corresponding permission.
  if (!profile) {
    return <Forbidden message="Sign in to access the Command Center." />;
  }

  const canOpenIncidents = hasPermission(profile, "incident.view");
  const canOpenReferrals = hasAnyPermission(profile, [
    "referral.accept",
    "referral.assess",
    "referral.discharge",
    "referral.create_field_to_ucf",
    "referral.create_ucf_to_hospital",
  ]);

  const [
    incidentsResult,
    referralsResult,
    sitesResult,
    snapshotResult,
    vipsResult,
  ] = await Promise.all([
    getIncidents(),
    getAllReferrals(),
    getSites(true),
    getDashboardSnapshot(),
    getVips(true),
  ]);
  const incidents = incidentsResult.error ? [] : (incidentsResult.data ?? []);
  const referrals = referralsResult.error ? [] : (referralsResult.data ?? []);
  const sites = sitesResult.error ? [] : (sitesResult.data ?? []);
  const snapshot = snapshotResult.error ? null : snapshotResult.data ?? null;
  const vips = vipsResult.error ? [] : (vipsResult.data ?? []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Command Center"
        description="Live operational overview across all delegations, sites, and incidents."
        actions={<FullscreenButton />}
      />
      <CommandCenterOverview
        initialIncidents={incidents}
        initialReferrals={referrals}
        sites={sites}
        canOpenIncidents={canOpenIncidents}
        canOpenReferrals={canOpenReferrals}
      />
      {snapshot ? (
        <DashboardExtras
          snapshot={snapshot}
          sites={sites.map((s) => ({ id: s.id, name: s.name }))}
          vips={vips.map((v) => ({ id: v.id, full_name: v.full_name }))}
        />
      ) : null}
    </div>
  );
}
