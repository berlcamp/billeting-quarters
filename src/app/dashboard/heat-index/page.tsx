import { PageHeader } from "@/components/layout/page-header";
import { Forbidden } from "@/components/shared/forbidden";
import { RecordReadingDialog } from "@/components/heat-index/record-reading-dialog";
import { ReadingsTable } from "@/components/heat-index/readings-table";
import { SiteStatusGrid } from "@/components/heat-index/site-status-grid";
import { getCurrentProfile } from "@/lib/auth/session";
import { hasAnyPermission, hasPermission } from "@/lib/permissions";
import { getReadings, getLatestPerSite } from "@/lib/actions/heat-index";
import { getSites } from "@/lib/actions/sites";

export default async function HeatIndexPage() {
  const profile = await getCurrentProfile();
  if (
    !profile ||
    !hasAnyPermission(profile, ["heat_index.record", "heat_index.override", "incident.view"])
  ) {
    return (
      <Forbidden message="Heat index requires recording or override permissions, or incident-view access." />
    );
  }

  const [readingsRes, latestRes, sitesRes] = await Promise.all([
    getReadings(undefined, 200),
    getLatestPerSite(),
    getSites(false),
  ]);

  const readings = readingsRes.error ? [] : (readingsRes.data ?? []);
  const latest = latestRes.error ? [] : (latestRes.data ?? []);
  const sites = sitesRes.error ? [] : (sitesRes.data ?? []);

  const canRecord = hasPermission(profile, "heat_index.record");
  // Only let users pick from active sites that make operational sense for HI.
  const recordableSites = sites.filter((s) =>
    s.site_type === "playing_venue" || s.site_type === "billeting_quarter",
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Heat Index"
        description="Environmental monitoring across playing venues. Game-suspension flags fire automatically on danger and extreme-danger readings."
        actions={canRecord ? <RecordReadingDialog sites={recordableSites} /> : undefined}
      />

      <section className="space-y-3">
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Latest by venue
        </h2>
        <SiteStatusGrid readings={latest} sites={sites} />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
          Recent readings
        </h2>
        <ReadingsTable initialReadings={readings} sites={sites} />
      </section>
    </div>
  );
}
