import { PageHeader } from "@/components/layout/page-header";
import { Forbidden } from "@/components/shared/forbidden";
import { PersonnelDialog } from "@/components/personnel/personnel-dialog";
import { PersonnelTable } from "@/components/personnel/personnel-table";
import { getCurrentProfile } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions";
import { getPersonnel } from "@/lib/actions/personnel";
import { getSites } from "@/lib/actions/sites";

export default async function PersonnelListPage() {
  const profile = await getCurrentProfile();
  if (!profile || !hasPermission(profile, "personnel.manage")) {
    return (
      <Forbidden message="Personnel management requires the personnel.manage permission." />
    );
  }

  // Show inactive too — admins manage the full roster from this page.
  const [personnelRes, sitesRes] = await Promise.all([
    getPersonnel(true),
    getSites(false),
  ]);

  const personnel = personnelRes.error ? [] : (personnelRes.data ?? []);
  const sites = sitesRes.error ? [] : (sitesRes.data ?? []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Personnel"
        description="People issued ID cards for QR-scan attendance. Not auth users — they don't sign in."
        actions={<PersonnelDialog sites={sites} />}
      />
      {personnelRes.error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          Failed to load personnel: {personnelRes.error}
        </div>
      ) : (
        <PersonnelTable personnel={personnel} sites={sites} />
      )}
    </div>
  );
}
