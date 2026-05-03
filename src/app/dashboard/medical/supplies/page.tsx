import { PageHeader } from "@/components/layout/page-header";

export default function MedicalSuppliesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="Medical Supplies"
        description="Inventory, stock movements, and expiry tracking."
      />
      <div className="rounded-md border border-dashed p-12 text-center text-sm text-muted-foreground">
        Ships in Phase 3 (supplies inventory).
      </div>
    </div>
  );
}
