"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import {
  DISPATCH_STATUSES,
  DISPATCH_STATUS_BADGE,
  DISPATCH_STATUS_LABELS,
  type DispatchStatus,
  VEHICLE_TYPES,
  VEHICLE_TYPE_LABELS,
  type VehicleType,
} from "@/lib/labels";
import { formatManila } from "@/lib/timezone";
import { cn } from "@/lib/utils";
import type { Database } from "@/types/database";

type Dispatch = Database["palaro"]["Tables"]["vehicle_dispatches"]["Row"];
type Leg = Pick<
  Database["palaro"]["Tables"]["vehicle_trip_legs"]["Row"],
  | "id"
  | "dispatch_id"
  | "leg_order"
  | "from_site_id"
  | "from_label"
  | "to_site_id"
  | "to_label"
  | "departed_at"
  | "arrived_at"
>;
type Manifest = Pick<
  Database["palaro"]["Tables"]["vehicle_trip_manifest"]["Row"],
  "dispatch_id" | "total_passengers" | "dropped_off"
>;
type Vehicle = Pick<
  Database["palaro"]["Tables"]["vehicles"]["Row"],
  "id" | "vehicle_code" | "vehicle_type"
>;
type Site = Pick<
  Database["palaro"]["Tables"]["sites"]["Row"],
  "id" | "name"
>;

const ALL = "__all__";

interface Props {
  dispatches: Dispatch[];
  legs: Leg[];
  manifest: Manifest[];
  vehicles: Vehicle[];
  sites: Site[];
}

export function DispatchTable({
  dispatches,
  legs,
  manifest,
  vehicles,
  sites,
}: Props) {
  const [statusFilter, setStatusFilter] = useState<DispatchStatus | typeof ALL>(
    ALL,
  );
  const [typeFilter, setTypeFilter] = useState<VehicleType | typeof ALL>(ALL);

  const vehicleMap = useMemo(
    () => new Map(vehicles.map((v) => [v.id, v.vehicle_code])),
    [vehicles],
  );
  const vehicleTypeMap = useMemo(
    () => new Map(vehicles.map((v) => [v.id, v.vehicle_type])),
    [vehicles],
  );
  const siteMap = useMemo(
    () => new Map(sites.map((s) => [s.id, s.name])),
    [sites],
  );

  const lastLegByDispatch = useMemo(() => {
    const m = new Map<string, Leg>();
    for (const leg of legs) {
      const prev = m.get(leg.dispatch_id);
      if (!prev || leg.leg_order > prev.leg_order) m.set(leg.dispatch_id, leg);
    }
    return m;
  }, [legs]);

  const manifestSummary = useMemo(() => {
    const m = new Map<string, { groups: number; pax: number; remaining: number }>();
    for (const row of manifest) {
      const prev = m.get(row.dispatch_id) ?? {
        groups: 0,
        pax: 0,
        remaining: 0,
      };
      prev.groups += 1;
      prev.pax += row.total_passengers;
      prev.remaining += row.total_passengers - row.dropped_off;
      m.set(row.dispatch_id, prev);
    }
    return m;
  }, [manifest]);

  const filtered = useMemo(() => {
    return dispatches.filter((d) => {
      if (statusFilter !== ALL && d.status !== statusFilter) return false;
      if (
        typeFilter !== ALL &&
        vehicleTypeMap.get(d.vehicle_id) !== typeFilter
      )
        return false;
      return true;
    });
  }, [dispatches, statusFilter, typeFilter, vehicleTypeMap]);

  const columns: DataTableColumn<Dispatch>[] = [
    {
      id: "vehicle",
      header: "Vehicle",
      cell: (d) => (
        <Link
          href={`/dashboard/transportation/trips/${d.id}`}
          className="font-mono font-semibold hover:underline"
        >
          {vehicleMap.get(d.vehicle_id) ?? "—"}
        </Link>
      ),
    },
    {
      id: "current_leg",
      header: "Current leg",
      cell: (d) => {
        const leg = lastLegByDispatch.get(d.id);
        if (!leg) {
          return <span className="text-xs text-muted-foreground">—</span>;
        }
        const from = leg.from_site_id
          ? siteMap.get(leg.from_site_id) ?? leg.from_label
          : leg.from_label;
        const to = leg.to_site_id
          ? siteMap.get(leg.to_site_id) ?? leg.to_label
          : leg.to_label;
        return (
          <div className="flex flex-col text-sm">
            <span>
              {from ?? "—"} <ArrowRight className="mx-1 inline size-3" />{" "}
              {to ?? "—"}
            </span>
            <span className="text-xs text-muted-foreground">
              leg {leg.leg_order} ·{" "}
              {leg.arrived_at
                ? `arrived ${formatManila(leg.arrived_at, "MMM d · HH:mm")}`
                : "in transit"}
            </span>
          </div>
        );
      },
    },
    {
      id: "manifest",
      header: "Manifest",
      cell: (d) => {
        const s = manifestSummary.get(d.id);
        if (!s) return <span className="text-xs text-muted-foreground">—</span>;
        return (
          <span className="text-sm">
            {s.groups} group{s.groups === 1 ? "" : "s"} · {s.pax} pax
            {s.remaining > 0 ? (
              <span className="ml-1 text-amber-700 dark:text-amber-300">
                ({s.remaining} on board)
              </span>
            ) : null}
          </span>
        );
      },
    },
    {
      id: "opened",
      header: "Opened",
      cell: (d) => (
        <span className="font-mono text-xs">
          {formatManila(d.dispatched_at, "MMM d · HH:mm")}
        </span>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: (d) => (
        <Badge
          variant="secondary"
          className={cn(
            "border-transparent",
            DISPATCH_STATUS_BADGE[d.status as DispatchStatus],
          )}
        >
          {DISPATCH_STATUS_LABELS[d.status as DispatchStatus]}
        </Badge>
      ),
    },
  ];

  return (
    <DataTable
      data={filtered}
      columns={columns}
      rowKey={(d) => d.id}
      pageSize={20}
      filters={
        <>
          <Select
            value={typeFilter}
            onValueChange={(v) => setTypeFilter(v as VehicleType | typeof ALL)}
          >
            <SelectTrigger className="h-9 w-44">
              <SelectValue>
                {(v: string | null) => {
                  if (!v || v === ALL) return "All vehicle types";
                  return VEHICLE_TYPE_LABELS[v as VehicleType];
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All vehicle types</SelectItem>
              {VEHICLE_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {VEHICLE_TYPE_LABELS[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={statusFilter}
            onValueChange={(v) =>
              setStatusFilter(v as DispatchStatus | typeof ALL)
            }
          >
            <SelectTrigger className="h-9 w-44">
              <SelectValue>
                {(v: string | null) => {
                  if (!v || v === ALL) return "All statuses";
                  return DISPATCH_STATUS_LABELS[v as DispatchStatus];
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All statuses</SelectItem>
              {DISPATCH_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {DISPATCH_STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </>
      }
      empty={{
        title: "No trips yet",
        description:
          "Use Scan for Departure on a bus to open the first trip.",
      }}
    />
  );
}
