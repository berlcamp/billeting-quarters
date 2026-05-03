import { Forbidden } from "@/components/shared/forbidden";
import { PageHeader } from "@/components/layout/page-header";
import { requireRole } from "@/lib/auth/session";

export default async function AdminSettingsPage() {
  const { allowed } = await requireRole(["super_admin"]);
  if (!allowed) return <Forbidden />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="System-level configuration. Super admin only."
      />
      <div className="rounded-md border border-dashed p-12 text-center text-sm text-muted-foreground">
        Settings configuration ships post-Phase 1.
      </div>
    </div>
  );
}
