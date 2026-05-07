"use client";

import { useMemo } from "react";
import { AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { EmptyState } from "@/components/shared/empty-state";
import { formatManila } from "@/lib/timezone";
import { cn } from "@/lib/utils";
import type { MissingAthleteRow } from "@/lib/actions/vehicles";
import type { Database } from "@/types/database";

type Vehicle = Pick<
  Database["palaro"]["Tables"]["vehicles"]["Row"],
  "id" | "vehicle_code"
>;
type Site = Pick<
  Database["palaro"]["Tables"]["sites"]["Row"],
  "id" | "name"
>;
type Delegation = Pick<
  Database["palaro"]["Tables"]["delegations"]["Row"],
  "id" | "region_code"
>;

interface Props {
  rows: MissingAthleteRow[];
  vehicles: Vehicle[];
  sites: Site[];
  delegations: Delegation[];
}

export function MissingAthleteCard({
  rows,
  vehicles,
  sites,
  delegations,
}: Props) {
  const vehicleMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const v of vehicles) m.set(v.id, v.vehicle_code);
    return m;
  }, [vehicles]);
  const siteMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of sites) m.set(s.id, s.name);
    return m;
  }, [sites]);
  const delegationMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const d of delegations) m.set(d.id, d.region_code);
    return m;
  }, [delegations]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="size-4 text-amber-600" />
          Missing-athlete report
        </CardTitle>
        <CardDescription>
          Dispatches where the boarded count and the destination scan don&apos;t
          match. Investigate any negative diff (e.g. 10 boarded, 9 arrived).
        </CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <EmptyState
            title="No discrepancies"
            description="All dispatches matched their boarded headcount."
          />
        ) : (
          <ul className="divide-y rounded-md border">
            {rows.map((row) => (
              <li
                key={row.dispatch_id}
                className="flex items-center gap-3 p-3 text-sm"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono font-semibold">
                      {vehicleMap.get(row.vehicle_id) ?? "—"}
                    </span>
                    {row.delegation_id ? (
                      <Badge variant="secondary" className="font-mono text-xs">
                        {delegationMap.get(row.delegation_id) ?? "—"}
                      </Badge>
                    ) : null}
                    {row.sport ? (
                      <span className="text-xs text-muted-foreground">
                        {row.sport}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-0.5 text-xs text-muted-foreground">
                    {row.origin_site_id
                      ? siteMap.get(row.origin_site_id) ?? "—"
                      : "—"}
                    {" → "}
                    {row.destination_site_id
                      ? siteMap.get(row.destination_site_id) ?? "—"
                      : "—"}
                    {" · "}
                    {formatManila(row.dispatched_at, "MMM d · HH:mm")}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="font-mono text-xs text-muted-foreground">
                    {row.expected_pax} → {row.arrived_pax}
                  </span>
                  <Badge
                    variant="secondary"
                    className={cn(
                      "border-transparent",
                      row.diff > 0
                        ? "bg-red-100 text-red-800"
                        : "bg-amber-100 text-amber-800",
                    )}
                  >
                    {row.diff > 0
                      ? `${row.diff} missing`
                      : `${Math.abs(row.diff)} extra`}
                  </Badge>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
