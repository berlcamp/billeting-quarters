"use client";

import { useMemo } from "react";
import { AlertTriangle, Thermometer } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  HEAT_DANGER_BADGE,
  HEAT_DANGER_LABELS,
  type HeatDangerLevel,
} from "@/lib/heat-index";
import { formatManila } from "@/lib/timezone";
import type { Database } from "@/types/database";

type Reading = Database["palaro"]["Tables"]["heat_index_readings"]["Row"];
type Site = Pick<
  Database["palaro"]["Tables"]["sites"]["Row"],
  "id" | "name" | "site_type"
>;

interface Props {
  readings: Reading[];
  sites: Site[];
}

export function SiteStatusGrid({ readings, sites }: Props) {
  const playingVenues = useMemo(
    () => sites.filter((s) => s.site_type === "playing_venue"),
    [sites],
  );
  const latestBySite = useMemo(() => {
    const map = new Map<string, Reading>();
    for (const r of readings) map.set(r.site_id, r);
    return map;
  }, [readings]);

  if (playingVenues.length === 0) {
    return (
      <div className="rounded-md border border-dashed p-12 text-center text-sm text-muted-foreground">
        No playing venues configured yet. Add venues in Admin → Sites.
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {playingVenues.map((site) => {
        const r = latestBySite.get(site.id);
        const level = (r?.danger_level as HeatDangerLevel | null) ?? null;
        return (
          <Card key={site.id} size="sm">
            <CardContent className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold">{site.name}</div>
                  <div className="text-xs text-muted-foreground">
                    Playing venue
                  </div>
                </div>
                {level ? (
                  <span
                    className={cn(
                      "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider",
                      HEAT_DANGER_BADGE[level],
                    )}
                  >
                    {HEAT_DANGER_LABELS[level]}
                  </span>
                ) : (
                  <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                    No data
                  </span>
                )}
              </div>

              {r ? (
                <>
                  <div className="flex items-baseline gap-2">
                    <Thermometer className="size-4 shrink-0 text-muted-foreground" />
                    <span className="text-2xl font-bold tracking-tight">
                      {r.heat_index_c?.toFixed(1) ?? "—"}
                      <span className="ml-1 text-sm font-normal text-muted-foreground">
                        °C HI
                      </span>
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {Number(r.temperature_c).toFixed(1)}°C ·{" "}
                    {Number(r.humidity_percent).toFixed(0)}% RH ·{" "}
                    {formatManila(r.recorded_at, "MMM d, HH:mm")}
                  </div>
                  {r.game_suspension_recommended ? (
                    <div className="flex items-center gap-1.5 rounded-md bg-red-50 px-2 py-1 text-xs font-medium text-red-700 dark:bg-red-950/40 dark:text-red-300">
                      <AlertTriangle className="size-3.5" />
                      Game suspension recommended
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="text-xs text-muted-foreground">
                  No readings recorded.
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
