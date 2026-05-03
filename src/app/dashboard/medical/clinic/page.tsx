import { PageHeader } from "@/components/layout/page-header";

export default function MedicalClinicPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Open Clinic"
        description="Clinic patient intake and visit logging."
      />
      <div className="rounded-md border border-dashed p-12 text-center text-sm text-muted-foreground">
        Ships in Phase 2 (clinic basics).
      </div>
    </div>
  );
}
