import { Forbidden } from "@/components/shared/forbidden";
import { PageHeader } from "@/components/layout/page-header";
import { IncidentForm } from "@/components/incidents/incident-form";
import { getCurrentProfile } from "@/lib/auth/session";
import { getSites } from "@/lib/actions/sites";
import { getDelegations } from "@/lib/actions/delegations";
import { hasPermission } from "@/lib/permissions";

export default async function NewIncidentPage() {
  const profile = await getCurrentProfile();
  if (!profile || !hasPermission(profile, "incident.create")) {
    return <Forbidden message="You don't have permission to report incidents." />;
  }

  const [sitesResult, delegationsResult] = await Promise.all([
    getSites(),
    getDelegations(),
  ]);
  const sites = sitesResult.error
    ? []
    : (sitesResult.data ?? []).map((s) => ({
        id: s.id,
        name: s.name,
        site_type: s.site_type,
      }));
  const delegations = delegationsResult.error
    ? []
    : (delegationsResult.data ?? []).map((d) => ({
        id: d.id,
        region_code: d.region_code,
        region_name: d.region_name,
      }));

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader
        title="New incident"
        description="Report any operational event — medical, utility, security, or otherwise."
      />
      <IncidentForm sites={sites} delegations={delegations} />
    </div>
  );
}
