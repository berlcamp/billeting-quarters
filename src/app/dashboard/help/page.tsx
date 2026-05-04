import { PageHeader } from "@/components/layout/page-header";
import { HelpSearch } from "@/components/help/help-search";
import { getCurrentProfile } from "@/lib/auth/session";

export default async function HelpIndexPage() {
  const profile = await getCurrentProfile();
  return (
    <div className="space-y-6">
      <PageHeader
        title="User Guide"
        description="Module-by-module instructions for using Palaro Command. Search any keyword or browse by category."
      />
      <HelpSearch role={profile?.role ?? null} />
    </div>
  );
}
