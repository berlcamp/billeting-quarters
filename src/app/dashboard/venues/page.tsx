import { PageHeader } from "@/components/layout/page-header";

export default function VenuesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Venues"
        description="Practice slot booking and special venue requests."
      />
      <div className="rounded-md border border-dashed p-12 text-center text-sm text-muted-foreground">
        Ships in Phase 3 (venue scheduling).
      </div>
    </div>
  );
}
