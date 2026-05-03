import { PageHeader } from "@/components/layout/page-header";

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Daily incident summaries and operational analytics."
      />
      <div className="rounded-md border border-dashed p-12 text-center text-sm text-muted-foreground">
        Ships in Task 4.4.
      </div>
    </div>
  );
}
