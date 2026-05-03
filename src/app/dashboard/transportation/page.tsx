import { Plus, Route as RouteIcon } from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ManualLogDialog } from "@/components/transportation/manual-log-dialog";
import { RecentLogs } from "@/components/transportation/recent-logs";
import { RouteFormDialog } from "@/components/transportation/route-form-dialog";
import { RouteTable } from "@/components/transportation/route-table";
import { ScanVehicleDialog } from "@/components/transportation/scan-vehicle-dialog";
import { VehicleFormDialog } from "@/components/transportation/vehicle-form-dialog";
import { VehicleTable } from "@/components/transportation/vehicle-table";
import {
  getVehicleLogs,
  getVehicleRoutes,
  getVehicles,
} from "@/lib/actions/vehicles";
import { getSites } from "@/lib/actions/sites";
import { getDelegations } from "@/lib/actions/delegations";
import { getCurrentProfile } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions";

export default async function TransportationPage() {
  const profile = await getCurrentProfile();
  const canScan =
    !!profile &&
    (hasPermission(profile, "vehicle.scan") ||
      hasPermission(profile, "vehicle.manage"));
  const canManage = !!profile && hasPermission(profile, "vehicle.manage");

  if (!canScan && !canManage) {
    return (
      <Forbidden message="Transportation requires vehicle.scan or vehicle.manage permission." />
    );
  }

  const [vehiclesRes, logsRes, routesRes, sitesRes, delegationsRes] =
    await Promise.all([
      getVehicles(false),
      getVehicleLogs(200),
      getVehicleRoutes(),
      getSites(false),
      getDelegations(false),
    ]);

  const vehicles = vehiclesRes.error ? [] : (vehiclesRes.data ?? []);
  const logs = logsRes.error ? [] : (logsRes.data ?? []);
  const routes = routesRes.error ? [] : (routesRes.data ?? []);
  const sites = sitesRes.error ? [] : (sitesRes.data ?? []);
  const delegations = delegationsRes.error ? [] : (delegationsRes.data ?? []);

  const cutoff = new Date().getTime() - 24 * 60 * 60 * 1000;
  const todayCount = logs.filter((log) => {
    const logTime = Date.parse(log.scanned_at);
    return logTime > cutoff;
  }).length;

  const checkedIn = vehicles.filter((v) => {
    const last = logs.find((l) => l.vehicle_id === v.id);
    return last?.direction === "in";
  }).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Transportation"
        description="Vehicle dispatch, routes, and QR-based in/out logging."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {canScan ? <ScanVehicleDialog sites={sites} /> : null}
            {canScan ? (
              <ManualLogDialog vehicles={vehicles} sites={sites} />
            ) : null}
            {canManage ? (
              <VehicleFormDialog
                trigger={
                  <Button>
                    <Plus className="size-4" />
                    Add vehicle
                  </Button>
                }
              />
            ) : null}
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Active vehicles" value={vehicles.length} />
        <StatCard label="Currently checked in" value={checkedIn} />
        <StatCard label="Scans (last 24h)" value={todayCount} />
      </div>

      <Tabs defaultValue="vehicles">
        <TabsList>
          <TabsTrigger value="vehicles">Vehicles</TabsTrigger>
          <TabsTrigger value="logs">Recent activity</TabsTrigger>
          <TabsTrigger value="routes">Routes</TabsTrigger>
        </TabsList>

        <TabsContent value="vehicles" className="mt-4">
          <VehicleTable
            vehicles={vehicles}
            logs={logs}
            canManage={canManage}
          />
        </TabsContent>

        <TabsContent value="logs" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Recent vehicle scans
              </CardTitle>
              <CardDescription>
                Latest 30 check-ins and check-outs across all sites.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RecentLogs logs={logs} vehicles={vehicles} sites={sites} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="routes" className="mt-4 space-y-4">
          {canManage ? (
            <div className="flex justify-end">
              <RouteFormDialog
                vehicles={vehicles}
                sites={sites}
                delegations={delegations}
                trigger={
                  <Button variant="outline">
                    <RouteIcon className="size-4" />
                    Add route
                  </Button>
                }
              />
            </div>
          ) : null}
          <RouteTable
            routes={routes}
            vehicles={vehicles}
            sites={sites}
            delegations={delegations}
            canManage={canManage}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border p-4">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-3xl font-bold tracking-tight">{value}</div>
    </div>
  );
}
