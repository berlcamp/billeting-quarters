import { Forbidden } from "@/components/shared/forbidden";
import { PageHeader } from "@/components/layout/page-header";
import { SiteDialog } from "@/components/admin/sites/site-dialog";
import { SitesTable } from "@/components/admin/sites/sites-table";
import { getSites } from "@/lib/actions/sites";
import { requireRole } from "@/lib/auth/session";

export default async function AdminSitesPage() {
  const { allowed } = await requireRole(["super_admin", "command_center"]);
  if (!allowed) return <Forbidden />;

  const result = await getSites();
  const sites = result.error ? [] : (result.data ?? []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sites"
        description="Billeting Quarters, Playing Venues, UCFs, hospitals, clinics, and the command center."
        actions={<SiteDialog />}
      />
      {result.error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          Failed to load sites: {result.error}
        </div>
      ) : (
        <SitesTable sites={sites} />
      )}
    </div>
  );
}
