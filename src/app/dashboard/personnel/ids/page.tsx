import { PageHeader } from "@/components/layout/page-header";

export default function IdGeneratorPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="ID Generator"
        description="Personnel ID cards with QR codes for attendance scans."
      />
      <div className="rounded-md border border-dashed p-12 text-center text-sm text-muted-foreground">
        Ships in Phase 2 (ID generator).
      </div>
    </div>
  );
}
