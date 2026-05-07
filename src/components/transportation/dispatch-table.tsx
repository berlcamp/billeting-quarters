"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
import { updateDispatchStatus } from "@/lib/actions/vehicles";
import {
  DISPATCH_STATUSES,
  DISPATCH_STATUS_BADGE,
  DISPATCH_STATUS_LABELS,
  type DispatchStatus,
} from "@/lib/labels";
import { formatManila } from "@/lib/timezone";
import { cn } from "@/lib/utils";
import type { Database } from "@/types/database";

type Dispatch = Database["palaro"]["Tables"]["vehicle_dispatches"]["Row"];
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

const ALL = "__all__";

interface Props {
  dispatches: Dispatch[];
  vehicles: Vehicle[];
  sites: Site[];
  delegations: Delegation[];
  canManage: boolean;
}

export function DispatchTable({
  dispatches,
  vehicles,
  sites,
  delegations,
  canManage,
}: Props) {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<DispatchStatus | typeof ALL>(
    ALL,
  );

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
  const delegationMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const d of delegations) m.set(d.id, d.region_code);
    return m;
  }, [delegations]);

  const filtered = useMemo(() => {
    if (statusFilter === ALL) return dispatches;
    return dispatches.filter((d) => d.status === statusFilter);
  }, [dispatches, statusFilter]);

  async function setStatus(id: string, status: DispatchStatus) {
    const result = await updateDispatchStatus({ id, status });
    if (result.error) {
      toast.error("Update failed", { description: result.error });
      return;
    }
    toast.success(`Marked ${DISPATCH_STATUS_LABELS[status].toLowerCase()}`);
    router.refresh();
  }

  const columns: DataTableColumn<Dispatch>[] = [
    {
      id: "trip",
      header: "Trip",
      cell: (d) => (
        <div className="flex flex-col">
          <span className="font-mono font-semibold">
            {vehicleMap.get(d.vehicle_id) ?? "—"}
          </span>
          <span className="text-xs text-muted-foreground">
            {d.delegation_id ? delegationMap.get(d.delegation_id) ?? "—" : "—"}
            {d.sport ? ` · ${d.sport}` : ""}
            {d.team_count ? ` · ${d.team_count} team${d.team_count > 1 ? "s" : ""}` : ""}
          </span>
        </div>
      ),
    },
    {
      id: "route",
      header: "From → To",
      cell: (d) => (
        <span className="text-sm">
          {d.origin_site_id ? siteMap.get(d.origin_site_id) ?? "—" : "—"}
          {" → "}
          {d.destination_site_id
            ? siteMap.get(d.destination_site_id) ?? "—"
            : "—"}
        </span>
      ),
    },
    {
      id: "pax",
      header: "Pax",
      cell: (d) => (
        <span className="font-mono text-sm">{d.expected_pax ?? "—"}</span>
      ),
    },
    {
      id: "scheduled",
      header: "Scheduled",
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

  if (canManage) {
    columns.push({
      id: "actions",
      header: "",
      className: "w-44 text-right",
      cell: (d) => {
        const status = d.status as DispatchStatus;
        if (status === "completed" || status === "cancelled") {
          return <span className="text-muted-foreground text-xs">—</span>;
        }
        return (
          <div className="flex items-center justify-end gap-1">
            {status === "scheduled" ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setStatus(d.id, "in_transit")}
              >
                Start
              </Button>
            ) : null}
            <Button
              size="sm"
              variant="outline"
              onClick={() => setStatus(d.id, "completed")}
            >
              Complete
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setStatus(d.id, "cancelled")}
            >
              Cancel
            </Button>
          </div>
        );
      },
    });
  }

  return (
    <DataTable
      data={filtered}
      columns={columns}
      rowKey={(d) => d.id}
      pageSize={20}
      filters={
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
      }
      empty={{
        title: "No dispatches yet",
        description:
          "Create a dispatch when a vehicle leaves with delegation passengers.",
      }}
    />
  );
}
