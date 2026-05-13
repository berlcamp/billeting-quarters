"use client";

import { useMemo } from "react";
import { ScheduleFormDialog } from "./schedule-form-dialog";
import { Badge } from "@/components/ui/badge";
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

  return (
    <div className="overflow-x-auto rounded-md border">
      <div
        className="grid min-w-[720px]"
        style={{
          gridTemplateColumns: `120px repeat(${HOURS.length}, minmax(48px, 1fr))`,
        }}
      >
        {/* Header row */}
        <div className="border-b bg-muted/40 px-3 py-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Venue
        </div>
        {HOURS.map((h) => (
          <div
            key={`h-${h}`}
            className="border-b border-l bg-muted/40 py-2 text-center font-mono text-xs text-muted-foreground"
          >
            {String(h).padStart(2, "0")}
          </div>
        ))}

        {/* One row per (venue, court) pair */}
        {venues.flatMap((v) => {
          const courts = courtsFor(v.id);
          return courts.map((court) => {
            const items =
              byVenueCourt.get(v.id)?.get(court) ?? [];
            return (
              <div
                key={`${v.id}-${court}`}
                className="contents"
                data-venue-id={v.id}
                data-court={court}
              >
                <div className="border-t px-3 py-3 text-sm">
                  <div className="font-medium">{v.name}</div>
                  <div className="text-xs text-muted-foreground">
                    Court {court}
                  </div>
                </div>
                <div
                  className="relative col-span-full border-t"
                  style={{
                    gridColumn: `2 / ${HOURS.length + 2}`,
                    // Re-create cell separators with a layered background.
                    backgroundImage: `repeating-linear-gradient(
                      to right,
                      transparent 0,
                      transparent calc(100% / ${HOURS.length} - 1px),
                      var(--border) calc(100% / ${HOURS.length} - 1px),
                      var(--border) calc(100% / ${HOURS.length})
                    )`,
                    minHeight: "64px",
                  }}
                >
                  {/* Existing bookings on this court */}
                  {items.map((s) => {
                    const start = toManilaHm(s.scheduled_start);
                    const end = toManilaHm(s.scheduled_end);
                    const startMins = start.h * 60 + start.m;
                    const endMins = end.h * 60 + end.m;
                    const gridStartMins = HOUR_START * 60;
                    const gridEndMins = (HOUR_END + 1) * 60;
                    const totalMins = gridEndMins - gridStartMins;
                    const left = Math.max(
                      0,
                      ((startMins - gridStartMins) / totalMins) * 100,
                    );
                    const width = Math.min(
                      100 - left,
                      ((endMins - Math.max(startMins, gridStartMins)) /
                        totalMins) *
                        100,
                    );
                    if (width <= 0) return null;
                    const status = s.status as ScheduleStatus;
                    const del = delMap.get(s.delegation_id);
                    const cancelled = status === "cancelled";

                    const inner = (
                      <div
                        className={cn(
                          "group absolute top-1 bottom-1 overflow-hidden rounded-md border px-2 py-1 text-xs shadow-sm transition",
                          cancelled
                            ? "border-gray-300 bg-gray-100/80 text-gray-600 line-through"
                            : status === "special_request"
                              ? "border-yellow-300 bg-yellow-50 text-yellow-900"
                              : status === "completed"
                                ? "border-green-300 bg-green-50 text-green-900"
                                : "border-blue-300 bg-blue-50 text-blue-900",
                          canBook && !cancelled
                            ? "cursor-pointer hover:brightness-95"
                            : "",
                        )}
                        style={{ left: `${left}%`, width: `${width}%` }}
                        title={`${del?.region_code ?? ""} ${s.sport ?? ""} · Court ${court} · ${SCHEDULE_STATUS_LABELS[status]}`}
                      >
                        <div className="flex items-center gap-1 font-semibold">
                          {del?.region_code ?? "—"}
                        </div>
                        {s.sport ? (
                          <div className="truncate text-[10px] opacity-80">
                            {s.sport}
                          </div>
                        ) : null}
                      </div>
                    );

                    return canBook && !cancelled ? (
                      <ScheduleFormDialog
                        key={s.id}
                        venues={venues}
                        delegations={delegations}
                        schedule={s}
                        trigger={inner}
                      />
                    ) : (
                      <div key={s.id}>{inner}</div>
                    );
                  })}

                  {/* Click-to-book hour cells */}
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
                </div>
              </div>
            );
          });
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
