"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { deleteFuelLog } from "@/lib/actions/vehicles";
import { formatManila } from "@/lib/timezone";
import type { Database } from "@/types/database";

type FuelLog = Database["palaro"]["Tables"]["vehicle_fuel_logs"]["Row"];
type Vehicle = Pick<
  Database["palaro"]["Tables"]["vehicles"]["Row"],
  "id" | "vehicle_code"
>;

interface Props {
  logs: FuelLog[];
  vehicles: Vehicle[];
  canManage: boolean;
}

export function FuelLogTable({ logs, vehicles, canManage }: Props) {
  const router = useRouter();
  const vehicleMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const v of vehicles) m.set(v.id, v.vehicle_code);
    return m;
  }, [vehicles]);

  async function handleDelete(id: string) {
    if (!window.confirm("Delete this fuel entry?")) return;
    const result = await deleteFuelLog({ id });
    if (result.error) {
      toast.error("Delete failed", { description: result.error });
      return;
    }
    toast.success("Fuel entry deleted");
    router.refresh();
  }

  const baseColumns: DataTableColumn<FuelLog>[] = [
    {
      id: "when",
      header: "When",
      cell: (l) => (
        <span className="font-mono text-xs">
          {formatManila(l.refilled_at, "MMM d · HH:mm")}
        </span>
      ),
    },
    {
      id: "vehicle",
      header: "Vehicle",
      cell: (l) => (
        <span className="font-mono text-sm">
          {vehicleMap.get(l.vehicle_id) ?? "—"}
        </span>
      ),
    },
    {
      id: "liters",
      header: "Liters",
      cell: (l) => (
        <span className="font-mono">{Number(l.liters).toFixed(2)}</span>
      ),
    },
    {
      id: "cost",
      header: "Cost (PHP)",
      cell: (l) =>
        l.cost_php != null ? (
          <span className="font-mono">{Number(l.cost_php).toFixed(2)}</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      id: "odometer",
      header: "Odometer",
      cell: (l) =>
        l.odometer_km != null ? (
          <span className="font-mono">{l.odometer_km} km</span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      id: "station",
      header: "Station",
      cell: (l) =>
        l.station ?? <span className="text-muted-foreground">—</span>,
    },
  ];

  const columns: DataTableColumn<FuelLog>[] = canManage
    ? [
        ...baseColumns,
        {
          id: "actions",
          header: "",
          className: "w-12",
          cell: (l) => (
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label="Delete entry"
              onClick={() => handleDelete(l.id)}
            >
              <Trash2 className="size-3.5" />
            </Button>
          ),
        },
      ]
    : baseColumns;

  return (
    <DataTable
      data={logs}
      columns={columns}
      rowKey={(l) => l.id}
      pageSize={20}
      empty={{
        title: "No fuel entries yet",
        description: canManage
          ? "Log refills to track consumption per vehicle."
          : "No refills recorded yet.",
      }}
    />
  );
}
