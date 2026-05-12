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
  const vehicleMap = useMemo(
    () => new Map(vehicles.map((v) => [v.id, v.vehicle_code])),
    [vehicles],
  );
  const siteMap = useMemo(
    () => new Map(sites.map((s) => [s.id, s.name])),
    [sites],
  );
  const delegationMap = useMemo(
    () => new Map(delegations.map((d) => [d.id, d.region_code])),
    [delegations],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="size-4 text-amber-600" />
          Trips closed with passengers on board
        </CardTitle>
        <CardDescription>
          Force-closed trips where one or more groups never got dropped off.
          Investigate each — they usually indicate a missed scan or an
          incomplete transfer.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <EmptyState
            title="No discrepancies"
            description="Every closed trip dropped off all manifest groups."
          />
        ) : (
          <ul className="divide-y rounded-md border">
            {rows.map((row) => (
              <li
                key={row.manifest_id}
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
                    <span className="text-xs text-muted-foreground">
                      {row.team_name}
                    </span>
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
                  {row.force_closed_reason ? (
                    <p className="mt-0.5 text-xs text-destructive">
                      Reason: {row.force_closed_reason}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="font-mono text-xs text-muted-foreground">
                    {row.total_passengers - row.remaining} / {row.total_passengers}
                  </span>
                  <Badge
                    variant="secondary"
                    className="border-transparent bg-amber-100 text-amber-800"
                  >
                    {row.remaining} unaccounted
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
