import { PageHeader } from "@/components/layout/page-header";

export default function AttendancePage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Attendance"
        description="Time-in / time-out logging across all sites."
      />
      <div className="rounded-md border border-dashed p-12 text-center text-sm text-muted-foreground">
        Ships in Phase 2 (attendance).
      </div>
    </div>
  );
}
