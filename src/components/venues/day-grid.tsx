"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ScheduleFormDialog } from "./schedule-form-dialog";
import { Badge } from "@/components/ui/badge";
import { deleteSchedule } from "@/lib/actions/venues";
import {
  SCHEDULE_STATUS_BADGE,
  SCHEDULE_STATUS_LABELS,
  type ScheduleStatus,
} from "@/lib/labels";
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

interface Props {
  date: string; // YYYY-MM-DD in PHT
  venues: Venue[];
  delegations: Delegation[];
  schedules: Schedule[];
  canBook: boolean;
  canForceStatus?: boolean;
}

const HOUR_START = 6; // 06:00 PHT
const HOUR_END = 22; // 22:00 PHT
const HOURS = Array.from(
  { length: HOUR_END - HOUR_START + 1 },
  (_, i) => HOUR_START + i,
);

// Convert a UTC ISO timestamp to {hour, minute} in Asia/Manila.
function toManilaHm(iso: string): { h: number; m: number } {
  const date = new Date(iso);
  // Manila is UTC+8, no DST.
  const t = date.getTime() + 8 * 60 * 60 * 1000;
  const d = new Date(t);
  return { h: d.getUTCHours(), m: d.getUTCMinutes() };
}

function isoForLocal(date: string, hour: number): string {
  // Construct a UTC ISO that represents `date` at `hour:00` in Asia/Manila.
  const [y, m, d] = date.split("-").map((s) => Number(s));
  const utcMs = Date.UTC(y, m - 1, d, hour - 8, 0, 0);
  return new Date(utcMs).toISOString();
}

export function DayGrid({
  date,
  venues,
  delegations,
  schedules,
  canBook,
  canForceStatus = false,
}: Props) {
  const delMap = useMemo(() => {
    const m = new Map<string, Delegation>();
    for (const d of delegations) m.set(d.id, d);
    return m;
  }, [delegations]);

  // Group bookings by venue → court so multi-court venues render one row per
  // court in use. Status='cancelled' is rendered with reduced opacity.
  const byVenueCourt = useMemo(() => {
    const m = new Map<string, Map<number, Schedule[]>>();
    for (const s of schedules) {
      const courts = m.get(s.venue_id) ?? new Map<number, Schedule[]>();
      const arr = courts.get(s.court_number) ?? [];
      arr.push(s);
      courts.set(s.court_number, arr);
      m.set(s.venue_id, courts);
    }
    return m;
  }, [schedules]);

  // For each venue, the sorted list of courts that have bookings today.
  // Falls back to [1] so an empty venue still has a click-to-book row.
  function courtsFor(venueId: string): number[] {
    const courts = byVenueCourt.get(venueId);
    if (!courts || courts.size === 0) return [1];
    return Array.from(courts.keys()).sort((a, b) => a - b);
  }

  if (venues.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-12 text-center text-sm text-muted-foreground">
        No playing venues yet. Add some in Admin → Sites.
      </div>
    );
  }

  const stripGradient = `repeating-linear-gradient(
    to right,
    transparent 0,
    transparent calc(100% / ${HOURS.length} - 1px),
    var(--border) calc(100% / ${HOURS.length} - 1px),
    var(--border) calc(100% / ${HOURS.length})
  )`;

  return (
    <div className="overflow-x-auto rounded-md border">
      <div className="min-w-[720px]">
        {/* Header row */}
        <div className="flex border-b bg-muted/40">
          <div className="flex shrink-0" style={{ width: "180px" }}>
            <div className="w-[120px] px-3 py-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Venue
            </div>
            <div className="w-[60px] border-l py-2 text-center text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Court
            </div>
          </div>
          <div className="flex flex-1">
            {HOURS.map((h) => (
              <div
                key={`h-${h}`}
                className="flex-1 border-l py-2 text-center font-mono text-xs text-muted-foreground"
              >
                {String(h).padStart(2, "0")}
              </div>
            ))}
          </div>
        </div>

        {/* One block per venue; the venue label is shown once and its courts
            are listed as sub-rows on the right. */}
        {venues.map((v) => {
          const courts = courtsFor(v.id);
          return (
            <div key={v.id} className="flex border-t" data-venue-id={v.id}>
              <div
                className="flex shrink-0 items-center bg-muted/10 px-3 py-3 text-sm font-medium"
                style={{ width: "120px" }}
              >
                {v.name}
              </div>
              <div className="flex flex-1 flex-col">
                {courts.map((court, idx) => {
                  const items =
                    byVenueCourt.get(v.id)?.get(court) ?? [];
                  return (
                    <div
                      key={court}
                      className={cn("flex", idx > 0 && "border-t")}
                      data-court={court}
                    >
                      <div className="flex w-[60px] shrink-0 items-center justify-center border-l py-3 text-xs text-muted-foreground">
                        Court {court}
                      </div>
                      <div
                        className="relative flex-1 border-l"
                        style={{
                          backgroundImage: stripGradient,
                          minHeight: "64px",
                        }}
                      >
                        {/* Click-to-book hour cells first (rendered underneath
                            booking pills so pill clicks hit the pill). */}
                        {canBook
                          ? HOURS.map((h) => (
                              <ScheduleFormDialog
                                key={`book-${v.id}-${court}-${h}`}
                                venues={venues}
                                delegations={delegations}
                                defaultVenueId={v.id}
                                defaultStart={isoForLocal(date, h)}
                                defaultCourtNumber={court}
                                trigger={
                                  <button
                                    type="button"
                                    aria-label={`Book ${v.name} court ${court} at ${h}:00`}
                                    className="absolute top-0 bottom-0 cursor-pointer hover:bg-accent/20"
                                    style={{
                                      left: `${((h - HOUR_START) / HOURS.length) * 100}%`,
                                      width: `${100 / HOURS.length}%`,
                                    }}
                                  />
                                }
                              />
                            ))
                          : null}

                        {/* Existing bookings on this court (rendered on top of
                            the click-to-book cells so the pill receives clicks). */}
                        {items.map((s) => (
                          <BookingPill
                            key={s.id}
                            schedule={s}
                            court={court}
                            delegationName={
                              delMap.get(s.delegation_id)?.region_code ?? null
                            }
                            venues={venues}
                            delegations={delegations}
                            canEdit={canBook}
                            canForceStatus={canForceStatus}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="border-t bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        <div className="flex flex-wrap items-center gap-3">
          <span>Legend:</span>
          <Badge
            variant="secondary"
            className={cn("border-transparent", SCHEDULE_STATUS_BADGE.booked)}
          >
            booked
          </Badge>
          <Badge
            variant="secondary"
            className={cn(
              "border-transparent",
              SCHEDULE_STATUS_BADGE.special_request,
            )}
          >
            special request
          </Badge>
          <Badge
            variant="secondary"
            className={cn("border-transparent", SCHEDULE_STATUS_BADGE.completed)}
          >
            completed
          </Badge>
          <Badge
            variant="secondary"
            className={cn("border-transparent", SCHEDULE_STATUS_BADGE.cancelled)}
          >
            cancelled
          </Badge>
        </div>
      </div>
    </div>
  );
}

interface BookingPillProps {
  schedule: Schedule;
  court: number;
  delegationName: string | null;
  venues: Venue[];
  delegations: Delegation[];
  canEdit: boolean;
  canForceStatus: boolean;
}

function BookingPill({
  schedule: s,
  court,
  delegationName,
  venues,
  delegations,
  canEdit,
  canForceStatus,
}: BookingPillProps) {
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const start = toManilaHm(s.scheduled_start);
  const end = toManilaHm(s.scheduled_end);
  const startMins = start.h * 60 + start.m;
  const endMins = end.h * 60 + end.m;
  const gridStartMins = HOUR_START * 60;
  const gridEndMins = (HOUR_END + 1) * 60;
  const totalMins = gridEndMins - gridStartMins;
  const left = Math.max(0, ((startMins - gridStartMins) / totalMins) * 100);
  const width = Math.min(
    100 - left,
    ((endMins - Math.max(startMins, gridStartMins)) / totalMins) * 100,
  );
  if (width <= 0) return null;

  const status = s.status as ScheduleStatus;
  const cancelled = status === "cancelled";
  // Super admins keep edit/delete on cancelled bookings so they can revive
  // mis-cancelled slots; everyone else sees a read-only pill.
  const showActions = canEdit && (!cancelled || canForceStatus);

  async function handleDelete() {
    if (!window.confirm("Delete this booking? This cannot be undone.")) return;
    setDeleting(true);
    const result = await deleteSchedule({ id: s.id });
    setDeleting(false);
    if (result.error) {
      toast.error("Delete failed", { description: result.error });
      return;
    }
    toast.success("Booking deleted");
    router.refresh();
  }

  return (
    <>
      <div
        className={cn(
          "absolute top-1 bottom-1 overflow-hidden rounded-md border px-2 py-1 text-xs shadow-sm transition",
          cancelled
            ? "border-gray-300 bg-gray-100/80 text-gray-600 line-through"
            : status === "special_request"
              ? "border-yellow-300 bg-yellow-50 text-yellow-900"
              : status === "completed"
                ? "border-green-300 bg-green-50 text-green-900"
                : "border-blue-300 bg-blue-50 text-blue-900",
        )}
        style={{ left: `${left}%`, width: `${width}%` }}
        title={`${delegationName ?? ""} ${s.sport ?? ""} · Court ${court} · ${SCHEDULE_STATUS_LABELS[status]}`}
      >
        <div className="flex items-center gap-1 pr-12 font-semibold">
          {delegationName ?? "—"}
        </div>
        {s.sport ? (
          <div className="truncate pr-12 text-[10px] opacity-80">{s.sport}</div>
        ) : null}
        {showActions ? (
          <div className="absolute right-0.5 top-0.5 flex items-center gap-0.5">
            <button
              type="button"
              aria-label="Edit booking"
              className="rounded p-0.5 text-current/70 hover:bg-black/10 hover:text-current"
              onClick={(e) => {
                e.stopPropagation();
                setEditOpen(true);
              }}
            >
              <Pencil className="size-3" />
            </button>
            <button
              type="button"
              aria-label="Delete booking"
              disabled={deleting}
              className="rounded p-0.5 text-current/70 hover:bg-red-500/15 hover:text-red-700 disabled:opacity-40"
              onClick={(e) => {
                e.stopPropagation();
                void handleDelete();
              }}
            >
              <Trash2 className="size-3" />
            </button>
          </div>
        ) : null}
      </div>
      {showActions ? (
        <ScheduleFormDialog
          venues={venues}
          delegations={delegations}
          schedule={s}
          open={editOpen}
          onOpenChange={setEditOpen}
        />
      ) : null}
    </>
  );
}
