"use client";

import { useMemo } from "react";
import { ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import {
  VEHICLE_LOG_DIRECTION_BADGE,
  VEHICLE_LOG_DIRECTION_LABELS,
  type VehicleLogDirection,
} from "@/lib/labels";
import { formatManila } from "@/lib/timezone";
import { cn } from "@/lib/utils";
import type { Database } from "@/types/database";

type Vehicle = Pick<
  Database["palaro"]["Tables"]["vehicles"]["Row"],
  "id" | "vehicle_code" | "plate_number"
>;
type Site = Pick<
  Database["palaro"]["Tables"]["sites"]["Row"],
  "id" | "name"
>;
type VehicleLog = Database["palaro"]["Tables"]["vehicle_logs"]["Row"];

interface Props {
  logs: VehicleLog[];
  vehicles: Vehicle[];
  sites: Site[];
}

export function RecentLogs({ logs, vehicles, sites }: Props) {
  const vehicleMap = useMemo(() => {
    const m = new Map<string, Vehicle>();
    for (const v of vehicles) m.set(v.id, v);
    return m;
  }, [vehicles]);
  const siteMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of sites) m.set(s.id, s.name);
    return m;
  }, [sites]);

  if (logs.length === 0) {
    return (
      <EmptyState
        title="No vehicle scans yet"
        description="Once vehicles start checking in, the most recent activity shows up here."
      />
    );
  }

  return (
    <ul className="divide-y rounded-md border">
      {logs.slice(0, 30).map((log) => {
        const v = vehicleMap.get(log.vehicle_id);
        const direction = log.direction as VehicleLogDirection;
        const Icon = direction === "in" ? ArrowDownToLine : ArrowUpFromLine;
        return (
          <li key={log.id} className="flex items-center gap-3 p-3 text-sm">
            <Icon
              className={cn(
                "size-4 shrink-0",
                direction === "in" ? "text-green-600" : "text-blue-600",
              )}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-mono font-semibold">
                  {v?.vehicle_code ?? "—"}
                </span>
                {v?.plate_number ? (
                  <span className="text-xs text-muted-foreground">
                    {v.plate_number}
                  </span>
                ) : null}
              </div>
              <div className="text-xs text-muted-foreground">
                {siteMap.get(log.site_id) ?? "Unknown site"}
                {typeof log.passenger_count === "number"
                  ? ` · ${log.passenger_count} pax`
                  : ""}
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <Badge
                variant="secondary"
                className={cn(
                  "border-transparent",
                  VEHICLE_LOG_DIRECTION_BADGE[direction],
                )}
              >
                {VEHICLE_LOG_DIRECTION_LABELS[direction]}
              </Badge>
              <span className="font-mono text-xs text-muted-foreground">
                {formatManila(log.scanned_at, "MMM d · HH:mm")}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
