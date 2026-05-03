"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { deleteRoute } from "@/lib/actions/vehicles";
import { formatManila } from "@/lib/timezone";
import type { Database } from "@/types/database";

type Route = Database["palaro"]["Tables"]["vehicle_routes"]["Row"];
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
  routes: Route[];
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

  const baseColumns: DataTableColumn<Route>[] = [
    {
      id: "name",
      header: "Route",
      cell: (r) => <span className="font-medium">{r.route_name}</span>,
    },
    {
      id: "vehicle",
      header: "Vehicle",
      cell: (r) => (
        <span className="font-mono text-sm">
          {vehicleMap.get(r.vehicle_id) ?? "—"}
        </span>
      ),
    },
    {
      id: "from",
      header: "From",
      cell: (r) =>
        r.origin_site_id ? (
          (siteMap.get(r.origin_site_id) ?? "—")
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      id: "to",
      header: "To",
      cell: (r) =>
        r.destination_site_id ? (
          (siteMap.get(r.destination_site_id) ?? "—")
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
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

  const columns: DataTableColumn<Route>[] = canManage
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
