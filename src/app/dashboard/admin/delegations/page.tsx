import { Forbidden } from "@/components/shared/forbidden";
import { PageHeader } from "@/components/layout/page-header";
import { DelegationDialog } from "@/components/admin/delegations/delegation-dialog";
import { DelegationsTable } from "@/components/admin/delegations/delegations-table";
import { getDelegations } from "@/lib/actions/delegations";
import { getSites } from "@/lib/actions/sites";
import { requireRole } from "@/lib/auth/session";

export default async function AdminDelegationsPage() {
  const { allowed } = await requireRole(["super_admin", "command_center"]);
  if (!allowed) return <Forbidden />;

  const [delegationsResult, sitesResult] = await Promise.all([
    getDelegations(),
    getSites(),
  ]);

  const delegations = delegationsResult.error ? [] : (delegationsResult.data ?? []);
  const allSites = sitesResult.error ? [] : (sitesResult.data ?? []);
  const bqSites = allSites
    .filter((s) => s.site_type === "billeting_quarter")
    .map((s) => ({ id: s.id, name: s.name }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Delegations"
        description="The 17 Philippine regions competing in the Palaro."
        actions={<DelegationDialog bqSites={bqSites} />}
      />
      {delegationsResult.error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          Failed to load delegations: {delegationsResult.error}
        </div>
      ) : (
        <DelegationsTable delegations={delegations} bqSites={bqSites} />
      )}
    </div>
  );
}
