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
import { getDelegations } from "@/lib/actions/delegations";
import { getVips } from "@/lib/actions/vip";

export default async function CommandCenterPage() {
  const profile = await getCurrentProfile();
  // The Command Center dashboard itself is open to every signed-in user.
  // Specific items (incidents, referrals) link out only when the viewer
  // holds the corresponding permission.
  if (!profile) {
    return <Forbidden message="Sign in to access the Command Center." />;
  }

  // Each dashboard card / map popup that points at a module gets a
  // permission flag here. Components render those targets as plain (non-link)
  // markup when the flag is false — that makes the `command_center_viewer`
  // role's empty permission set produce a fully view-only dashboard with no
  // clickable navigation, while ordinary roles see links to anything they
  // can actually open.
  const canOpenIncidents = hasPermission(profile, "incident.view");
  const canOpenReferrals = hasAnyPermission(profile, [
    "referral.accept",
    "referral.assess",
    "referral.discharge",
    "referral.create_field_to_ucf",
    "referral.create_ucf_to_hospital",
  ]);
  const linkPerms = {
    incidents: canOpenIncidents,
    vip: hasPermission(profile, "vip.manage"),
    venues: hasAnyPermission(profile, ["venue.book", "venue.approve_special"]),
    garbage: hasAnyPermission(profile, ["garbage.log", "garbage.manage"]),
    food: hasAnyPermission(profile, ["food.request", "food.manage"]),
    siteMonitoring: hasAnyPermission(profile, [
      "site_monitoring.log",
      "site_monitoring.manage",
    ]),
    transportation: hasAnyPermission(profile, [
      "vehicle.manage",
      "vehicle.scan",
      "vehicle.dispatch",
      "vehicle.fuel",
      "vehicle.drive",
    ]),
  };

  const [
    incidentsResult,
    referralsResult,
    sitesResult,
    snapshotResult,
    vipsResult,
    delegationsResult,
  ] = await Promise.all([
    getIncidents(),
    getAllReferrals(),
    getSites(true),
    getDashboardSnapshot(),
    getVips(true),
    getDelegations(true),
  ]);
  const incidents = incidentsResult.error ? [] : (incidentsResult.data ?? []);
  const referrals = referralsResult.error ? [] : (referralsResult.data ?? []);
  const sites = sitesResult.error ? [] : (sitesResult.data ?? []);
  const snapshot = snapshotResult.error ? null : snapshotResult.data ?? null;
  const vips = vipsResult.error ? [] : (vipsResult.data ?? []);
  const delegations = delegationsResult.error
    ? []
    : (delegationsResult.data ?? []);

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
          delegations={delegations.map((d) => ({
            id: d.id,
            region_code: d.region_code,
            region_name: d.region_name,
            short_name: d.short_name,
          }))}
          linkPerms={linkPerms}
        />
      ) : null}
    </div>
  );
}
