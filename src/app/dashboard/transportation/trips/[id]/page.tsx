import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Clock,
  Truck,
  Users,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Forbidden } from "@/components/shared/forbidden";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CloseTripButton } from "@/components/transportation/close-trip-button";
import { getTripDetail } from "@/lib/actions/vehicles";
import { getSites } from "@/lib/actions/sites";
import { getDelegations } from "@/lib/actions/delegations";
import { getCurrentProfile } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions";
import { formatManila } from "@/lib/timezone";

interface PageProps {
  params: Promise<{ id: string }>;
}

const STATUS_VARIANTS: Record<
  "scheduled" | "in_transit" | "completed" | "cancelled",
  "default" | "secondary" | "destructive" | "outline"
> = {
  scheduled: "secondary",
  in_transit: "default",
  completed: "outline",
  cancelled: "destructive",
};

export default async function TripDetailPage({ params }: PageProps) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  const canView =
    !!profile &&
    (hasPermission(profile, "vehicle.scan") ||
      hasPermission(profile, "vehicle.manage") ||
      hasPermission(profile, "vehicle.dispatch"));
  if (!canView) {
    return <Forbidden message="Transportation requires vehicle.* permission." />;
  }
  const canManage = !!profile && hasPermission(profile, "vehicle.manage");

  const [tripRes, sitesRes, delegationsRes] = await Promise.all([
    getTripDetail(id),
    getSites(false),
    getDelegations(false),
  ]);
  if (tripRes.error || !tripRes.data) notFound();
  const trip = tripRes.data;
  const sites = sitesRes.error ? [] : (sitesRes.data ?? []);
  const delegations = delegationsRes.error ? [] : (delegationsRes.data ?? []);

  const sitesById = new Map(sites.map((s) => [s.id, s]));
  const delegationsById = new Map(delegations.map((d) => [d.id, d]));

  const totalPax = trip.manifest.reduce(
    (s, m) => s + m.total_passengers,
    0,
  );
  const remaining = trip.manifest.reduce(
    (s, m) => s + (m.total_passengers - m.dropped_off),
    0,
  );

  const dropoffsByLeg = new Map<string, typeof trip.dropoffs>();
  for (const d of trip.dropoffs) {
    const list = dropoffsByLeg.get(d.leg_id) ?? [];
    list.push(d);
    dropoffsByLeg.set(d.leg_id, list);
  }
  const manifestById = new Map(trip.manifest.map((m) => [m.id, m]));

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Trip · ${trip.vehicle?.vehicle_code ?? "—"}`}
        description={`Opened ${formatManila(trip.dispatch.dispatched_at)} · ${trip.legs.length} leg(s)`}
        actions={
          <div className="flex items-center gap-2">
            <Link
              href="/dashboard/transportation"
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 text-sm font-medium hover:bg-muted"
            >
              <ArrowLeft className="size-4" />
              Back
            </Link>
            {trip.dispatch.status === "in_transit" ||
            trip.dispatch.status === "scheduled" ? (
              <CloseTripButton
                dispatchId={trip.dispatch.id}
                remaining={remaining}
                canForce={canManage}
              />
            ) : null}
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Status</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant={STATUS_VARIANTS[trip.dispatch.status]}>
              {trip.dispatch.status.replace("_", " ")}
            </Badge>
            {trip.dispatch.force_closed_reason ? (
              <p className="mt-2 text-xs text-destructive">
                Force-closed: {trip.dispatch.force_closed_reason}
              </p>
            ) : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Passengers</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <span className="text-2xl font-semibold">{totalPax}</span>
            <span className="ml-2 text-muted-foreground">
              boarded · {remaining} on board
            </span>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Vehicle</CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <p className="font-medium">{trip.vehicle?.vehicle_code ?? "—"}</p>
            <p className="text-muted-foreground">
              {trip.vehicle?.plate_number ?? "no plate"} ·{" "}
              {trip.vehicle?.vehicle_type ?? "—"}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Truck className="size-4" />
            Leg timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          {trip.legs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No legs yet.</p>
          ) : (
            <ol className="space-y-3">
              {trip.legs.map((leg) => {
                const from = leg.from_site_id
                  ? sitesById.get(leg.from_site_id)?.name ?? leg.from_label
                  : leg.from_label;
                const to = leg.to_site_id
                  ? sitesById.get(leg.to_site_id)?.name ?? leg.to_label
                  : leg.to_label;
                const legDropoffs = dropoffsByLeg.get(leg.id) ?? [];
                return (
                  <li
                    key={leg.id}
                    className="rounded-md border p-3 text-sm"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">Leg {leg.leg_order}</Badge>
                        <span className="font-medium">{from}</span>
                        <ArrowRight className="size-3.5 text-muted-foreground" />
                        <span className="font-medium">{to}</span>
                      </div>
                      <Badge
                        variant={leg.arrived_at ? "outline" : "default"}
                      >
                        {leg.arrived_at ? "arrived" : "in transit"}
                      </Badge>
                    </div>
                    <p className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                      <span>
                        <Clock className="mr-1 inline size-3" />
                        departed {formatManila(leg.departed_at)}
                      </span>
                      {leg.arrived_at ? (
                        <span>
                          <CheckCircle2 className="mr-1 inline size-3" />
                          arrived {formatManila(leg.arrived_at)}
                        </span>
                      ) : null}
                    </p>
                    {legDropoffs.length > 0 ? (
                      <ul className="mt-2 space-y-0.5 text-xs">
                        {legDropoffs.map((d) => {
                          const m = manifestById.get(d.manifest_id);
                          return (
                            <li key={d.id}>
                              <span className="font-medium">
                                {m?.team_name ?? "—"}
                              </span>{" "}
                              · {d.count} dropped off
                            </li>
                          );
                        })}
                      </ul>
                    ) : null}
                  </li>
                );
              })}
            </ol>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Users className="size-4" />
            Manifest
          </CardTitle>
        </CardHeader>
        <CardContent>
          {trip.manifest.length === 0 ? (
            <p className="text-sm text-muted-foreground">No groups.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr>
                  <th className="py-1">Delegation</th>
                  <th className="py-1">Team</th>
                  <th className="py-1 text-right">Boarded</th>
                  <th className="py-1 text-right">Dropped</th>
                  <th className="py-1 text-right">Remaining</th>
                </tr>
              </thead>
              <tbody>
                {trip.manifest.map((m) => {
                  const delegation = m.delegation_id
                    ? delegationsById.get(m.delegation_id)
                    : null;
                  return (
                    <tr key={m.id} className="border-t">
                      <td className="py-2">
                        {delegation
                          ? `${delegation.region_code} — ${delegation.region_name}`
                          : "—"}
                      </td>
                      <td className="py-2">{m.team_name}</td>
                      <td className="py-2 text-right">
                        {m.total_passengers}
                      </td>
                      <td className="py-2 text-right">{m.dropped_off}</td>
                      <td className="py-2 text-right font-medium">
                        {m.total_passengers - m.dropped_off}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
