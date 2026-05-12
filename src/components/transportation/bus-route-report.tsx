"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
  getBusRouteReport,
  type BusRouteReportRow,
} from "@/lib/actions/vehicles";
import { formatManila } from "@/lib/timezone";
import type { Database } from "@/types/database";

type Vehicle = Pick<
  Database["palaro"]["Tables"]["vehicles"]["Row"],
  "id" | "vehicle_code"
>;
type Site = Pick<
  Database["palaro"]["Tables"]["sites"]["Row"],
  "id" | "name"
>;

interface Props {
  initial: BusRouteReportRow[];
  vehicles: Vehicle[];
  sites: Site[];
}

const ALL_VEHICLES = "__all__";

export function BusRouteReport({ initial, vehicles, sites }: Props) {
  const [rows, setRows] = useState(initial);
  const [vehicleId, setVehicleId] = useState<string>(ALL_VEHICLES);
  const [since, setSince] = useState("");
  const [until, setUntil] = useState("");
  const [isPending, startTransition] = useTransition();

  const sitesById = useMemo(
    () => new Map(sites.map((s) => [s.id, s])),
    [sites],
  );

  function applyFilters() {
    startTransition(async () => {
      const res = await getBusRouteReport({
        vehicle_id: vehicleId === ALL_VEHICLES ? undefined : vehicleId,
        since: since ? new Date(since).toISOString() : undefined,
        until: until ? new Date(until).toISOString() : undefined,
        limit: 300,
      });
      if (res.error) return;
      setRows(res.data ?? []);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bus route report</CardTitle>
        <CardDescription>
          Per-vehicle travel history: every leg with departure and arrival
          timestamps.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
          <div>
            <Label className="text-xs">Vehicle</Label>
            <Select
              value={vehicleId}
              onValueChange={(v) => setVehicleId(v ?? ALL_VEHICLES)}
            >
              <SelectTrigger className="h-9 w-full">
                <SelectValue>
                  {(v: string | null) => {
                    if (!v || v === ALL_VEHICLES) return "All vehicles";
                    return (
                      vehicles.find((x) => x.id === v)?.vehicle_code ?? v
                    );
                  }}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_VEHICLES}>All vehicles</SelectItem>
                {vehicles.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.vehicle_code}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">From</Label>
            <Input
              type="datetime-local"
              value={since}
              onChange={(e) => setSince(e.target.value)}
            />
          </div>
          <div>
            <Label className="text-xs">To</Label>
            <Input
              type="datetime-local"
              value={until}
              onChange={(e) => setUntil(e.target.value)}
            />
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
              <TableHead>Leg</TableHead>
              <TableHead>From → To</TableHead>
              <TableHead>Departed</TableHead>
              <TableHead>Arrived</TableHead>
              <TableHead className="text-right">Pax</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground">
                  No legs match the current filters.
                </TableCell>
              </TableRow>
            ) : null}
            {rows.map((r) => {
              const from = r.from_site_id
                ? sitesById.get(r.from_site_id)?.name ?? r.from_label
                : r.from_label;
              const to = r.to_site_id
                ? sitesById.get(r.to_site_id)?.name ?? r.to_label
                : r.to_label;
              return (
                <TableRow key={r.leg_id}>
                  <TableCell className="font-medium">
                    <Link
                      href={`/dashboard/transportation/trips/${r.dispatch_id}`}
                      className="hover:underline"
                    >
                      {r.vehicle_code}
                    </Link>
                  </TableCell>
                  <TableCell>#{r.leg_order}</TableCell>
                  <TableCell className="text-sm">
                    {from ?? "—"} <ArrowRight className="mx-1 inline size-3" />{" "}
                    {to ?? "—"}
                  </TableCell>
                  <TableCell className="text-xs">
                    {formatManila(r.departed_at)}
                  </TableCell>
                  <TableCell className="text-xs">
                    {r.arrived_at ? formatManila(r.arrived_at) : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    {r.passenger_count}
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
