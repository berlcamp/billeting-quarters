"use client";

import { useMemo, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Pencil } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DataTable,
  type DataTableColumn,
} from "@/components/shared/data-table";
import { cn } from "@/lib/utils";
import {
  ATTENDANCE_TYPE_BADGE,
  ATTENDANCE_TYPE_LABELS,
  type AttendanceType,
} from "@/lib/labels";
import { formatManila, manilaDateLabel } from "@/lib/timezone";
import { AttendanceEditDialog } from "./attendance-edit-dialog";
import type { Database } from "@/types/database";

type AttendanceLog = Database["palaro"]["Tables"]["attendance_logs"]["Row"];
type Personnel = Pick<
  Database["palaro"]["Tables"]["personnel"]["Row"],
  "id" | "full_name" | "committee" | "designation" | "agency" | "site_id"
>;
type Site = Pick<Database["palaro"]["Tables"]["sites"]["Row"], "id" | "name">;

interface Props {
  logs: AttendanceLog[];
  personnel: Personnel[];
  sites: Site[];
  selectedDate: string;
  today: string;
}

export function AttendanceTable({
  logs,
  personnel,
  sites,
  selectedDate,
  today,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const [profileOpen, setProfileOpen] = useState<Personnel | null>(null);

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

  // Per-personnel breakdown of the day's logs, ordered chronologically.
  // Drives both the summary cards and the "missing pair" status detection.
  const perPersonnel = useMemo(() => {
    const byId = new Map<
      string,
      { ins: number; outs: number; lastType: AttendanceType | null }
    >();
    const ascending = [...logs].sort((a, b) =>
      a.scanned_at.localeCompare(b.scanned_at),
    );
    for (const l of ascending) {
      const slot = byId.get(l.personnel_id) ?? {
        ins: 0,
        outs: 0,
        lastType: null,
      };
      if (l.type === "time_in") slot.ins += 1;
      else if (l.type === "time_out") slot.outs += 1;
      slot.lastType = l.type as AttendanceType;
      byId.set(l.personnel_id, slot);
    }
    return byId;
  }, [logs]);

  const summary = useMemo(() => {
    let scanned = 0;
    let missing = 0;
    let active = 0;
    for (const [, s] of perPersonnel) {
      scanned += 1;
      if (s.ins !== s.outs) missing += 1;
      if (s.lastType === "time_in") active += 1;
    }
    return { scanned, missing, active };
  }, [perPersonnel]);

  function setDate(next: string) {
    const params = new URLSearchParams();
    if (next && next !== today) params.set("date", next);
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

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
        if (!p) {
          return <span className="text-muted-foreground">Unknown</span>;
        }
        return (
          <button
            type="button"
            className="text-left hover:underline"
            onClick={(e) => {
              e.stopPropagation();
              setProfileOpen(p);
            }}
          >
            <div className="font-medium">{p.full_name}</div>
            {p.committee ? (
              <div className="text-xs text-muted-foreground">{p.committee}</div>
            ) : null}
          </button>
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
    {
      id: "actions",
      header: "",
      className: "w-[1%] whitespace-nowrap text-right",
      cell: (l) => {
        const p = personnelMap.get(l.personnel_id);
        return (
          <AttendanceEditDialog
            log={l}
            sites={sites}
            personnelName={p?.full_name ?? null}
            trigger={
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={(e) => e.stopPropagation()}
              >
                <Pencil className="size-3.5" />
                Edit
              </Button>
            }
          />
        );
      },
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SummaryCard
          label="Personnel scanned"
          value={summary.scanned}
          hint={manilaDateLabel(selectedDate)}
        />
        <SummaryCard
          label="Missing time-in / out"
          value={summary.missing}
          hint="Unpaired logs on this date"
        />
        <SummaryCard
          label="Currently active"
          value={summary.active}
          hint="Last scan was a time-in"
        />
      </div>

      <DataTable
        data={logs}
        columns={columns}
        rowKey={(l) => l.id}
        pageSize={25}
        searchable={{
          placeholder: "Search by name, committee, agency, site…",
          predicate: (l, q) => {
            const p = personnelMap.get(l.personnel_id);
            const siteName = l.site_id ? siteMap.get(l.site_id) : null;
            return (
              (p?.full_name.toLowerCase().includes(q) ?? false) ||
              (p?.committee?.toLowerCase().includes(q) ?? false) ||
              (p?.designation?.toLowerCase().includes(q) ?? false) ||
              (p?.agency?.toLowerCase().includes(q) ?? false) ||
              (siteName?.toLowerCase().includes(q) ?? false)
            );
          },
        }}
        filters={
          <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
            Date
            <Input
              type="date"
              value={selectedDate}
              max={today}
              onChange={(e) => setDate(e.target.value || today)}
              className="h-9 w-[160px]"
            />
            {selectedDate !== today ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setDate(today)}
              >
                Today
              </Button>
            ) : null}
          </label>
        }
        empty={{
          title: "No attendance recorded for this date",
          description:
            "Scan a Palaro Bayugan Command QR code, or pick another date.",
        }}
      />

      <ProfileDialog
        personnel={profileOpen}
        siteName={
          profileOpen?.site_id
            ? siteMap.get(profileOpen.site_id) ?? null
            : null
        }
        onClose={() => setProfileOpen(null)}
      />
    </div>
  );
}

function SummaryCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </div>
        <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
        {hint ? (
          <div className="mt-1 text-xs text-muted-foreground">{hint}</div>
        ) : null}
      </CardContent>
    </Card>
  );
}

function ProfileDialog({
  personnel,
  siteName,
  onClose,
}: {
  personnel: Personnel | null;
  siteName: string | null;
  onClose: () => void;
}) {
  const open = !!personnel;
  return (
    <Dialog open={open} onOpenChange={(o) => (o ? null : onClose())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{personnel?.full_name ?? "Personnel"}</DialogTitle>
          <DialogDescription>
            {personnel?.designation ?? "Personnel profile"}
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <ProfileField label="Committee" value={personnel?.committee} />
          <ProfileField label="Agency" value={personnel?.agency} />
          <ProfileField label="Assigned site" value={siteName} wide />
        </div>
        <DialogFooter>
          <Button onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ProfileField({
  label,
  value,
  wide,
}: {
  label: string;
  value: string | null | undefined;
  wide?: boolean;
}) {
  return (
    <div className={wide ? "col-span-2" : undefined}>
      <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5">
        {value ? value : <span className="text-muted-foreground">—</span>}
      </div>
    </div>
  );
}
