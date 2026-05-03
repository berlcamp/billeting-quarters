"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  CircleDashed,
  Pencil,
  ShieldCheck,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScheduleFormDialog } from "./schedule-form-dialog";
import {
  approveSchedule,
  cancelSchedule,
  completeSchedule,
} from "@/lib/actions/venues";
import {
  SCHEDULE_STATUSES,
  SCHEDULE_STATUS_BADGE,
  SCHEDULE_STATUS_LABELS,
  type ScheduleStatus,
} from "@/lib/labels";
import { formatManila } from "@/lib/timezone";
import { cn } from "@/lib/utils";
import type { Database } from "@/types/database";

type Schedule = Database["palaro"]["Tables"]["venue_schedules"]["Row"];
type Venue = Pick<
  Database["palaro"]["Tables"]["sites"]["Row"],
  "id" | "name" | "site_type"
>;
type Delegation = Pick<
  Database["palaro"]["Tables"]["delegations"]["Row"],
  "id" | "region_code" | "region_name"
>;

const ALL_STATUS = "__all__";

interface Props {
  schedules: Schedule[];
  venues: Venue[];
  delegations: Delegation[];
  canBook: boolean;
  canApprove: boolean;
}

export function ScheduleTable({
  schedules,
  venues,
  delegations,
  canBook,
  canApprove,
}: Props) {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<
    ScheduleStatus | typeof ALL_STATUS
  >(ALL_STATUS);

  const venueMap = useMemo(() => {
    const m = new Map<string, Venue>();
    for (const v of venues) m.set(v.id, v);
    return m;
  }, [venues]);
  const delMap = useMemo(() => {
    const m = new Map<string, Delegation>();
    for (const d of delegations) m.set(d.id, d);
    return m;
  }, [delegations]);

  const filtered = useMemo(() => {
    if (statusFilter === ALL_STATUS) return schedules;
    return schedules.filter((s) => s.status === statusFilter);
  }, [schedules, statusFilter]);

  async function handleCancel(id: string) {
    const reason = window.prompt("Reason for cancellation? (optional)") ?? "";
    const result = await cancelSchedule({ id, reason: reason || undefined });
    if (result.error) {
      toast.error("Cancel failed", { description: result.error });
      return;
    }
    toast.success("Booking cancelled");
    router.refresh();
  }

  async function handleApprove(id: string) {
    const result = await approveSchedule({ id });
    if (result.error) {
      toast.error("Approve failed", { description: result.error });
      return;
    }
    toast.success("Special request approved");
    router.refresh();
  }

  async function handleComplete(id: string) {
    const result = await completeSchedule({ id });
    if (result.error) {
      toast.error("Mark complete failed", { description: result.error });
      return;
    }
    toast.success("Marked complete");
    router.refresh();
  }

  const columns: DataTableColumn<Schedule>[] = [
    {
      id: "when",
      header: "When (PHT)",
      cell: (s) => (
        <div className="flex flex-col">
          <span className="font-mono text-xs">
            {formatManila(s.scheduled_start, "MMM d · HH:mm")}
          </span>
          <span className="font-mono text-xs text-muted-foreground">
            → {formatManila(s.scheduled_end, "HH:mm")}
          </span>
        </div>
      ),
    },
    {
      id: "venue",
      header: "Venue",
      cell: (s) => venueMap.get(s.venue_id)?.name ?? "—",
    },
    {
      id: "delegation",
      header: "Delegation",
      cell: (s) => {
        const d = delMap.get(s.delegation_id);
        return d ? (
          <span>
            <span className="font-mono">{d.region_code}</span>{" "}
            <span className="text-muted-foreground">— {d.region_name}</span>
          </span>
        ) : (
          "—"
        );
      },
    },
    {
      id: "sport",
      header: "Sport",
      cell: (s) => s.sport ?? <span className="text-muted-foreground">—</span>,
    },
    {
      id: "status",
      header: "Status",
      cell: (s) => (
        <Badge
          variant="secondary"
          className={cn(
            "border-transparent capitalize",
            SCHEDULE_STATUS_BADGE[s.status as ScheduleStatus],
          )}
        >
          {SCHEDULE_STATUS_LABELS[s.status as ScheduleStatus]}
        </Badge>
      ),
    },
    {
      id: "actions",
      header: "",
      className: "w-44 text-right",
      cell: (s) => {
        const status = s.status as ScheduleStatus;
        const finished = status === "cancelled" || status === "completed";
        return (
          <div className="flex items-center justify-end gap-1">
            {canApprove && status === "special_request" ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleApprove(s.id)}
              >
                <ShieldCheck className="size-3.5" />
                Approve
              </Button>
            ) : null}
            {canBook && !finished ? (
              <ScheduleFormDialog
                venues={venues}
                delegations={delegations}
                schedule={s}
                trigger={
                  <Button size="icon-sm" variant="ghost" aria-label="Edit booking">
                    <Pencil className="size-3.5" />
                  </Button>
                }
              />
            ) : null}
            {canBook && status === "booked" ? (
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="Mark complete"
                onClick={() => handleComplete(s.id)}
              >
                <CheckCircle2 className="size-3.5" />
              </Button>
            ) : null}
            {canBook && !finished ? (
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label="Cancel booking"
                onClick={() => handleCancel(s.id)}
              >
                <X className="size-3.5" />
              </Button>
            ) : null}
            {finished ? (
              <CircleDashed className="size-3.5 text-muted-foreground" />
            ) : null}
          </div>
        );
      },
    },
  ];

  return (
    <DataTable
      data={filtered}
      columns={columns}
      rowKey={(s) => s.id}
      pageSize={20}
      searchable={{
        placeholder: "Search venue, delegation, sport…",
        predicate: (s, q) => {
          const venue = venueMap.get(s.venue_id)?.name ?? "";
          const del = delMap.get(s.delegation_id);
          return (
            venue.toLowerCase().includes(q) ||
            (del?.region_code.toLowerCase().includes(q) ?? false) ||
            (del?.region_name.toLowerCase().includes(q) ?? false) ||
            (s.sport?.toLowerCase().includes(q) ?? false)
          );
        },
      }}
      filters={
        <Select
          value={statusFilter}
          onValueChange={(v) =>
            setStatusFilter(v as ScheduleStatus | typeof ALL_STATUS)
          }
        >
          <SelectTrigger className="h-9 w-44">
            <SelectValue>
              {(v: string | null) => {
                if (!v || v === ALL_STATUS) return "All statuses";
                return SCHEDULE_STATUS_LABELS[v as ScheduleStatus];
              }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_STATUS}>All statuses</SelectItem>
            {SCHEDULE_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {SCHEDULE_STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      }
      empty={{
        title: "No bookings yet",
        description: canBook
          ? "Book the first practice slot to get started."
          : "No published bookings yet.",
      }}
    />
  );
}
