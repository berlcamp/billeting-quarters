import { notFound } from "next/navigation";
import { Forbidden } from "@/components/shared/forbidden";
import { PrintFormToolbar } from "@/components/medical/print-form-toolbar";
import { TimelineLog, type TimelineEntry } from "@/components/shared/timeline-log";
import { getIncident, getIncidentPhotoUrl } from "@/lib/actions/incidents";
import { getReferralsByIncident } from "@/lib/actions/referrals";
import { getSites } from "@/lib/actions/sites";
import { getDelegations } from "@/lib/actions/delegations";
import { getCurrentProfile } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatManila } from "@/lib/timezone";
import {
  INCIDENT_CATEGORY_LABELS,
  INCIDENT_STATUS_LABELS,
  REFERRAL_LEVEL_LABELS,
  REFERRAL_STATUS_LABELS,
  SEVERITY_LABELS,
} from "@/lib/labels";
import type { Database, Json } from "@/types/database";

type AuditLog = Database["palaro"]["Tables"]["audit_logs"]["Row"];
type Referral = Database["palaro"]["Tables"]["referrals"]["Row"];

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ auto?: string }>;
}

export default async function IncidentPrintPage({
  params,
  searchParams,
}: PageProps) {
  const { id } = await params;
  const sp = searchParams ? await searchParams : undefined;
  const autoPrint = sp?.auto !== "0";

  const profile = await getCurrentProfile();
  if (!profile || !hasPermission(profile, "incident.view")) {
    return (
      <Forbidden message="You don't have permission to view incidents." />
    );
  }

  const [incidentResult, sitesResult, delegationsResult] = await Promise.all([
    getIncident(id),
    getSites(true),
    getDelegations(true),
  ]);

  if (incidentResult.error) {
    if (incidentResult.error.toLowerCase().includes("no rows")) notFound();
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
        Failed to load incident: {incidentResult.error}
      </div>
    );
  }

  const incident = incidentResult.data!;
  const sites = sitesResult.error ? [] : (sitesResult.data ?? []);
  const delegations = delegationsResult.error
    ? []
    : (delegationsResult.data ?? []);

  const site = incident.site_id
    ? sites.find((s) => s.id === incident.site_id) ?? null
    : null;
  const delegation = incident.delegation_id
    ? delegations.find((d) => d.id === incident.delegation_id) ?? null
    : null;

  // Only pull the referral chain for medical incidents — it powers both the
  // "Referrals" block and the lifecycle entries injected into the timeline.
  const isMedical = incident.category === "medical";
  const referralsResult = isMedical
    ? await getReferralsByIncident(id)
    : { data: [] as Referral[], error: null };
  const referrals: Referral[] = referralsResult.error
    ? []
    : referralsResult.data ?? [];

  // Pull all incident-level audit log entries to enrich the timeline with
  // status transitions and force_status overrides.
  const admin = createAdminClient();
  const { data: auditRows } = await admin
    .schema("palaro")
    .from("audit_logs")
    .select("*")
    .eq("entity_type", "incident")
    .eq("entity_id", id)
    .order("created_at", { ascending: true });
  const auditLogs: AuditLog[] = auditRows ?? [];

  // Batch-resolve the display names for every profile id referenced anywhere
  // on the sheet (reporter, resolver, audit actors, referral referrers/receivers).
  const profileIds = new Set<string>();
  if (incident.reported_by) profileIds.add(incident.reported_by);
  if (incident.resolved_by) profileIds.add(incident.resolved_by);
  for (const log of auditLogs) {
    if (log.user_id) profileIds.add(log.user_id);
  }
  for (const r of referrals) {
    if (r.referred_by) profileIds.add(r.referred_by);
    if (r.received_by) profileIds.add(r.received_by);
  }
  const profileMap = new Map<string, { full_name: string | null; email: string | null }>();
  if (profileIds.size > 0) {
    const { data: profiles } = await admin
      .schema("palaro")
      .from("profiles")
      .select("id, full_name, email")
      .in("id", Array.from(profileIds));
    for (const p of profiles ?? []) {
      profileMap.set(p.id, { full_name: p.full_name, email: p.email });
    }
  }
  const nameFor = (uid: string | null | undefined): string | null => {
    if (!uid) return null;
    const p = profileMap.get(uid);
    if (!p) return null;
    return p.full_name ?? p.email ?? null;
  };

  // Site lookup helper for referral routing.
  const siteName = (sid: string | null | undefined): string | null => {
    if (!sid) return null;
    return sites.find((s) => s.id === sid)?.name ?? null;
  };

  // Resolve signed URLs for incident photos on the server so the print
  // dialog snapshots the image content directly (the client gallery's
  // useEffect fetch wouldn't complete before window.print fires).
  const photoPaths = incident.photo_urls ?? [];
  const photoUrls: (string | null)[] = await Promise.all(
    photoPaths.map(async (path) => {
      const result = await getIncidentPhotoUrl(path);
      return result.error ? null : result.data!.url;
    }),
  );

  // Build the timeline. Reported → audit-trail status transitions →
  // referral lifecycle (medical only) → resolved/closed.
  const timelineEntries: TimelineEntry[] = [];
  const reporterLabel =
    nameFor(incident.reported_by) ??
    incident.reporting_officer_name ??
    "System";
  timelineEntries.push({
    id: "reported",
    at: incident.reported_at,
    title: <>Reported by {reporterLabel}</>,
    description: incident.reporting_officer_position
      ? `${incident.reporting_officer_position}`
      : undefined,
  });

  for (const log of auditLogs) {
    // Skip the create event — it's the same moment as "reported".
    if (log.action === "create") continue;
    const changes = (log.changes ?? {}) as Record<string, Json>;
    const newStatus =
      typeof changes.status === "string" ? changes.status : null;
    const forced = changes.forced_by_super_admin === true;
    const actor = nameFor(log.user_id) ?? "Unknown user";
    let title: string;
    if (newStatus) {
      const statusLabel =
        INCIDENT_STATUS_LABELS[
          newStatus as keyof typeof INCIDENT_STATUS_LABELS
        ] ?? newStatus;
      title = forced
        ? `Status forced to ${statusLabel} (override)`
        : `Status updated to ${statusLabel}`;
    } else {
      title = `${log.action} by ${actor}`;
    }
    const resolutionNote =
      typeof changes.resolution_notes === "string"
        ? changes.resolution_notes
        : null;
    timelineEntries.push({
      id: `audit-${log.id}`,
      at: log.created_at,
      title: (
        <>
          {title} — {actor}
        </>
      ),
      description: resolutionNote || undefined,
    });
  }

  for (const r of referrals) {
    const levelLabel = REFERRAL_LEVEL_LABELS[r.level];
    const to = siteName(r.to_site_id) ?? "—";
    const from = siteName(r.from_site_id) ?? "Field";
    timelineEntries.push({
      id: `ref-created-${r.id}`,
      at: r.referred_at,
      title: (
        <>
          Referral {r.referral_number}: {levelLabel} ({from} → {to})
        </>
      ),
      description: `Referred by ${nameFor(r.referred_by) ?? "—"}`,
    });
    if (r.received_at) {
      timelineEntries.push({
        id: `ref-received-${r.id}`,
        at: r.received_at,
        title: (
          <>
            Referral {r.referral_number} accepted at {to}
          </>
        ),
        description: `Received by ${nameFor(r.received_by) ?? "—"}`,
      });
    }
    if (r.discharged_at) {
      const verb =
        r.status === "admitted"
          ? "admitted"
          : r.status === "rejected"
            ? "rejected"
            : "discharged";
      timelineEntries.push({
        id: `ref-closed-${r.id}`,
        at: r.discharged_at,
        title: (
          <>
            Referral {r.referral_number} {verb}
          </>
        ),
        description: r.discharge_notes ?? undefined,
      });
    }
  }

  if (incident.resolved_at) {
    timelineEntries.push({
      id: "resolved",
      at: incident.resolved_at,
      title: (
        <>
          {incident.status === "closed" ? "Closed" : "Resolved"} by{" "}
          {nameFor(incident.resolved_by) ?? "—"}
        </>
      ),
      description: incident.resolution_notes ?? undefined,
      dotClassName: "text-green-600",
    });
  }

  // Sort the whole list chronologically — audit + referral events can
  // interleave so the array is not already in order.
  timelineEntries.sort(
    (a, b) => new Date(a.at).getTime() - new Date(b.at).getTime(),
  );

  const generatedAt = formatManila(new Date(), "MMM d, yyyy · HH:mm 'PHT'");
  const generatedBy = profile.full_name ?? profile.email ?? "Unknown user";

  return (
    <div className="mx-auto max-w-4xl space-y-6 print:max-w-none print:space-y-4">
      <PrintFormToolbar
        backHref={`/dashboard/incidents/${id}`}
        autoPrint={autoPrint}
      />

      <header className="space-y-1 border-b pb-4">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Palarong Pambansa 2026 · Agusan del Sur
        </p>
        <h1 className="text-2xl font-bold tracking-tight">
          Incident Report — {incident.incident_number}
        </h1>
        <p className="text-sm text-muted-foreground">
          Generated {generatedAt} by {generatedBy}
        </p>
      </header>

      <section className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-4">
          <Field label="Category" value={INCIDENT_CATEGORY_LABELS[incident.category]} />
          <Field label="Severity" value={SEVERITY_LABELS[incident.severity]} />
          <Field label="Status" value={INCIDENT_STATUS_LABELS[incident.status]} />
          <Field
            label="Reported"
            value={formatManila(incident.reported_at, "MMM d, yyyy · HH:mm")}
          />
        </div>
        <h2 className="text-lg font-semibold leading-tight">
          {incident.title}
        </h2>
        {incident.description ? (
          <p className="whitespace-pre-wrap text-sm leading-relaxed">
            {incident.description}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">No description provided.</p>
        )}
      </section>

      <section className="break-inside-avoid space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Location
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Site" value={site?.name ?? "—"} />
          <Field
            label="Delegation"
            value={
              delegation
                ? `${delegation.region_code} — ${delegation.region_name}`
                : "—"
            }
          />
          <Field
            label="Location details"
            value={incident.location_details ?? "—"}
            wide
          />
          <Field
            label="Coordinates"
            value={
              incident.latitude && incident.longitude
                ? `${incident.latitude.toFixed(5)}, ${incident.longitude.toFixed(5)}`
                : "—"
            }
          />
        </div>
      </section>

      {incident.affected_person_name ||
      incident.affected_person_age ||
      incident.affected_person_role ? (
        <section className="break-inside-avoid space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Affected person
          </h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Name" value={incident.affected_person_name ?? "—"} />
            <Field
              label="Age"
              value={
                incident.affected_person_age !== null
                  ? String(incident.affected_person_age)
                  : "—"
              }
            />
            <Field label="Role" value={incident.affected_person_role ?? "—"} />
          </div>
        </section>
      ) : null}

      <section className="break-inside-avoid space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Reporting officer
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field
            label="Name"
            value={
              incident.reporting_officer_name ??
              nameFor(incident.reported_by) ??
              "—"
            }
          />
          <Field
            label="Position"
            value={incident.reporting_officer_position ?? "—"}
          />
        </div>
      </section>

      {referrals.length > 0 ? (
        <section className="break-inside-avoid space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Referrals ({referrals.length})
          </h2>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="py-2 pr-3 font-medium">Number</th>
                <th className="py-2 pr-3 font-medium">Level</th>
                <th className="py-2 pr-3 font-medium">Route</th>
                <th className="py-2 pr-3 font-medium">Status</th>
                <th className="py-2 font-medium">Referred at</th>
              </tr>
            </thead>
            <tbody>
              {referrals.map((r) => (
                <tr key={r.id} className="border-b align-top">
                  <td className="py-2 pr-3 font-mono text-xs">
                    {r.referral_number}
                  </td>
                  <td className="py-2 pr-3">{REFERRAL_LEVEL_LABELS[r.level]}</td>
                  <td className="py-2 pr-3">
                    {(siteName(r.from_site_id) ?? "Field")} →{" "}
                    {siteName(r.to_site_id) ?? "—"}
                  </td>
                  <td className="py-2 pr-3">{REFERRAL_STATUS_LABELS[r.status]}</td>
                  <td className="py-2 text-xs">
                    {formatManila(r.referred_at, "MMM d · HH:mm")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      {photoPaths.length > 0 ? (
        <section className="break-inside-avoid space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Photos ({photoPaths.length})
          </h2>
          <div className="grid grid-cols-3 gap-2">
            {photoUrls.map((url, idx) =>
              url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={photoPaths[idx]}
                  src={url}
                  alt={`Incident photo ${idx + 1}`}
                  className="aspect-square w-full rounded border object-cover"
                />
              ) : (
                <div
                  key={photoPaths[idx]}
                  className="flex aspect-square w-full items-center justify-center rounded border bg-muted text-xs text-muted-foreground"
                >
                  Photo unavailable
                </div>
              ),
            )}
          </div>
        </section>
      ) : null}

      {incident.resolution_notes ? (
        <section className="break-inside-avoid space-y-2">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Resolution notes
          </h2>
          <p className="whitespace-pre-wrap rounded border bg-muted/30 p-3 text-sm leading-relaxed">
            {incident.resolution_notes}
          </p>
        </section>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Timeline
        </h2>
        <TimelineLog
          entries={timelineEntries}
          empty="No timeline events recorded."
        />
      </section>

      <footer className="border-t pt-4 text-xs text-muted-foreground">
        This report was generated from live operational data. PII access is
        governed by the Data Privacy Act of 2012 (RA 10173).
      </footer>

      {/* A4 portrait layout. We let content flow across multiple pages because
          an incident with many timeline events + photos can easily exceed one
          sheet — sections use break-inside-avoid where it makes sense. */}
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 10mm; }
          html, body { background: white !important; }
        }
      `}</style>
    </div>
  );
}

function Field({
  label,
  value,
  wide,
}: {
  label: string;
  value: string;
  wide?: boolean;
}) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <div className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5 text-sm">{value}</div>
    </div>
  );
}
