import { PageHeader } from "@/components/layout/page-header";

export default function TransportationPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Transportation"
        description="Vehicle dispatch, routes, and QR-based in/out logging."
      />
      <div className="rounded-md border border-dashed p-12 text-center text-sm text-muted-foreground">
        Ships in Phase 3 (transportation).
      </div>
    </div>
  );
}
