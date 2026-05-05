"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CalendarOff } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toggleGarbageCollected } from "@/lib/actions/garbage";
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

  // Group rows by ISO day-of-week (1..7) projected onto Manila.
  const byDay = useMemo(() => {
    const map = new Map<number, GarbageRow[]>();
    for (const d of ISO_DAYS) map.set(d, []);
    for (const row of collections) {
      const dow = manilaIsoDayOfWeek(row.scheduled_at);
      map.get(dow)?.push(row);
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
    }
    return map;
  }, [collections]);

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

  return (
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
                  const collected = isCollected(row);
                  const collector = row.collector_id
                    ? collectorMap.get(row.collector_id)
                    : undefined;
                  const collectorLabel =
                    collector?.coordinator_name ?? row.collector_name ?? "—";
                  const vehicle = collector?.vehicle_description;
                  return (
                    <li
                      key={row.id}
                      className={cn(
                        "flex items-start gap-3 px-3 py-2.5 text-sm",
                        collected && "bg-green-50/50",
                      )}
                    >
                      <Checkbox
                        checked={collected}
                        disabled={!canLog || pending}
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
                              collected &&
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
                        </div>
                        <div className="truncate text-xs text-muted-foreground">
                          {collectorLabel}
                          {vehicle ? ` · ${vehicle}` : ""}
                        </div>
                        {row.collected_at && collected ? (
                          <div className="text-xs text-green-700">
                            Collected{" "}
                            {formatManila(row.collected_at, "MMM d · HH:mm")}
                          </div>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
