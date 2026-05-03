import { PageHeader } from "@/components/layout/page-header";

export default function DutySchedulePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Duty Schedule"
        description="Personnel assignments and shift rosters."
      />
      <div className="rounded-md border border-dashed p-12 text-center text-sm text-muted-foreground">
        Ships in Phase 2 (personnel + duty schedules).
      </div>
    </div>
  );
}
