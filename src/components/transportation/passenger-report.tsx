"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  getPassengerReport,
  type PassengerReportRow,
} from "@/lib/actions/vehicles";
import { formatManila } from "@/lib/timezone";
import type { Database } from "@/types/database";

type Delegation = Pick<
  Database["palaro"]["Tables"]["delegations"]["Row"],
  "id" | "region_code" | "region_name"
>;

interface Props {
  initial: PassengerReportRow[];
  delegations: Delegation[];
}

const ALL_DELEGATIONS = "__all__";

export function PassengerReport({ initial, delegations }: Props) {
  const [rows, setRows] = useState(initial);
  const [delegationId, setDelegationId] = useState<string>(ALL_DELEGATIONS);
  const [isPending, startTransition] = useTransition();

  const delegationsById = useMemo(
    () => new Map(delegations.map((d) => [d.id, d])),
    [delegations],
  );

  function applyFilters() {
    startTransition(async () => {
      const res = await getPassengerReport({
        delegation_id:
          delegationId === ALL_DELEGATIONS ? undefined : delegationId,
        limit: 300,
      });
      if (res.error) return;
      setRows(res.data ?? []);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Passenger report</CardTitle>
        <CardDescription>
          Manifest per trip — boarding, drop-offs by leg, and remaining counts.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <Label className="text-xs">Delegation</Label>
            <Select
              value={delegationId}
              onValueChange={(v) => setDelegationId(v ?? ALL_DELEGATIONS)}
            >
              <SelectTrigger className="h-9 w-full">
                <SelectValue>
                  {(v: string | null) => {
                    if (!v || v === ALL_DELEGATIONS) return "All delegations";
                    const d = delegationsById.get(v);
                    return d ? `${d.region_code} — ${d.region_name}` : v;
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_DELEGATIONS}>All delegations</SelectItem>
                {delegations.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    {d.region_code} — {d.region_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end">
            <Button
              onClick={applyFilters}
              disabled={isPending}
              className="w-full"
            >
              {isPending ? <Loader2 className="size-4 animate-spin" /> : null}
              Apply
            </Button>
          </div>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Vehicle</TableHead>
              <TableHead>Delegation</TableHead>
              <TableHead>Team</TableHead>
              <TableHead className="text-right">Boarded</TableHead>
              <TableHead className="text-right">Dropped</TableHead>
              <TableHead className="text-right">Remaining</TableHead>
              <TableHead>Drop-offs</TableHead>
              <TableHead>Trip</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground">
                  No manifest rows match.
                </TableCell>
              </TableRow>
            ) : null}
            {rows.map((r) => {
              const delegation = r.delegation_id
                ? delegationsById.get(r.delegation_id)
                : null;
              return (
                <TableRow key={r.manifest_id}>
                  <TableCell className="font-medium">
                    <Link
                      href={`/dashboard/transportation/trips/${r.dispatch_id}`}
                      className="hover:underline"
                    >
                      {r.vehicle_code}
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm">
                    {delegation
                      ? `${delegation.region_code}`
                      : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell>{r.team_name}</TableCell>
                  <TableCell className="text-right">
                    {r.total_passengers}
                  </TableCell>
                  <TableCell className="text-right">
                    {r.dropped_off}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {r.remaining}
                  </TableCell>
                  <TableCell className="text-xs">
                    {r.dropoff_events.length === 0 ? (
                      <span className="text-muted-foreground">none</span>
                    ) : (
                      r.dropoff_events
                        .map((e) => `L${e.leg_order}: ${e.count}`)
                        .join(", ")
                    )}
                  </TableCell>
                  <TableCell className="text-xs">
                    <Badge variant="outline">
                      {r.trip_status.replace("_", " ")}
                    </Badge>
                    <p className="mt-0.5 text-muted-foreground">
                      {formatManila(r.dispatched_at)}
                    </p>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
