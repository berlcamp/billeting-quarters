import { PageHeader } from "@/components/layout/page-header";

export default function VipPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="VIP Tracking"
        description="ETA-ATA / ETD-ATD tracking for protocol officers."
      />
      <div className="rounded-md border border-dashed p-12 text-center text-sm text-muted-foreground">
        Ships in Phase 2 (VIP tracking).
      </div>
    </div>
  );
}
