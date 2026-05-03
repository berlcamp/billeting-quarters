"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { useRealtimePostgresChanges } from "@/lib/hooks/use-realtime";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { cn } from "@/lib/utils";
import {
  HEAT_DANGER_BADGE,
  HEAT_DANGER_LABELS,
  type HeatDangerLevel,
} from "@/lib/heat-index";
import { formatManila } from "@/lib/timezone";
import type { Database } from "@/types/database";

type Reading = Database["palaro"]["Tables"]["heat_index_readings"]["Row"];
type Site = Pick<Database["palaro"]["Tables"]["sites"]["Row"], "id" | "name">;

interface Props {
  initialReadings: Reading[];
  sites: Site[];
}

export function ReadingsTable({ initialReadings, sites }: Props) {
  const router = useRouter();

  const siteName = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of sites) m.set(s.id, s.name);
    return m;
  }, [sites]);

  // Render directly from props — useState(initial) would freeze the data on
  // subsequent router.refresh() calls. Realtime events just trigger a refresh.
  useRealtimePostgresChanges<Reading>(
    { schema: "palaro", table: "heat_index_readings", event: "INSERT" },
    () => {
      router.refresh();
    },
  );

  const columns: DataTableColumn<Reading>[] = [
    {
      id: "recorded_at",
      header: "Recorded",
      cell: (r) => (
        <span className="font-mono text-xs">
          {formatManila(r.recorded_at, "MMM d · HH:mm")}
        </span>
      ),
    },
    {
      id: "site",
      header: "Site",
      cell: (r) => siteName.get(r.site_id) ?? "—",
    },
    {
      id: "temp",
      header: "Temp",
      cell: (r) => `${Number(r.temperature_c).toFixed(1)}°C`,
      className: "tabular-nums",
    },
    {
      id: "rh",
      header: "RH",
      cell: (r) => `${Number(r.humidity_percent).toFixed(0)}%`,
      className: "tabular-nums",
    },
    {
      id: "hi",
      header: "Heat index",
      cell: (r) =>
        r.heat_index_c !== null ? (
          <span className="font-mono font-semibold">
            {Number(r.heat_index_c).toFixed(1)}°C
          </span>
        ) : (
          "—"
        ),
      className: "tabular-nums",
    },
    {
      id: "danger",
      header: "Band",
      cell: (r) => {
        const level = r.danger_level as HeatDangerLevel | null;
        if (!level) return "—";
        return (
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-xs font-medium",
              HEAT_DANGER_BADGE[level],
            )}
          >
            {HEAT_DANGER_LABELS[level]}
          </span>
        );
      },
    },
    {
      id: "suspend",
      header: "Suspension",
      cell: (r) =>
        r.game_suspension_recommended ? (
          <span className="text-xs font-medium text-red-700">Flagged</span>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
    },
  ];

  return (
    <DataTable
      data={initialReadings}
      columns={columns}
      rowKey={(r) => r.id}
      pageSize={20}
      empty={{
        title: "No readings yet",
        description: "Record the first reading to seed the history.",
      }}
    />
  );
}
