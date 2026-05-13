"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ClipboardList,
  Crown,
  MessageSquareWarning,
  Moon,
  Pill,
  Thermometer,
  Trash2,
  Truck,
  UsersRound,
  UtensilsCrossed,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  INCIDENT_CATEGORIES,
  INCIDENT_CATEGORY_LABELS,
  type IncidentCategory,
} from "@/lib/labels";
import { formatManila } from "@/lib/timezone";
import { cn } from "@/lib/utils";
import type { DashboardSnapshot } from "@/lib/actions/dashboard";
import type { Database } from "@/types/database";

type Site = Pick<Database["palaro"]["Tables"]["sites"]["Row"], "id" | "name">;
type Vip = Pick<
  Database["palaro"]["Tables"]["vip_persons"]["Row"],
  "id" | "full_name"
>;

interface Props {
  snapshot: DashboardSnapshot;
  sites: Site[];
  vips: Vip[];
}

const CATEGORY_ICON: Record<IncidentCategory, React.ComponentType<{ className?: string }>> = {
  medical: Pill,
  utility: AlertTriangle,
  vip_status: Crown,
  security: AlertTriangle,
  facility: Trash2,
  other: MessageSquareWarning,
};

export function DashboardExtras({ snapshot, sites, vips }: Props) {
  const siteName = new Map(sites.map((s) => [s.id, s.name]));
  const vipName = new Map(vips.map((v) => [v.id, v.full_name]));

  return (
    <div className="space-y-6">
      {/* Incidents by category */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Incidents by category</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {INCIDENT_CATEGORIES.map((c) => {
              const Icon = CATEGORY_ICON[c];
              const count = snapshot.incidentsByCategory[c] ?? 0;
              return (
                <Link
                  key={c}
                  href={`/dashboard/incidents?category=${c}`}
                  className={cn(
                    "rounded-md border p-3 transition hover:bg-muted/40",
                    count > 0 && "border-foreground/30",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <Icon className="size-4 text-muted-foreground" />
                    <span className="text-2xl font-bold tabular-nums">
                      {count}
                    </span>
                  </div>
                  <div className="mt-1 text-xs font-medium">
                    {INCIDENT_CATEGORY_LABELS[c]}
                  </div>
                </Link>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Clinic patients served */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base inline-flex items-center gap-2">
              <Pill className="size-4 text-muted-foreground" />
              Clinic patients served
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-md border p-3">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">
                  Today
                </div>
                <div className="mt-1 text-3xl font-bold tabular-nums">
                  {snapshot.clinicPatientsToday}
                </div>
              </div>
              <div className="rounded-md border p-3">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">
                  All-time
                </div>
                <div className="mt-1 text-3xl font-bold tabular-nums">
                  {snapshot.clinicPatientsTotal}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Heat index — band + suspension */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base inline-flex items-center gap-2">
              <Thermometer className="size-4 text-muted-foreground" />
              Heat index per site
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {snapshot.latestHeatReadings.length === 0 ? (
              <p className="text-sm text-muted-foreground">No readings yet.</p>
            ) : (
              snapshot.latestHeatReadings.slice(0, 6).map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium">
                      {siteName.get(r.site_id) ?? "Unknown site"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatManila(r.recorded_at, "MMM d · HH:mm")}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-semibold uppercase",
                        bandColor(r.danger_level),
                      )}
                    >
                      {r.danger_level}
                    </span>
                    <span className="font-mono tabular-nums text-sm">
                      {r.heat_index_c?.toFixed(1)}°C
                    </span>
                    {r.game_suspension_recommended ? (
                      <Badge variant="destructive">SUSPEND</Badge>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* VIP recent movements */}
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base inline-flex items-center gap-2">
              <Crown className="size-4 text-muted-foreground" />
              VIP latest logs
            </CardTitle>
            <Link href="/dashboard/vip" className="text-xs underline">
              View all
            </Link>
          </CardHeader>
          <CardContent className="space-y-2">
            {snapshot.recentVipMovements.length === 0 ? (
              <p className="text-sm text-muted-foreground">No movements yet.</p>
            ) : (
              snapshot.recentVipMovements.slice(0, 15).map((m) => (
                <Link
                  key={m.id}
                  href={`/dashboard/vip?vip=${m.vip_id}`}
                  className="flex items-start justify-between gap-3 rounded-md border px-3 py-2 text-sm hover:bg-muted/40"
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium">
                      {vipName.get(m.vip_id) ?? "Unknown VIP"}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {m.destination_site_id
                        ? siteName.get(m.destination_site_id)
                        : null}{" "}
                      · {formatManila(m.updated_at, "MMM d · HH:mm")}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Badge variant="outline" className="capitalize">
                      {m.status.replace(/_/g, " ")}
                    </Badge>
                    {m.request && m.request.trim().length > 0 ? (
                      <Badge variant="default">Request</Badge>
                    ) : null}
                  </div>
                </Link>
              ))
            )}
          </CardContent>
        </Card>

        {/* Today's venue schedules */}
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Today&apos;s venue schedules</CardTitle>
            <Link href="/dashboard/venues" className="text-xs underline">
              Venues
            </Link>
          </CardHeader>
          <CardContent className="space-y-2">
            {snapshot.venueSchedulesToday.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No schedules for today.
              </p>
            ) : (
              snapshot.venueSchedulesToday.slice(0, 10).map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                >
                  <div className="min-w-0">
                    <div className="truncate font-medium">
                      {siteName.get(s.venue_id) ?? "Venue"}
                    </div>
                    <div className="truncate text-xs text-muted-foreground">
                      {s.sport ?? "—"} ·{" "}
                      {formatManila(s.scheduled_start, "HH:mm")}–
                      {formatManila(s.scheduled_end, "HH:mm")}
                    </div>
                  </div>
                  <Badge variant="outline" className="capitalize">
                    {s.status.replace(/_/g, " ")}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Garbage today */}
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base inline-flex items-center gap-2">
              <Trash2 className="size-4 text-muted-foreground" />
              Garbage — today
            </CardTitle>
            <Link
              href="/dashboard/logistics/garbage"
              className="text-xs underline"
            >
              View
            </Link>
          </CardHeader>
          <CardContent>
            <GarbageSummary
              today={snapshot.garbageToday}
              siteName={siteName}
            />
          </CardContent>
        </Card>

        {/* Food requests today */}
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base inline-flex items-center gap-2">
              <UtensilsCrossed className="size-4 text-muted-foreground" />
              Food requests — today
            </CardTitle>
            <Link
              href="/dashboard/logistics/food"
              className="text-xs underline"
            >
              View
            </Link>
          </CardHeader>
          <CardContent>
            <FoodSummary
              today={snapshot.foodRequestsToday}
              siteName={siteName}
            />
          </CardContent>
        </Card>
      </div>

      {/* Site monitoring — today */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base inline-flex items-center gap-2">
            <ClipboardList className="size-4 text-muted-foreground" />
            Site monitoring — today
          </CardTitle>
          <Link
            href="/dashboard/site-monitoring"
            className="text-xs underline"
          >
            View
          </Link>
        </CardHeader>
        <CardContent>
          <SiteMonitoringSummary
            visits={snapshot.siteVisitsToday}
            externals={snapshot.externalPersonnelToday}
            eod={snapshot.endOfDayReportsToday}
            siteName={siteName}
          />
        </CardContent>
      </Card>

      {/* Transportation pointer */}
      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base inline-flex items-center gap-2">
            <Truck className="size-4 text-muted-foreground" />
            Transportation
          </CardTitle>
          <Link href="/dashboard/transportation" className="text-xs underline">
            Open module
          </Link>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Live vehicle dispatches, fuel logs, and arrivals.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function SiteMonitoringSummary({
  visits,
  externals,
  eod,
  siteName,
}: {
  visits: Database["palaro"]["Tables"]["site_monitoring_visits"]["Row"][];
  externals: Database["palaro"]["Tables"]["external_personnel_logs"]["Row"][];
  eod: Database["palaro"]["Tables"]["end_of_day_reports"]["Row"][];
  siteName: Map<string, string>;
}) {
  const accountedFor = eod.filter((r) => r.all_accounted_for).length;
  const outsideFlagged = eod.filter((r) => !r.all_accounted_for).length;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Visits" value={visits.length} />
        <Stat label="External personnel" value={externals.length} />
        <Stat label="EOD reports" value={eod.length} />
        <Stat
          label="EOD: outside"
          value={outsideFlagged}
          accent={outsideFlagged > 0}
        />
      </div>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        <div>
          <div className="mb-1 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <ClipboardList className="size-3.5" />
            Recent visits
          </div>
          {visits.length === 0 ? (
            <p className="text-xs text-muted-foreground">No visits today.</p>
          ) : (
            <ul className="max-h-40 space-y-1 overflow-y-auto text-xs">
              {visits.slice(0, 6).map((v) => (
                <li
                  key={v.id}
                  className="flex items-center justify-between rounded border px-2 py-1"
                >
                  <span className="min-w-0 truncate">
                    <span className="font-medium">{v.visit_title}</span>
                    <span className="text-muted-foreground">
                      {" · "}
                      {siteName.get(v.site_id) ?? "—"}
                    </span>
                  </span>
                  <span className="ml-2 shrink-0 text-muted-foreground">
                    {formatManila(v.visited_at, "HH:mm")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <div className="mb-1 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <UsersRound className="size-3.5" />
            External personnel
          </div>
          {externals.length === 0 ? (
            <p className="text-xs text-muted-foreground">None today.</p>
          ) : (
            <ul className="max-h-40 space-y-1 overflow-y-auto text-xs">
              {externals.slice(0, 6).map((p) => (
                <li
                  key={p.id}
                  className="flex items-center justify-between rounded border px-2 py-1"
                >
                  <span className="min-w-0 truncate">
                    <span className="font-medium">{p.full_name}</span>
                    <span className="text-muted-foreground">
                      {" · "}
                      {p.position}
                    </span>
                  </span>
                  <Badge variant="outline" className="ml-2 shrink-0 capitalize">
                    {p.status.replace(/_/g, " ")}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <div className="mb-1 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Moon className="size-3.5" />
            EOD reports
          </div>
          {eod.length === 0 ? (
            <p className="text-xs text-muted-foreground">None filed today.</p>
          ) : (
            <ul className="max-h-40 space-y-1 overflow-y-auto text-xs">
              {eod.slice(0, 6).map((r) => (
                <li
                  key={r.id}
                  className="flex items-center justify-between rounded border px-2 py-1"
                >
                  <span className="min-w-0 truncate">
                    {siteName.get(r.site_id) ?? "—"}
                  </span>
                  {r.all_accounted_for ? (
                    <Badge
                      variant="outline"
                      className="ml-2 shrink-0 border-emerald-500/40 text-emerald-700 dark:text-emerald-400"
                    >
                      All in
                    </Badge>
                  ) : (
                    <Badge variant="destructive" className="ml-2 shrink-0">
                      Outside
                    </Badge>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
        Accounted for: {accountedFor} / {eod.length}
      </div>
    </div>
  );
}

function bandColor(level: string | null): string {
  switch (level) {
    case "extreme_danger":
      return "bg-red-600 text-white";
    case "danger":
      return "bg-red-500 text-white";
    case "extreme_caution":
      return "bg-orange-500 text-white";
    case "caution":
      return "bg-yellow-500 text-foreground";
    case "safe":
    default:
      return "bg-emerald-500 text-white";
  }
}

function GarbageSummary({
  today,
  siteName,
}: {
  today: Database["palaro"]["Tables"]["garbage_collections"]["Row"][];
  siteName: Map<string, string>;
}) {
  const requests = today.filter((r) => r.status === "special_request").length;
  // "no_collection_needed" is added by migration 21; cast guards the build
  // until `npm run gen:types` is rerun.
  const noNeed = today.filter(
    (r) => (r.status as string) === "no_collection_needed",
  ).length;
  const collected = today.filter((r) => r.status === "collected").length;
  const notCollected = today.filter(
    (r) => r.status === "scheduled" || r.status === "missed",
  ).length;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Requests" value={requests} />
        <Stat label="No need" value={noNeed} />
        <Stat label="Collected" value={collected} />
        <Stat label="Not collected" value={notCollected} accent={notCollected > 0} />
      </div>
      {today.length > 0 ? (
        <ul className="max-h-40 space-y-1 overflow-y-auto text-xs">
          {today.slice(0, 12).map((r) => (
            <li
              key={r.id}
              className="flex items-center justify-between rounded border px-2 py-1"
            >
              <span className="truncate">{siteName.get(r.site_id) ?? "—"}</span>
              <span className="ml-2 shrink-0 capitalize text-muted-foreground">
                {r.status.replace(/_/g, " ")}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function FoodSummary({
  today,
  siteName,
}: {
  today: Database["palaro"]["Tables"]["food_requests"]["Row"][];
  siteName: Map<string, string>;
}) {
  const pending = today.filter((r) => r.status === "pending").length;
  const confirmed = today.filter((r) => r.status === "confirmed").length;
  const delivered = today.filter((r) => r.status === "delivered").length;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Pending" value={pending} accent={pending > 0} />
        <Stat label="Confirmed" value={confirmed} />
        <Stat label="Delivered" value={delivered} />
      </div>
      {today.length > 0 ? (
        <ul className="max-h-40 space-y-1 overflow-y-auto text-xs">
          {today.slice(0, 12).map((r) => (
            <li
              key={r.id}
              className="flex items-center justify-between rounded border px-2 py-1"
            >
              <span className="truncate">
                {siteName.get(r.bq_id) ?? "—"} · {r.item_name}
              </span>
              <span className="ml-2 shrink-0 text-muted-foreground">
                {r.quantity} {r.unit}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div className="rounded-md border p-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div
        className={cn(
          "mt-0.5 text-2xl font-bold tabular-nums",
          accent && "text-yellow-600",
        )}
      >
        {value}
      </div>
    </div>
  );
}
