"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { deleteRoute } from "@/lib/actions/vehicles";
import type { VehicleRouteWithStops } from "@/lib/actions/vehicles";
import { formatManila } from "@/lib/timezone";
import type { Database } from "@/types/database";

type Vehicle = Pick<
  Database["palaro"]["Tables"]["vehicles"]["Row"],
  "id" | "vehicle_code"
>;
type Site = Pick<
  Database["palaro"]["Tables"]["sites"]["Row"],
  "id" | "name"
>;
type Delegation = Pick<
  Database["palaro"]["Tables"]["delegations"]["Row"],
  "id" | "region_code"
>;

interface Props {
  routes: VehicleRouteWithStops[];
  vehicles: Vehicle[];
  sites: Site[];
  delegations: Delegation[];
  canManage: boolean;
}

export function RouteTable({
  routes,
  vehicles,
  sites,
  delegations,
  canManage,
}: Props) {
  const router = useRouter();
  const vehicleMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const v of vehicles) m.set(v.id, v.vehicle_code);
    return m;
  }, [vehicles]);
  const siteMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of sites) m.set(s.id, s.name);
    return m;
  }, [sites]);
  const delMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const d of delegations) m.set(d.id, d.region_code);
    return m;
  }, [delegations]);

  async function handleDelete(id: string, name: string) {
    if (!window.confirm(`Delete route "${name}"?`)) return;
    const result = await deleteRoute({ id });
    if (result.error) {
      toast.error("Delete failed", { description: result.error });
      return;
    }
    toast.success("Route deleted");
    router.refresh();
  }

  const baseColumns: DataTableColumn<VehicleRouteWithStops>[] = [
    {
      id: "name",
      header: "Route",
      cell: (r) => (
        <div className="flex flex-col">
          <span className="font-medium">{r.route_name}</span>
          {r.vehicle_id ? (
            <span className="font-mono text-xs text-muted-foreground">
              {vehicleMap.get(r.vehicle_id) ?? "—"}
            </span>
          ) : null}
        </div>
      ),
    },
    {
      id: "stops",
      header: "Stops",
      cell: (r) => {
        if (r.stops.length === 0) {
          return <span className="text-muted-foreground">—</span>;
        }
        return (
          <div className="flex flex-wrap items-center gap-1 text-sm">
            {r.stops.map((s, idx) => (
              <span key={s.id} className="flex items-center gap-1">
                <span>
                  {s.site_id
                    ? siteMap.get(s.site_id) ?? s.label ?? "—"
                    : s.label ?? "—"}
                </span>
                {idx < r.stops.length - 1 ? (
                  <ChevronRight className="size-3 text-muted-foreground" />
                ) : null}
              </span>
            ))}
          </div>
        );
      },
    },
    {
      id: "time",
      header: "Scheduled",
      cell: (r) =>
        r.scheduled_time ? (
          <span className="font-mono text-xs">
            {formatManila(r.scheduled_time, "MMM d · HH:mm")}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      id: "delegation",
      header: "Delegation",
      cell: (r) =>
        r.delegation_id ? (
          (delMap.get(r.delegation_id) ?? "—")
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
  ];

  const columns: DataTableColumn<VehicleRouteWithStops>[] = canManage
    ? [
        ...baseColumns,
        {
          id: "actions",
          header: "",
          className: "w-12",
          cell: (r) => (
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Delete route"
              onClick={() => handleDelete(r.id, r.route_name)}
            >
              <Trash2 className="size-3.5" />
            </Button>
          ),
        },
      ]
    : baseColumns;

  return (
    <DataTable
      data={routes}
      columns={columns}
      rowKey={(r) => r.id}
      pageSize={10}
      empty={{
        title: "No routes defined",
        description: canManage
          ? "Add a route to publish recurring shuttle schedules."
          : "No published routes yet.",
      }}
    />
  );
}
