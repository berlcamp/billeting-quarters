import Link from "next/link";
import { notFound } from "next/navigation";
import { format, formatDistanceToNow } from "date-fns";
import { ArrowLeft, GitBranch } from "lucide-react";
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
  ApprovalStepper,
  type ApprovalStep,
  type StepperState,
} from "@/components/shared/approval-stepper";
import {
  TimelineLog,
  type TimelineEntry,
} from "@/components/shared/timeline-log";
import { AcceptReferralButton } from "@/components/medical/ucf/accept-referral-button";
import { UcfAssessmentForm } from "@/components/medical/ucf/ucf-assessment-form";
import { DischargeDialog } from "@/components/medical/ucf/discharge-dialog";
import { ReferToHospitalDialog } from "@/components/medical/ucf/refer-to-hospital-dialog";
import { getReferral } from "@/lib/actions/referrals";
import { getSites } from "@/lib/actions/sites";
import { getDelegations } from "@/lib/actions/delegations";
import { getCurrentProfile } from "@/lib/auth/session";
import {
  hasAnyPermission,
  hasPermission,
} from "@/lib/permissions";
import {
  PATIENT_GENDER_LABELS,
  type PatientGender,
} from "@/lib/labels";
import type { Database } from "@/types/database";

type Referral = Database["palaro"]["Tables"]["referrals"]["Row"];
type ReferralStatus = Database["palaro"]["Enums"]["referral_status"];

const UCF_STAGES: { id: string; status: ReferralStatus | "rejected" | "discharged"; label: string }[] = [
  { id: "pending", status: "pending", label: "Pending" },
  { id: "accepted", status: "accepted", label: "Accepted" },
  { id: "in_treatment", status: "in_treatment", label: "In treatment" },
  { id: "discharged", status: "discharged", label: "Discharged" },
];

function buildSteps(referral: Referral): ApprovalStep[] {
  // Map current status to a sequence index. "rejected"/"admitted" don't appear
  // explicitly — treated as terminal at the corresponding sequence position.
  const order = ["pending", "accepted", "in_treatment", "discharged"];
  const currentIdx = order.indexOf(referral.status);
  return UCF_STAGES.map((stage, idx) => {
    let state: StepperState;
    if (currentIdx < 0 || idx > currentIdx) state = "pending";
    else if (idx === currentIdx) state = "current";
    else state = "complete";
    return { id: stage.id, label: stage.label, state };
  });
}

type Vitals = Record<string, unknown> & { on_arrival?: Record<string, unknown> };

function formatVitals(raw: unknown, key?: keyof Vitals): string | null {
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

export default async function UcfReferralPage({ params }: PageProps) {
  const { id } = await params;

  const profile = await getCurrentProfile();
  if (
    !profile ||
    !hasAnyPermission(profile, [
      "referral.accept",
      "referral.assess",
      "referral.discharge",
    ])
  ) {
    return <Forbidden message="UCF role required to view this referral." />;
  }

  const [referralResult, sitesResult, delegationsResult] = await Promise.all([
    getReferral(id),
    getSites(true),
    getDelegations(true),
  ]);

  if (referralResult.error) {
    if (referralResult.error.toLowerCase().includes("no rows")) notFound();
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
        Failed to load referral: {referralResult.error}
      </div>
    );
  }

  const referral = referralResult.data!;
  const sites = sitesResult.error ? [] : (sitesResult.data ?? []);
  const delegations = delegationsResult.error
    ? []
    : (delegationsResult.data ?? []);

  const fromSite = referral.from_site_id
    ? sites.find((s) => s.id === referral.from_site_id) ?? null
    : null;
  const toSite = sites.find((s) => s.id === referral.to_site_id) ?? null;
  const delegation = referral.delegation_id
    ? delegations.find((d) => d.id === referral.delegation_id) ?? null
    : null;
  const hospitalSites = sites
    .filter((s) => s.site_type === "hospital")
    .map((s) => ({ id: s.id, name: s.name }));

  const fieldVitalsLine = formatVitals(referral.vital_signs);
  const arrivalVitalsLine = formatVitals(referral.vital_signs, "on_arrival");

  const canAccept =
    referral.status === "pending" &&
    hasPermission(profile, "referral.accept");
  const canAssess =
    (referral.status === "accepted" || referral.status === "in_treatment") &&
    hasPermission(profile, "referral.assess");
  const canDischarge =
    (referral.status === "accepted" || referral.status === "in_treatment") &&
    hasPermission(profile, "referral.discharge");
  const canEscalate =
    (referral.status === "accepted" || referral.status === "in_treatment") &&
    hasPermission(profile, "referral.create_ucf_to_hospital");

  const timeline: TimelineEntry[] = [
    {
      id: "referred",
      at: referral.referred_at,
      title: <>Field referral sent</>,
      description: fromSite ? `From ${fromSite.name}` : undefined,
    },
  ];
  if (referral.received_at) {
    timeline.push({
      id: "received",
      at: referral.received_at,
      title: <>Accepted at UCF</>,
      dotClassName: "text-blue-600",
    });
  }
  if (referral.discharged_at) {
    timeline.push({
      id: "discharged",
      at: referral.discharged_at,
      title: <>Discharged</>,
      description: referral.discharge_notes ?? undefined,
      dotClassName: "text-green-600",
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/dashboard/medical/ucf"
          className={buttonVariants({ variant: "ghost", size: "sm" })}
        >
          <ArrowLeft className="size-4" />
          Back to inbox
        </Link>
        <span className="font-mono text-xs text-muted-foreground">
          {referral.referral_number}
        </span>
        <Link
          href={`/dashboard/medical/patient-timeline/${referral.id}`}
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          <GitBranch className="size-4" />
          Patient timeline
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-6 lg:col-span-2">
          {/* Patient */}
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-start gap-3 justify-between">
                <div>
                  <CardTitle className="text-xl">{referral.patient_name}</CardTitle>
                  <div className="text-xs text-muted-foreground mt-1">
                    {referral.patient_age != null ? `${referral.patient_age}y` : "Age —"}
                    {referral.patient_gender ? ` · ${PATIENT_GENDER_LABELS[referral.patient_gender as PatientGender]}` : ""}
                    {delegation
                      ? ` · ${delegation.region_code} (${delegation.region_name})`
                      : ""}
                  </div>
                </div>
                <StatusBadge variant="referral" status={referral.status} />
              </div>
            </CardHeader>
          </Card>

          {/* Field assessment summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Field assessment</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <div className="text-xs text-muted-foreground">
                  Chief complaint
                </div>
                <div className="whitespace-pre-wrap">
                  {referral.chief_complaint ?? "—"}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">
                  Treatment given on field
                </div>
                <div className="whitespace-pre-wrap">
                  {referral.treatment_given ?? "—"}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">
                  Field vitals
                </div>
                <div className="font-mono text-xs">
                  {fieldVitalsLine ?? "—"}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Decision actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {canAccept
                  ? "Accept referral"
                  : canAssess
                    ? "Initial assessment"
                    : "Status"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {canAccept ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    Patient has been waiting{" "}
                    {formatDistanceToNow(new Date(referral.referred_at))}.
                  </p>
                  <AcceptReferralButton referralId={referral.id} />
                </>
              ) : canAssess ? (
                <>
                  <UcfAssessmentForm
                    referralId={referral.id}
                    initialDiagnosis={referral.initial_diagnosis}
                    treatmentPlan={referral.treatment_plan}
                    assessmentNotes={referral.assessment_notes}
                  />
                  {arrivalVitalsLine ? (
                    <p className="text-xs text-muted-foreground">
                      Recorded vitals on arrival:{" "}
                      <span className="font-mono">{arrivalVitalsLine}</span>
                    </p>
                  ) : null}
                  <div className="border-t pt-4 flex flex-wrap gap-2">
                    {canDischarge ? (
                      <DischargeDialog referralId={referral.id} />
                    ) : null}
                    {canEscalate ? (
                      <ReferToHospitalDialog
                        sourceUcfReferralId={referral.id}
                        hospitalSites={hospitalSites}
                      />
                    ) : null}
                  </div>
                </>
              ) : referral.status === "discharged" ? (
                <div className="space-y-2 text-sm">
                  <div className="text-xs text-muted-foreground">
                    Discharge notes
                  </div>
                  <p className="whitespace-pre-wrap">
                    {referral.discharge_notes ?? "—"}
                  </p>
                  <div className="text-xs text-muted-foreground">
                    Discharged{" "}
                    {referral.discharged_at
                      ? format(
                          new Date(referral.discharged_at),
                          "MMM d, yyyy · HH:mm",
                        )
                      : "—"}
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No actions available for this status.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <ApprovalStepper steps={buildSteps(referral)} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <div className="text-xs text-muted-foreground">Target UCF</div>
                <div>{toSite?.name ?? "—"}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Referring site</div>
                <div>{fromSite?.name ?? "—"}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Sent</div>
                <div className="text-xs font-mono">
                  {format(
                    new Date(referral.referred_at),
                    "MMM d, yyyy · HH:mm",
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <TimelineLog entries={timeline} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
