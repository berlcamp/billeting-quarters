import { Fuel, Plus, Route as RouteIcon } from "lucide-react";
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
import { BusRouteReport } from "@/components/transportation/bus-route-report";
import { DispatchTable } from "@/components/transportation/dispatch-table";
import { FuelLogDialog } from "@/components/transportation/fuel-log-dialog";
import { FuelLogTable } from "@/components/transportation/fuel-log-table";
import { MissingAthleteCard } from "@/components/transportation/missing-athlete-card";
import { PassengerReport } from "@/components/transportation/passenger-report";
import { RouteFormDialog } from "@/components/transportation/route-form-dialog";
import { RouteTable } from "@/components/transportation/route-table";
import { ScanArrivalDialog } from "@/components/transportation/scan-arrival-dialog";
import { ScanDepartureDialog } from "@/components/transportation/scan-departure-dialog";
import { VehicleFormDialog } from "@/components/transportation/vehicle-form-dialog";
import { VehicleTable } from "@/components/transportation/vehicle-table";
import {
  getBusRouteReport,
  getDispatches,
  getFuelLogs,
  getMissingAthleteReport,
  getPassengerReport,
  getTransportSummary,
  getVehicleRoutes,
  getVehicles,
} from "@/lib/actions/vehicles";
import { createAdminClient } from "@/lib/supabase/admin";
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
    routesRes,
    sitesRes,
    delegationsRes,
    dispatchesRes,
    fuelRes,
    summaryRes,
    missingRes,
    busRouteRes,
    passengerRes,
  ] = await Promise.all([
    getVehicles(false),
    getVehicleRoutes(),
    getSites(false),
    getDelegations(false),
    getDispatches(200),
    getFuelLogs(200),
    getTransportSummary(),
    getMissingAthleteReport(50),
    getBusRouteReport({ limit: 100 }),
    getPassengerReport({ limit: 100 }),
  ]);

  const vehicles = vehiclesRes.error ? [] : (vehiclesRes.data ?? []);
  const routes = routesRes.error ? [] : (routesRes.data ?? []);
  const sites = sitesRes.error ? [] : (sitesRes.data ?? []);
  const delegations = delegationsRes.error ? [] : (delegationsRes.data ?? []);
  const dispatches = dispatchesRes.error ? [] : (dispatchesRes.data ?? []);
  const fuelLogs = fuelRes.error ? [] : (fuelRes.data ?? []);
  const summary = summaryRes.error ? null : summaryRes.data;
  const missingRows = missingRes.error ? [] : (missingRes.data ?? []);
  const busRouteRows = busRouteRes.error ? [] : (busRouteRes.data ?? []);
  const passengerRows = passengerRes.error ? [] : (passengerRes.data ?? []);

  // Pull trip legs + manifest for the active dispatches so the table can
  // render "current leg" and "manifest" columns without N+1 fetches.
  const dispatchIds = dispatches.map((d) => d.id);
  let tripLegs: Array<{
    id: string;
    dispatch_id: string;
    leg_order: number;
    from_site_id: string | null;
    from_label: string | null;
    to_site_id: string | null;
    to_label: string | null;
    departed_at: string;
    arrived_at: string | null;
  }> = [];
  let manifest: Array<{
    dispatch_id: string;
    total_passengers: number;
    dropped_off: number;
  }> = [];
  if (dispatchIds.length > 0) {
    const admin = createAdminClient();
    const [legsRes2, manifestRes2] = await Promise.all([
      admin
        .schema("palaro")
        .from("vehicle_trip_legs")
        .select(
          "id, dispatch_id, leg_order, from_site_id, from_label, to_site_id, to_label, departed_at, arrived_at",
        )
        .in("dispatch_id", dispatchIds),
      admin
        .schema("palaro")
        .from("vehicle_trip_manifest")
        .select("dispatch_id, total_passengers, dropped_off")
        .in("dispatch_id", dispatchIds),
    ]);
    tripLegs = legsRes2.data ?? [];
    manifest = manifestRes2.data ?? [];
  }

  const activeVehicleIds = new Set(
    dispatches
      .filter((d) => d.status === "scheduled" || d.status === "in_transit")
      .map((d) => d.vehicle_id),
  );

  const tripsToday = summary?.total_dispatches_today ?? 0;
  const paxToday = summary?.total_pax_today ?? 0;
  const fuelToday = summary?.total_fuel_liters_today ?? 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Transportation"
        description="Bus dispatching, terminal-to-terminal trips, and per-group passenger tracking."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {canDispatch ? (
              <ScanDepartureDialog sites={sites} delegations={delegations} />
            ) : null}
            {canDispatch ? (
              <ScanArrivalDialog sites={sites} delegations={delegations} />
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

      <Tabs defaultValue="trips">
        <TabsList>
          <TabsTrigger value="trips">Trips</TabsTrigger>
          <TabsTrigger value="vehicles">Vehicles</TabsTrigger>
          <TabsTrigger value="routes">Routes</TabsTrigger>
          <TabsTrigger value="fuel">Fuel</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>

        <TabsContent value="trips" className="mt-4">
          <DispatchTable
            dispatches={dispatches}
            legs={tripLegs}
            manifest={manifest}
            vehicles={vehicles}
            sites={sites}
          />
        </TabsContent>

        <TabsContent value="vehicles" className="mt-4">
          <VehicleTable
            vehicles={vehicles}
            activeVehicleIds={activeVehicleIds}
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
          <BusRouteReport
            initial={busRouteRows}
            vehicles={vehicles}
            sites={sites}
          />
          <PassengerReport
            initial={passengerRows}
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
