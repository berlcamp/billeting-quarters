import { ListPlus, Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Forbidden } from "@/components/shared/forbidden";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MovementDialog } from "@/components/supplies/movement-dialog";
import { MovementsList } from "@/components/supplies/movements-list";
import { SuppliesTable } from "@/components/supplies/supplies-table";
import { SupplyFormDialog } from "@/components/supplies/supply-form-dialog";
import { getMovements, getSupplies } from "@/lib/actions/supplies";
import { getSites } from "@/lib/actions/sites";
import { getCurrentProfile } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions";

export default async function MedicalSuppliesPage() {
  const profile = await getCurrentProfile();
  if (!profile || !hasPermission(profile, "supplies.manage")) {
    return (
      <Forbidden message="Supplies access requires the supplies.manage permission." />
    );
  }

  const [suppliesRes, movementsRes, sitesRes] = await Promise.all([
    getSupplies(false),
    getMovements(undefined, 100),
    getSites(false),
  ]);

  const supplies = suppliesRes.error ? [] : (suppliesRes.data ?? []);
  const movements = movementsRes.error ? [] : (movementsRes.data ?? []);
  const sites = sitesRes.error ? [] : (sitesRes.data ?? []);

  // Snapshot the request time once so derivations are stable for this render.
  const nowMs = new Date().getTime();
  const lowStock = supplies.filter(
    (s) => s.current_stock <= s.reorder_level,
  ).length;
  const expiringSoon = supplies.filter((s) => {
    if (!s.expiry_date) return false;
    const expiry = Date.parse(s.expiry_date);
    if (Number.isNaN(expiry)) return false;
    const days = (expiry - nowMs) / (1000 * 60 * 60 * 24);
    return days >= 0 && days <= 30;
  }).length;
  const expired = supplies.filter((s) => {
    if (!s.expiry_date) return false;
    const expiry = Date.parse(s.expiry_date);
    return !Number.isNaN(expiry) && expiry < nowMs;
  }).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Medical Supplies"
        description="Inventory, stock movements, and expiry tracking."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <MovementDialog
              supplies={supplies}
              trigger={
                <Button variant="outline">
                  <ListPlus className="size-4" />
                  Record movement
                </Button>
              }
            />
            <SupplyFormDialog
              sites={sites}
              trigger={
                <Button>
                  <Plus className="size-4" />
                  Add supply
                </Button>
              }
            />
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard label="Tracked items" value={supplies.length} />
        <StatCard label="Low stock" value={lowStock} accent={lowStock > 0} />
        <StatCard
          label="Expiring soon"
          value={expiringSoon}
          accent={expiringSoon > 0}
        />
        <StatCard
          label="Expired"
          value={expired}
          critical={expired > 0}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Inventory</CardTitle>
            <CardDescription>
              Stock levels and expiry windows. Low or expiring items are
              flagged.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <SuppliesTable supplies={supplies} sites={sites} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent movements</CardTitle>
            <CardDescription>
              Last 50 stock-in / stock-out / adjustment / expired events.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <MovementsList movements={movements} supplies={supplies} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
  critical,
}: {
  label: string;
  value: number;
  accent?: boolean;
  critical?: boolean;
}) {
  return (
    <div className="rounded-md border p-4">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div
        className={`mt-1 text-3xl font-bold tracking-tight ${
          critical
            ? "text-red-600"
            : accent
              ? "text-orange-600"
              : "text-foreground"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
