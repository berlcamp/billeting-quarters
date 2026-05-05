import Link from "next/link";
import { Plus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/page-header";
import { Forbidden } from "@/components/shared/forbidden";
import { IncidentsTable } from "@/components/incidents/incidents-table";
import { getIncidents } from "@/lib/actions/incidents";
import { getLatestReferralByIncident } from "@/lib/actions/referrals";
import { getSites } from "@/lib/actions/sites";
import { getDelegations } from "@/lib/actions/delegations";
import { getCurrentProfile } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions";

export default async function IncidentsPage() {
  const profile = await getCurrentProfile();
  if (!profile || !hasPermission(profile, "incident.view")) {
    return <Forbidden message="You don't have permission to view incidents." />;
  }
  const canCreate = hasPermission(profile, "incident.create");

  const [incidentsResult, sitesResult, delegationsResult] = await Promise.all([
    getIncidents(),
    getSites(true),
    getDelegations(true),
  ]);
  const incidents = incidentsResult.error ? [] : (incidentsResult.data ?? []);
  const sites = sitesResult.error ? [] : (sitesResult.data ?? []);
  const delegations = delegationsResult.error
    ? []
    : (delegationsResult.data ?? []);

  const siteLookup = new Map(sites.map((s) => [s.id, s.name]));
  const delegationLookup = new Map(
    delegations.map((d) => [d.id, { code: d.region_code, name: d.region_name }]),
  );

  const referredIncidentIds = incidents
    .filter((i) => i.status === "referred")
    .map((i) => i.id);
  const referralLookupResult =
    referredIncidentIds.length > 0
      ? await getLatestReferralByIncident(referredIncidentIds)
      : null;
  const referralLookup =
    referralLookupResult && !referralLookupResult.error
      ? (referralLookupResult.data ?? new Map())
      : new Map();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Incidents"
        description="All operational incidents across BQs and Playing Venues."
        actions={
          canCreate ? (
            <Link href="/dashboard/incidents/new" className={buttonVariants()}>
              <Plus className="size-4" />
              New incident
            </Link>
          ) : null
        }
      />
      {incidentsResult.error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          Failed to load incidents: {incidentsResult.error}
        </div>
      ) : (
        <IncidentsTable
          incidents={incidents}
          siteLookup={siteLookup}
          delegationLookup={delegationLookup}
          referralLookup={referralLookup}
        />
      )}
    </div>
  );
}
