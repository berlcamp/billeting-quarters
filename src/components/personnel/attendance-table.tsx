"use client";

import { useMemo } from "react";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { cn } from "@/lib/utils";
import {
  ATTENDANCE_TYPE_BADGE,
  ATTENDANCE_TYPE_LABELS,
  type AttendanceType,
} from "@/lib/labels";
import { formatManila } from "@/lib/timezone";
import type { Database } from "@/types/database";

type AttendanceLog = Database["palaro"]["Tables"]["attendance_logs"]["Row"];
type Personnel = Pick<
  Database["palaro"]["Tables"]["personnel"]["Row"],
  "id" | "full_name" | "committee" | "designation" | "agency"
>;
type Site = Pick<Database["palaro"]["Tables"]["sites"]["Row"], "id" | "name">;

interface Props {
  logs: AttendanceLog[];
  personnel: Personnel[];
  sites: Site[];
}

export function AttendanceTable({ logs, personnel, sites }: Props) {
  const personnelMap = useMemo(() => {
    const m = new Map<string, Personnel>();
    for (const p of personnel) m.set(p.id, p);
    return m;
  }, [personnel]);
  const siteMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of sites) m.set(s.id, s.name);
    return m;
  }, [sites]);

  const columns: DataTableColumn<AttendanceLog>[] = [
    {
      id: "scanned_at",
      header: "When",
      cell: (l) => (
        <span className="font-mono text-xs">
          {formatManila(l.scanned_at, "MMM d · HH:mm:ss")}
        </span>
      ),
    },
    {
      id: "personnel",
      header: "Personnel",
      cell: (l) => {
        const p = personnelMap.get(l.personnel_id);
        if (!p) return "Unknown";
        return (
          <div>
            <div>{p.full_name}</div>
            {p.committee ? (
              <div className="text-xs text-muted-foreground">
                {p.committee}
              </div>
            ) : null}
          </div>
        );
      },
    },
    {
      id: "type",
      header: "Type",
      cell: (l) => {
        const t = l.type as AttendanceType;
        return (
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-xs font-medium",
              ATTENDANCE_TYPE_BADGE[t],
            )}
          >
            {ATTENDANCE_TYPE_LABELS[t]}
          </span>
        );
      },
    },
    {
      id: "site",
      header: "Site",
      cell: (l) =>
        l.site_id ? (
          siteMap.get(l.site_id) ?? "—"
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
  ];

  return (
    <DataTable
      data={logs}
      columns={columns}
      rowKey={(l) => l.id}
      pageSize={25}
      empty={{
        title: "No attendance recorded today",
        description:
          "Scan a Palaro Command QR code or use Manual entry to record the first log.",
      }}
    />
  );
}
