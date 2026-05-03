import { PageHeader } from "@/components/layout/page-header";
import { LiveIncidentStats } from "@/components/command-center/live-incident-stats";
import { getIncidents } from "@/lib/actions/incidents";

export default async function CommandCenterPage() {
  const result = await getIncidents();
  const incidents = result.error ? [] : (result.data ?? []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Command Center"
        description="Live operational overview across all delegations, sites, and incidents."
      />
      <LiveIncidentStats initial={incidents} />
      <div className="rounded-md border border-dashed p-12 text-center text-sm text-muted-foreground">
        Pipeline view, live incident feed, and the sites map ship in Task 4.1.
      </div>
    </div>
  );
}
