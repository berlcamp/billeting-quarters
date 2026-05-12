"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, QrCode, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { VehicleFormDialog } from "./vehicle-form-dialog";
import { VehicleQrDialog } from "./vehicle-qr-dialog";
import { deleteVehicle } from "@/lib/actions/vehicles";
import {
  VEHICLE_TYPES,
  VEHICLE_TYPE_LABELS,
  type VehicleType,
} from "@/lib/labels";
import { cn } from "@/lib/utils";
import type { Database } from "@/types/database";

type Vehicle = Database["palaro"]["Tables"]["vehicles"]["Row"];

const ALL_TYPE = "__all__";

interface Props {
  vehicles: Vehicle[];
  // Vehicle IDs that currently have an open trip (status = scheduled or in_transit).
  activeVehicleIds: Set<string>;
  canManage: boolean;
}

export function VehicleTable({ vehicles, activeVehicleIds, canManage }: Props) {
  const router = useRouter();
  const [typeFilter, setTypeFilter] = useState<VehicleType | typeof ALL_TYPE>(
    ALL_TYPE,
  );

  const filtered = useMemo(() => {
    if (typeFilter === ALL_TYPE) return vehicles;
    return vehicles.filter((v) => v.vehicle_type === typeFilter);
  }, [vehicles, typeFilter]);

  async function handleDelete(id: string, code: string) {
    if (
      !window.confirm(
        `Decommission ${code}? Logs are kept; the vehicle stops appearing in pickers.`,
      )
    ) {
      return;
    }
    const result = await deleteVehicle({ id });
    if (result.error) {
      toast.error("Decommission failed", { description: result.error });
      return;
    }
    toast.success(`${code} decommissioned`);
    router.refresh();
  }

  const columns: DataTableColumn<Vehicle>[] = [
    {
      id: "code",
      header: "Vehicle",
      cell: (v) => (
        <div className="flex flex-col">
          <span className="font-mono text-sm font-semibold">
            {v.vehicle_code}
          </span>
          {v.plate_number ? (
            <span className="text-xs text-muted-foreground">
              {v.plate_number}
            </span>
          ) : null}
        </div>
      ),
    },
    {
      id: "type",
      header: "Type",
      cell: (v) => VEHICLE_TYPE_LABELS[v.vehicle_type as VehicleType],
    },
    {
      id: "make",
      header: "Make / model",
      cell: (v) =>
        v.make_model ?? <span className="text-muted-foreground">—</span>,
    },
    {
      id: "driver",
      header: "Driver",
      cell: (v) => (
        <div className="flex flex-col">
          <span>{v.driver_name ?? "—"}</span>
          {v.driver_contact ? (
            <span className="font-mono text-xs text-muted-foreground">
              {v.driver_contact}
            </span>
          ) : null}
        </div>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: (v) => {
        const onTrip = activeVehicleIds.has(v.id);
        return (
          <Badge
            variant="secondary"
            className={cn(
              "border-transparent",
              onTrip
                ? "bg-blue-100 text-blue-800"
                : "bg-gray-100 text-gray-700",
            )}
          >
            {onTrip ? "On trip" : "Idle"}
          </Badge>
        );
      },
    },
    {
      id: "assignment",
      header: "Assignment",
      cell: (v) =>
        v.current_assignment ?? (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      id: "actions",
      header: "",
      className: "w-32 text-right",
      cell: (v) => (
        <div className="flex items-center justify-end gap-1">
          <VehicleQrDialog
            vehicle={v}
            trigger={
              <Button size="icon-sm" variant="ghost" aria-label="View QR">
                <QrCode className="size-3.5" />
              </Button>
            }
          />
          {canManage ? (
            <>
              <VehicleFormDialog
                vehicle={v}
                trigger={
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label="Edit vehicle"
                  >
                    <Pencil className="size-3.5" />
                  </Button>
                }
              />
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="Decommission vehicle"
                onClick={() => handleDelete(v.id, v.vehicle_code)}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <DataTable
      data={filtered}
      columns={columns}
      rowKey={(v) => v.id}
      pageSize={20}
      searchable={{
        placeholder: "Search code, plate, driver…",
        predicate: (v, q) =>
          v.vehicle_code.toLowerCase().includes(q) ||
          (v.plate_number?.toLowerCase().includes(q) ?? false) ||
          (v.driver_name?.toLowerCase().includes(q) ?? false) ||
          (v.make_model?.toLowerCase().includes(q) ?? false),
      }}
      filters={
        <Select
          value={typeFilter}
          onValueChange={(v) => setTypeFilter(v as VehicleType | typeof ALL_TYPE)}
        >
          <SelectTrigger className="h-9 w-44">
            <SelectValue>
              {(v: string | null) => {
                if (!v || v === ALL_TYPE) return "All types";
                return VEHICLE_TYPE_LABELS[v as VehicleType];
              }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_TYPE}>All types</SelectItem>
            {VEHICLE_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {VEHICLE_TYPE_LABELS[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      }
      empty={{
        title: "No vehicles yet",
        description: "Add a bus, van, or service vehicle to start tracking.",
      }}
    />
  );
}
