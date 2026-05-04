import { PageHeader } from "@/components/layout/page-header";
import { Forbidden } from "@/components/shared/forbidden";
import { IdRoster } from "@/components/personnel/id-roster";
import { getCurrentProfile } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions";
import { getPersonnelForIds } from "@/lib/actions/personnel";

export default async function IdGeneratorPage() {
  const profile = await getCurrentProfile();
  if (!profile || !hasPermission(profile, "personnel.manage")) {
    return (
      <Forbidden message="ID generator requires the personnel.manage permission." />
    );
  }

  const result = await getPersonnelForIds();
  const personnel = result.error ? [] : (result.data ?? []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="ID Generator"
        description="Personnel ID cards with QR codes for attendance scanning. Print or save as PDF from your browser."
      />
      {result.error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          Failed to load personnel: {result.error}
        </div>
      ) : (
        <IdRoster personnel={personnel} />
      )}
    </div>
  );
}
