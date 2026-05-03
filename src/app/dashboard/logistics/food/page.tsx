import { Plus, UtensilsCrossed } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Forbidden } from "@/components/shared/forbidden";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RequestFormDialog } from "@/components/food/request-form-dialog";
import { RequestsTable } from "@/components/food/requests-table";
import { SupplierFormDialog } from "@/components/food/supplier-form-dialog";
import { SuppliersTable } from "@/components/food/suppliers-table";
import { getRequests, getSuppliers } from "@/lib/actions/food";
import { getSites } from "@/lib/actions/sites";
import { getCurrentProfile } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions";

export default async function FoodSupplyPage() {
  const profile = await getCurrentProfile();
  const canRequest =
    !!profile &&
    (hasPermission(profile, "food.request") ||
      hasPermission(profile, "food.manage"));
  const canManage = !!profile && hasPermission(profile, "food.manage");

  if (!canRequest) {
    return (
      <Forbidden message="Food supply requires food.request or food.manage permission." />
    );
  }

  const [suppliersRes, requestsRes, sitesRes] = await Promise.all([
    getSuppliers(false),
    getRequests(),
    getSites(false),
  ]);
  const suppliers = suppliersRes.error ? [] : (suppliersRes.data ?? []);
  const requests = requestsRes.error ? [] : (requestsRes.data ?? []);
  const sites = sitesRes.error ? [] : (sitesRes.data ?? []);
  const bqs = sites.filter((s) => s.site_type === "billeting_quarter");

  const pending = requests.filter((r) => r.status === "pending").length;
  const confirmed = requests.filter((r) => r.status === "confirmed").length;
  const mealsToday = requests
    .filter((r) => {
      const required = Date.parse(r.required_at);
      const nowMs = new Date().getTime();
      return required > nowMs && required - nowMs < 24 * 60 * 60 * 1000;
    })
    .reduce((acc, r) => acc + r.quantity_meals, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Food Supply"
        description="Caterer roster and BQ meal requests."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <RequestFormDialog
              bqs={bqs}
              suppliers={suppliers}
              trigger={
                <Button variant="outline">
                  <UtensilsCrossed className="size-4" />
                  Request meals
                </Button>
              }
            />
            {canManage ? (
              <SupplierFormDialog
                trigger={
                  <Button>
                    <Plus className="size-4" />
                    Add supplier
                  </Button>
                }
              />
            ) : null}
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Pending requests" value={pending} accent={pending > 0} />
        <StatCard label="Confirmed" value={confirmed} />
        <StatCard label="Meals due (24h)" value={mealsToday} />
      </div>

      <Tabs defaultValue="requests">
        <TabsList>
          <TabsTrigger value="requests">Meal requests</TabsTrigger>
          <TabsTrigger value="suppliers">Suppliers</TabsTrigger>
        </TabsList>

        <TabsContent value="requests" className="mt-4">
          <RequestsTable
            requests={requests}
            suppliers={suppliers}
            bqs={bqs}
            canManage={canManage}
          />
        </TabsContent>

        <TabsContent value="suppliers" className="mt-4">
          <SuppliersTable suppliers={suppliers} canManage={canManage} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div className="rounded-md border p-4">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div
        className={`mt-1 text-3xl font-bold tracking-tight ${
          accent ? "text-yellow-600" : "text-foreground"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
