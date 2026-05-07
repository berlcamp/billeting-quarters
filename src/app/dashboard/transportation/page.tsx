import { Fuel, Plus, Route as RouteIcon, Send } from "lucide-react";
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
import { DispatchFormDialog } from "@/components/transportation/dispatch-form-dialog";
import { DispatchTable } from "@/components/transportation/dispatch-table";
import { FuelLogDialog } from "@/components/transportation/fuel-log-dialog";
import { FuelLogTable } from "@/components/transportation/fuel-log-table";
import { ManualLogDialog } from "@/components/transportation/manual-log-dialog";
import { MissingAthleteCard } from "@/components/transportation/missing-athlete-card";
import { RecentLogs } from "@/components/transportation/recent-logs";
import { RouteFormDialog } from "@/components/transportation/route-form-dialog";
import { RouteTable } from "@/components/transportation/route-table";
import { ScanVehicleDialog } from "@/components/transportation/scan-vehicle-dialog";
import { VehicleFormDialog } from "@/components/transportation/vehicle-form-dialog";
import { VehicleTable } from "@/components/transportation/vehicle-table";
import {
  getDispatches,
  getFuelLogs,
  getMissingAthleteReport,
  getTransportSummary,
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
  const canDispatch =
    !!profile &&
    (hasPermission(profile, "vehicle.dispatch") ||
      hasPermission(profile, "vehicle.manage"));
  const canFuel =
    !!profile &&
    (hasPermission(profile, "vehicle.fuel") ||
      hasPermission(profile, "vehicle.manage"));
  const canDrive = !!profile && hasPermission(profile, "vehicle.drive");

  if (!canScan && !canManage && !canDispatch && !canFuel && !canDrive) {
    return (
      <Forbidden message="Transportation requires a Transportation role or vehicle.* permission." />
    );
  }

  const [
    vehiclesRes,
    logsRes,
    routesRes,
    sitesRes,
    delegationsRes,
    dispatchesRes,
    fuelRes,
    summaryRes,
    missingRes,
  ] = await Promise.all([
    getVehicles(false),
    getVehicleLogs(200),
    getVehicleRoutes(),
    getSites(false),
    getDelegations(false),
    getDispatches(200),
    getFuelLogs(200),
    getTransportSummary(),
    getMissingAthleteReport(50),
  ]);

  const vehicles = vehiclesRes.error ? [] : (vehiclesRes.data ?? []);
  const logs = logsRes.error ? [] : (logsRes.data ?? []);
  const routes = routesRes.error ? [] : (routesRes.data ?? []);
  const sites = sitesRes.error ? [] : (sitesRes.data ?? []);
  const delegations = delegationsRes.error ? [] : (delegationsRes.data ?? []);
  const dispatches = dispatchesRes.error ? [] : (dispatchesRes.data ?? []);
  const fuelLogs = fuelRes.error ? [] : (fuelRes.data ?? []);
  const summary = summaryRes.error ? null : summaryRes.data;
  const missingRows = missingRes.error ? [] : (missingRes.data ?? []);

  const tripsToday = summary?.total_dispatches_today ?? 0;
  const paxToday = summary?.total_pax_today ?? 0;
  const fuelToday = summary?.total_fuel_liters_today ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Transportation"
        description="Vehicles, multi-stop routes, dispatches, and per-venue arrival/departure scans."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {canDispatch ? (
              <DispatchFormDialog
                vehicles={vehicles}
                sites={sites}
                delegations={delegations}
                routes={routes}
                trigger={
                  <Button>
                    <Send className="size-4" />
                    Dispatch
                  </Button>
                }
              />
            ) : null}
            {canScan ? <ScanVehicleDialog sites={sites} /> : null}
            {canScan ? (
              <ManualLogDialog
                vehicles={vehicles}
                sites={sites}
                delegations={delegations}
                dispatches={dispatches}
              />
            ) : null}
            {canManage ? (
              <VehicleFormDialog
                trigger={
                  <Button variant="outline">
                    <Plus className="size-4" />
                    Add vehicle
                  </Button>
                }
              />
            ) : null}
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard label="Active vehicles" value={vehicles.length} />
        <StatCard label="Trips today" value={tripsToday} />
        <StatCard label="Pax served today" value={paxToday} />
        <StatCard label="Fuel today (L)" value={fuelToday} />
      </div>

      <Tabs defaultValue="dispatches">
        <TabsList>
          <TabsTrigger value="dispatches">Dispatches</TabsTrigger>
          <TabsTrigger value="vehicles">Vehicles</TabsTrigger>
          <TabsTrigger value="routes">Routes</TabsTrigger>
          <TabsTrigger value="logs">Activity</TabsTrigger>
          <TabsTrigger value="fuel">Fuel</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="dispatches" className="mt-4">
          <DispatchTable
            dispatches={dispatches}
            vehicles={vehicles}
            sites={sites}
            delegations={delegations}
            canManage={canDispatch}
          />
        </TabsContent>

        <TabsContent value="vehicles" className="mt-4">
          <VehicleTable
            vehicles={vehicles}
            logs={logs}
            canManage={canManage}
          />
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

        <TabsContent value="logs" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent vehicle scans</CardTitle>
              <CardDescription>
                Latest 30 arrivals and departures across all sites.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RecentLogs
                logs={logs}
                vehicles={vehicles}
                sites={sites}
                delegations={delegations}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fuel" className="mt-4 space-y-4">
          {canFuel ? (
            <div className="flex justify-end">
              <FuelLogDialog
                vehicles={vehicles}
                trigger={
                  <Button>
                    <Fuel className="size-4" />
                    Log refill
                  </Button>
                }
              />
            </div>
          ) : null}
          <FuelLogTable
            logs={fuelLogs}
            vehicles={vehicles}
            canManage={canFuel}
          />
        </TabsContent>

        <TabsContent value="reports" className="mt-4 space-y-4">
          <MissingAthleteCard
            rows={missingRows}
            vehicles={vehicles}
            sites={sites}
            delegations={delegations}
          />
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Per-vehicle today</CardTitle>
              <CardDescription>
                Trips dispatched and fuel logged per vehicle for the current
                day.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {summary && summary.per_vehicle.length > 0 ? (
                <table className="w-full text-sm">
                  <thead className="text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2">Vehicle</th>
                      <th className="px-3 py-2 text-right">Trips</th>
                      <th className="px-3 py-2 text-right">Fuel (L)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {summary.per_vehicle.map((v) => (
                      <tr key={v.vehicle_id}>
                        <td className="px-3 py-2 font-mono">
                          {v.vehicle_code}
                        </td>
                        <td className="px-3 py-2 text-right font-mono">
                          {v.trip_count}
                        </td>
                        <td className="px-3 py-2 text-right font-mono">
                          {v.fuel_liters.toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No activity recorded today.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-md border p-4">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-3xl font-bold tracking-tight">{value}</div>
    </div>
  );
}
