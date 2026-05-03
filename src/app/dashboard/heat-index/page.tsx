import { PageHeader } from "@/components/layout/page-header";

export default function HeatIndexPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Heat Index"
        description="Environmental monitoring and game-suspension flags."
      />
      <div className="rounded-md border border-dashed p-12 text-center text-sm text-muted-foreground">
        Ships in Phase 2 (heat index monitoring).
      </div>
    </div>
  );
}
