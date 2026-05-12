"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, CalendarOff, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  markGarbageCancelled,
  toggleGarbageCollected,
  unmarkGarbageCancelled,
} from "@/lib/actions/garbage";
import {
  DAY_OF_WEEK_LABELS,
  ISO_DAYS,
  addDaysYmd,
  manilaIsoDayOfWeek,
} from "@/lib/garbage-week";
import { formatManila } from "@/lib/timezone";
import { cn } from "@/lib/utils";
import type { Database } from "@/types/database";

type GarbageRow = Database["palaro"]["Tables"]["garbage_collections"]["Row"];
type Collector = Database["palaro"]["Tables"]["garbage_collectors"]["Row"];
type Site = Pick<
  Database["palaro"]["Tables"]["sites"]["Row"],
  "id" | "name" | "site_type"
>;

interface Props {
  weekStart: string; // Manila Mon, YYYY-MM-DD
  collections: GarbageRow[];
  collectors: Collector[];
  sites: Site[];
  canLog: boolean;
}

const ALL_SITES = "__all__";

export function WeeklySchedule({
  weekStart,
  collections,
  collectors,
  sites,
  canLog,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // Optimistic ticked-off set: ids whose checkbox the user just flipped.
  // Cleared on each refresh because the prop list refreshes too.
  const [optimistic, setOptimistic] = useState<Map<string, boolean>>(
    () => new Map(),
  );
  const [siteFilter, setSiteFilter] = useState<string>(ALL_SITES);

  const collectorMap = useMemo(() => {
    const m = new Map<string, Collector>();
    for (const c of collectors) m.set(c.id, c);
    return m;
  }, [collectors]);

  const siteMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of sites) m.set(s.id, s.name);
    return m;
  }, [sites]);

  const filteredCollections = useMemo(() => {
    if (siteFilter === ALL_SITES) return collections;
    return collections.filter((r) => r.site_id === siteFilter);
  }, [collections, siteFilter]);

  // Sites that actually have pickups this week — surfaced first in the
  // filter dropdown so the common picks are easy to find. The full site
  // list still appears below in case the user wants to confirm a site
  // has zero pickups.
  const siteIdsInWeek = useMemo(() => {
    const set = new Set<string>();
    for (const r of collections) set.add(r.site_id);
    return set;
  }, [collections]);

  const sortedSites = useMemo(
    () => [...sites].sort((a, b) => a.name.localeCompare(b.name)),
    [sites],
  );

  // Group rows by ISO day-of-week (1..7) projected onto Manila.
  const byDay = useMemo(() => {
    const map = new Map<number, GarbageRow[]>();
    for (const d of ISO_DAYS) map.set(d, []);
    for (const row of filteredCollections) {
      const dow = manilaIsoDayOfWeek(row.scheduled_at);
      map.get(dow)?.push(row);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
    }
    return map;
  }, [filteredCollections]);

  function isCollected(row: GarbageRow): boolean {
    const opt = optimistic.get(row.id);
    if (typeof opt === "boolean") return opt;
    return row.status === "collected";
  }

  async function handleToggle(row: GarbageRow, next: boolean) {
    if (!canLog) return;
    setOptimistic((prev) => {
      const m = new Map(prev);
      m.set(row.id, next);
      return m;
    });
    startTransition(async () => {
      const result = await toggleGarbageCollected({ id: row.id, collected: next });
      if (result.error) {
        toast.error("Update failed", { description: result.error });
        // Revert on failure.
        setOptimistic((prev) => {
          const m = new Map(prev);
          m.delete(row.id);
          return m;
        });
        return;
      }
      router.refresh();
    });
  }

  async function handleCancel(row: GarbageRow) {
    if (!canLog) return;
    startTransition(async () => {
      const result = await markGarbageCancelled({ id: row.id });
      if (result.error) {
        toast.error("Cancel failed", { description: result.error });
        return;
      }
      toast.success("Pickup cancelled", {
        description: `${siteMap.get(row.site_id) ?? "Pickup"} · ${formatManila(row.scheduled_at, "MMM d HH:mm")}`,
      });
      router.refresh();
    });
  }

  async function handleUndoCancel(row: GarbageRow) {
    if (!canLog) return;
    startTransition(async () => {
      const result = await unmarkGarbageCancelled({ id: row.id });
      if (result.error) {
        toast.error("Undo failed", { description: result.error });
        return;
      }
      toast.success("Pickup restored");
      router.refresh();
    });
  }

  const filteredCount = filteredCollections.length;
  const totalCount = collections.length;
  const isFiltered = siteFilter !== ALL_SITES;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">
            Filter by site
          </span>
          <Select
            value={siteFilter}
            onValueChange={(v) => setSiteFilter(v ?? ALL_SITES)}
          >
            <SelectTrigger className="h-9 w-[260px]">
              <SelectValue>
                {(v: string | null) => {
                  if (!v || v === ALL_SITES) return "All sites";
                  return (
                    sortedSites.find((s) => s.id === v)?.name ?? "Unknown site"
                  );
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_SITES}>All sites</SelectItem>
              {sortedSites.map((s) => {
                const active = siteIdsInWeek.has(s.id);
                return (
                  <SelectItem key={s.id} value={s.id}>
                    <span className={cn(!active && "text-muted-foreground")}>
                      {s.name}
                      {!active ? " · no pickups this week" : ""}
                    </span>
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
        {isFiltered ? (
          <span className="text-xs text-muted-foreground">
            Showing {filteredCount} of {totalCount} pickups
          </span>
        ) : null}
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {ISO_DAYS.map((dow) => {
        const dayYmd = addDaysYmd(weekStart, dow - 1);
        const rows = byDay.get(dow) ?? [];
        return (
          <div
            key={dow}
            className="overflow-hidden rounded-md border bg-card"
          >
            <div className="flex items-baseline justify-between gap-2 border-b bg-muted/40 px-3 py-2">
              <div>
                <div className="text-sm font-semibold">
                  {DAY_OF_WEEK_LABELS[dow]}
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatManila(`${dayYmd}T04:00:00.000Z`, "MMM d, yyyy")}
                </div>
              </div>
              <Badge
                variant="secondary"
                className="border-transparent text-xs"
              >
                {rows.length} pickup{rows.length === 1 ? "" : "s"}
              </Badge>
            </div>
            {rows.length === 0 ? (
              <div className="flex items-center gap-2 px-3 py-6 text-xs text-muted-foreground">
                <CalendarOff className="size-4" />
                No pickups scheduled.
              </div>
            ) : (
              <ul className="divide-y">
                {rows.map((row) => {
                  const cancelled = row.status === "cancelled";
                  const collected = !cancelled && isCollected(row);
                  const collector = row.collector_id
                    ? collectorMap.get(row.collector_id)
                    : undefined;
                  const driver =
                    collector?.driver_name ?? row.collector_name ?? "—";
                  const swm = collector?.swm_coordinator_name;
                  const enro = collector?.city_enro_coordinator_name;
                  const vehicle = collector?.vehicle_description;
                  return (
                    <li
                      key={row.id}
                      className={cn(
                        "flex items-start gap-3 px-3 py-2.5 text-sm",
                        collected && "bg-green-50/50",
                        cancelled && "bg-muted/40",
                      )}
                    >
                      <Checkbox
                        checked={collected}
                        disabled={!canLog || pending || cancelled}
                        onCheckedChange={(v) => handleToggle(row, v === true)}
                        aria-label={
                          collected
                            ? "Mark as not collected"
                            : "Mark as collected"
                        }
                        className="mt-0.5"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs">
                            {formatManila(row.scheduled_at, "HH:mm")}
                          </span>
                          <span
                            className={cn(
                              "truncate font-medium",
                              (collected || cancelled) &&
                                "text-muted-foreground line-through decoration-1",
                            )}
                          >
                            {siteMap.get(row.site_id) ?? "—"}
                          </span>
                          {row.is_special_request ? (
                            <Badge
                              variant="secondary"
                              className="border-transparent bg-yellow-100 text-yellow-800"
                            >
                              Special
                            </Badge>
                          ) : null}
                          {cancelled ? (
                            <Badge
                              variant="secondary"
                              className="border-transparent bg-red-100 text-red-800"
                            >
                              Cancelled
                            </Badge>
                          ) : null}
                        </div>
                        <div className="truncate text-xs text-muted-foreground">
                          Driver: {driver}
                          {swm ? ` · SWM: ${swm}` : ""}
                          {enro ? ` · ENRO: ${enro}` : ""}
                          {vehicle ? ` · ${vehicle}` : ""}
                        </div>
                        {row.collected_at && collected ? (
                          <div className="text-xs text-green-700">
                            Collected{" "}
                            {formatManila(row.collected_at, "MMM d · HH:mm")}
                          </div>
                        ) : null}
                      </div>
                      {canLog && !collected ? (
                        cancelled ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            disabled={pending}
                            onClick={() => handleUndoCancel(row)}
                            aria-label="Undo cancellation"
                            title="Undo cancellation"
                          >
                            <Undo2 className="size-4" />
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            disabled={pending}
                            onClick={() => handleCancel(row)}
                            aria-label="Cancel this pickup"
                            title="Cancel this pickup"
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <Ban className="size-4" />
                          </Button>
                        )
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
      </div>
    </div>
  );
}
