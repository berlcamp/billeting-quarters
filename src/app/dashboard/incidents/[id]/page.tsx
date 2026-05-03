import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { ArrowLeft, MapPin, Stethoscope, User } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { Forbidden } from "@/components/shared/forbidden";
import { StatusBadge } from "@/components/shared/status-badge";
import {
  ApprovalStepper,
  type ApprovalStep,
  type StepperState,
} from "@/components/shared/approval-stepper";
import {
  TimelineLog,
  type TimelineEntry,
} from "@/components/shared/timeline-log";
import { PhotoGallery } from "@/components/incidents/photo-gallery";
import { IncidentStatusActions } from "@/components/incidents/incident-status-actions";
import { CreateFieldReferralDialog } from "@/components/medical/field/create-field-referral-dialog";
import { getIncident } from "@/lib/actions/incidents";
import { getSites } from "@/lib/actions/sites";
import { getDelegations } from "@/lib/actions/delegations";
import { getCurrentProfile } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions";
import {
  INCIDENT_CATEGORY_LABELS,
  INCIDENT_STATUS_LABELS,
} from "@/lib/labels";
import type { Database } from "@/types/database";

type IncidentStatus = Database["palaro"]["Enums"]["incident_status"];

function buildStepperSteps(
  current: IncidentStatus,
  isMedical: boolean,
): ApprovalStep[] {
  const sequence: IncidentStatus[] = isMedical
    ? ["open", "in_progress", "referred", "resolved", "closed"]
    : ["open", "in_progress", "resolved", "closed"];
  const currentIdx = sequence.indexOf(current);
  return sequence.map((s, idx) => {
    let state: StepperState;
    if (currentIdx < 0 || idx > currentIdx) state = "pending";
    else if (idx === currentIdx) state = "current";
    else state = "complete";
    return {
      id: s,
      label: INCIDENT_STATUS_LABELS[s],
      state,
    };
  });
}

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function IncidentDetailPage({ params }: PageProps) {
  const { id } = await params;

  const profile = await getCurrentProfile();
  if (!profile || !hasPermission(profile, "incident.view")) {
    return <Forbidden message="You don't have permission to view incidents." />;
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

  const stepperSteps = buildStepperSteps(
    incident.status,
    incident.category === "medical",
  );

  const timelineEntries: TimelineEntry[] = [
    {
      id: "reported",
      at: incident.reported_at,
      title: <>Reported</>,
      description: `Incident #${incident.incident_number}`,
    },
  ];
  if (incident.resolved_at) {
    timelineEntries.push({
      id: "resolved",
      at: incident.resolved_at,
      title: (
        <>
          {incident.status === "closed" ? "Closed" : "Resolved"}
          {incident.resolution_notes ? ":" : ""}
        </>
      ),
      description: incident.resolution_notes ?? undefined,
      dotClassName: "text-green-600",
    });
  }

  const canUpdate = hasPermission(profile, "incident.update");
  const canCreateFieldReferral =
    incident.category === "medical" &&
    hasPermission(profile, "referral.create_field_to_ucf") &&
    incident.status !== "closed";
  const ucfSites = sites
    .filter((s) => s.site_type === "urgent_care_facility")
    .map((s) => ({ id: s.id, name: s.name, site_type: s.site_type }));
  const delegationOptions = delegations.map((d) => ({
    id: d.id,
    region_code: d.region_code,
    region_name: d.region_name,
  }));
  const photoPaths = incident.photo_urls ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/dashboard/incidents"
          className={buttonVariants({ variant: "ghost", size: "sm" })}
        >
          <ArrowLeft className="size-4" />
          Back
        </Link>
        <span className="font-mono text-xs text-muted-foreground">
          {incident.incident_number}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-6 lg:col-span-2">
          {/* Summary */}
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-start gap-3 justify-between">
                <div className="space-y-1 min-w-0">
                  <CardTitle className="text-xl tracking-tight">
                    {incident.title}
                  </CardTitle>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                    <span>{INCIDENT_CATEGORY_LABELS[incident.category]}</span>
                    <span>·</span>
                    <span>
                      Reported{" "}
                      {format(
                        new Date(incident.reported_at),
                        "MMM d, yyyy · HH:mm",
                      )}
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge variant="severity" status={incident.severity} />
                  <StatusBadge variant="incident" status={incident.status} />
                </div>
              </div>
            </CardHeader>
            {incident.description ? (
              <CardContent>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">
                  {incident.description}
                </p>
              </CardContent>
            ) : null}
          </Card>

          {/* Affected person */}
          {incident.affected_person_name ||
          incident.affected_person_age ||
          incident.affected_person_role ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Affected person</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <dt className="text-xs text-muted-foreground">Name</dt>
                    <dd>{incident.affected_person_name ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Age</dt>
                    <dd>{incident.affected_person_age ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">Role</dt>
                    <dd>{incident.affected_person_role ?? "—"}</dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
          ) : null}

          {/* Photos */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Photos</CardTitle>
            </CardHeader>
            <CardContent>
              <PhotoGallery paths={photoPaths} />
            </CardContent>
          </Card>

          {/* Stage actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Update status</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <IncidentStatusActions
                incidentId={incident.id}
                currentStatus={incident.status}
                canUpdate={canUpdate}
              />
              {canCreateFieldReferral ? (
                <div className="border-t pt-4">
                  <CreateFieldReferralDialog
                    ucfSites={ucfSites}
                    delegations={delegationOptions}
                    prefill={{
                      incidentId: incident.id,
                      patientName: incident.affected_person_name,
                      patientAge: incident.affected_person_age,
                      delegationId: incident.delegation_id,
                    }}
                    trigger={
                      <Button variant="outline">
                        <Stethoscope className="size-4" />
                        Refer to UCF
                      </Button>
                    }
                  />
                </div>
              ) : null}
            </CardContent>
          </Card>

          {/* Resolution notes */}
          {incident.resolution_notes ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Resolution notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">
                  {incident.resolution_notes}
                </p>
              </CardContent>
            </Card>
          ) : null}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <ApprovalStepper steps={stepperSteps} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-start gap-2">
                <MapPin className="size-4 mt-0.5 text-muted-foreground" />
                <div className="min-w-0">
                  <div>{site?.name ?? "No site"}</div>
                  {incident.location_details ? (
                    <div className="text-xs text-muted-foreground">
                      {incident.location_details}
                    </div>
                  ) : null}
                  {incident.latitude && incident.longitude ? (
                    <div className="text-xs text-muted-foreground font-mono mt-0.5">
                      {incident.latitude.toFixed(5)}, {incident.longitude.toFixed(5)}
                    </div>
                  ) : null}
                </div>
              </div>
              <div className="flex items-start gap-2">
                <User className="size-4 mt-0.5 text-muted-foreground" />
                <div className="min-w-0">
                  <div className="text-xs text-muted-foreground">Delegation</div>
                  <div>
                    {delegation
                      ? `${delegation.region_code} — ${delegation.region_name}`
                      : "—"}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <TimelineLog entries={timelineEntries} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
