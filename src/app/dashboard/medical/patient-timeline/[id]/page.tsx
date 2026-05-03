import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { ArrowLeft } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { Forbidden } from "@/components/shared/forbidden";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  TimelineLog,
  type TimelineEntry,
} from "@/components/shared/timeline-log";
import { getReferralChain } from "@/lib/actions/referrals";
import { getSites } from "@/lib/actions/sites";
import { getDelegations } from "@/lib/actions/delegations";
import { getCurrentProfile } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions";
import {
  PATIENT_GENDER_LABELS,
  REFERRAL_LEVEL_LABELS,
  type PatientGender,
} from "@/lib/labels";

type Vitals = Record<string, unknown> & { on_arrival?: Record<string, unknown> };

function vitalsLine(raw: unknown, key?: keyof Vitals): string | null {
  if (!raw || typeof raw !== "object") return null;
  const v = (key ? (raw as Vitals)[key] : raw) as
    | Record<string, unknown>
    | undefined;
  if (!v || typeof v !== "object" || Object.keys(v).length === 0) return null;
  const parts: string[] = [];
  if (v.bp) parts.push(`BP ${v.bp}`);
  if (v.hr != null) parts.push(`HR ${v.hr}`);
  if (v.temp != null) parts.push(`T ${v.temp}°`);
  if (v.rr != null) parts.push(`RR ${v.rr}`);
  if (v.spo2 != null) parts.push(`SpO₂ ${v.spo2}%`);
  return parts.length > 0 ? parts.join(" · ") : null;
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function PatientTimelinePage({ params }: PageProps) {
  const { id } = await params;

  const profile = await getCurrentProfile();
  if (!profile || !hasPermission(profile, "incident.view")) {
    return (
      <Forbidden message="You don't have permission to view patient timelines." />
    );
  }

  const [chainResult, sitesResult, delegationsResult] = await Promise.all([
    getReferralChain(id),
    getSites(true),
    getDelegations(true),
  ]);

  if (chainResult.error) {
    if (chainResult.error.toLowerCase().includes("no rows")) notFound();
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
        Failed to load chain: {chainResult.error}
      </div>
    );
  }

  const { referrals, incident } = chainResult.data!;
  const sites = sitesResult.error ? [] : (sitesResult.data ?? []);
  const delegations = delegationsResult.error
    ? []
    : (delegationsResult.data ?? []);

  const siteName = (siteId: string | null) =>
    siteId ? sites.find((s) => s.id === siteId)?.name ?? "—" : "—";
  const delegationLabel = (delId: string | null) => {
    if (!delId) return null;
    const d = delegations.find((dd) => dd.id === delId);
    return d ? `${d.region_code} — ${d.region_name}` : null;
  };

  // The patient's "card" is taken from the most recent referral (it has the
  // most carry-forward data). Fall back to incident if no referrals.
  const latest = referrals[referrals.length - 1] ?? null;

  // Build the unified timeline.
  const entries: TimelineEntry[] = [];

  if (incident) {
    entries.push({
      id: `incident-${incident.id}`,
      at: incident.reported_at,
      title: (
        <div className="flex flex-wrap items-center gap-2">
          <span>Incident reported — {incident.title}</span>
          <span className="font-mono text-[10px] uppercase text-muted-foreground">
            {incident.incident_number}
          </span>
        </div>
      ),
      description: (
        <div className="space-y-1">
          {incident.description ? <p>{incident.description}</p> : null}
          <div className="text-xs text-muted-foreground">
            Site: {siteName(incident.site_id)}
            {incident.location_details
              ? ` · ${incident.location_details}`
              : ""}
          </div>
        </div>
      ),
    });
  }

  for (const r of referrals) {
    entries.push({
      id: `ref-${r.id}-sent`,
      at: r.referred_at,
      title: (
        <div className="flex flex-wrap items-center gap-2">
          <span>{REFERRAL_LEVEL_LABELS[r.level]} sent</span>
          <span className="font-mono text-[10px] uppercase text-muted-foreground">
            {r.referral_number}
          </span>
          <StatusBadge variant="referral" status={r.status} />
        </div>
      ),
      description: (
        <div className="space-y-1">
          <div className="text-xs">
            From {siteName(r.from_site_id)} → {siteName(r.to_site_id)}
          </div>
          {r.chief_complaint ? (
            <p className="text-xs">
              <span className="text-muted-foreground">Chief complaint:</span>{" "}
              {r.chief_complaint}
            </p>
          ) : null}
          {vitalsLine(r.vital_signs) ? (
            <p className="text-xs font-mono text-muted-foreground">
              {vitalsLine(r.vital_signs)}
            </p>
          ) : null}
        </div>
      ),
    });
    if (r.received_at) {
      entries.push({
        id: `ref-${r.id}-received`,
        at: r.received_at,
        title: <>Received at {siteName(r.to_site_id)}</>,
        dotClassName: "text-blue-600",
      });
    }
    if (r.initial_diagnosis || r.treatment_plan || r.assessment_notes) {
      entries.push({
        id: `ref-${r.id}-assessment`,
        at: r.received_at ?? r.referred_at,
        title: <>Assessment at {siteName(r.to_site_id)}</>,
        description: (
          <div className="space-y-1 text-xs">
            {r.initial_diagnosis ? (
              <p>
                <span className="text-muted-foreground">Diagnosis:</span>{" "}
                {r.initial_diagnosis}
              </p>
            ) : null}
            {r.treatment_plan ? (
              <p>
                <span className="text-muted-foreground">Plan:</span>{" "}
                {r.treatment_plan}
              </p>
            ) : null}
            {r.assessment_notes ? (
              <p>
                <span className="text-muted-foreground">Notes:</span>{" "}
                {r.assessment_notes}
              </p>
            ) : null}
            {vitalsLine(r.vital_signs, "on_arrival") ? (
              <p className="font-mono text-muted-foreground">
                On arrival: {vitalsLine(r.vital_signs, "on_arrival")}
              </p>
            ) : null}
          </div>
        ),
        dotClassName: "text-orange-600",
      });
    }
    if (r.discharged_at) {
      entries.push({
        id: `ref-${r.id}-discharged`,
        at: r.discharged_at,
        title: (
          <>
            {r.status === "admitted"
              ? `Admitted from ${siteName(r.to_site_id)}`
              : `Discharged from ${siteName(r.to_site_id)}`}
          </>
        ),
        description: r.discharge_notes ?? undefined,
        dotClassName:
          r.status === "admitted" ? "text-violet-600" : "text-green-600",
      });
    }
  }

  // Chronological — entries already inserted in order, but a re-sort is cheap insurance.
  entries.sort(
    (a, b) => new Date(a.at).valueOf() - new Date(b.at).valueOf(),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/dashboard/medical/ucf"
          className={buttonVariants({ variant: "ghost", size: "sm" })}
        >
          <ArrowLeft className="size-4" />
          Back
        </Link>
        <span className="text-xs text-muted-foreground">Patient timeline</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Care chain</CardTitle>
            </CardHeader>
            <CardContent>
              <TimelineLog
                entries={entries}
                empty="No care events recorded yet."
              />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Patient</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {latest ? (
                <>
                  <div className="text-base font-medium">
                    {latest.patient_name}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {latest.patient_age != null
                      ? `${latest.patient_age}y`
                      : "Age —"}
                    {latest.patient_gender
                      ? ` · ${PATIENT_GENDER_LABELS[latest.patient_gender as PatientGender]}`
                      : ""}
                  </div>
                  {delegationLabel(latest.delegation_id) ? (
                    <div className="text-xs text-muted-foreground">
                      {delegationLabel(latest.delegation_id)}
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="text-sm text-muted-foreground">
                  No referral data available.
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Referrals in chain</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {referrals.length === 0 ? (
                <div className="text-sm text-muted-foreground">
                  No referrals.
                </div>
              ) : (
                referrals.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between gap-2 text-sm"
                  >
                    <div className="min-w-0">
                      <div className="font-mono text-xs">
                        {r.referral_number}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {REFERRAL_LEVEL_LABELS[r.level]} ·{" "}
                        {format(new Date(r.referred_at), "MMM d, HH:mm")}
                      </div>
                    </div>
                    <StatusBadge variant="referral" status={r.status} />
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {incident ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Source incident</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <Link
                  href={`/dashboard/incidents/${incident.id}`}
                  className="font-mono text-xs underline-offset-2 hover:underline"
                >
                  {incident.incident_number}
                </Link>
                <div>{incident.title}</div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge variant="severity" status={incident.severity} />
                  <StatusBadge variant="incident" status={incident.status} />
                </div>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
