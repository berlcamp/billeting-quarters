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
import { Badge } from "@/components/ui/badge";
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
import { DischargeDialog } from "@/components/medical/ucf/discharge-dialog";
import { HospitalAssessmentForm } from "@/components/medical/hospital/hospital-assessment-form";
import { AdmitDialog } from "@/components/medical/hospital/admit-dialog";
import { RejectDialog } from "@/components/medical/hospital/reject-dialog";
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
  REFERRAL_LEVEL_LABELS,
  type PatientGender,
} from "@/lib/labels";
import type { Database } from "@/types/database";

type Referral = Database["palaro"]["Tables"]["referrals"]["Row"];

const ORDER = ["pending", "accepted", "in_treatment", "admitted", "discharged"];
const STAGE_LABELS = ["Pending", "Accepted", "In treatment", "Admitted", "Discharged"];

function buildSteps(referral: Referral): ApprovalStep[] {
  const currentIdx = ORDER.indexOf(referral.status);
  return ORDER.map((id, idx) => {
    let state: StepperState;
    if (currentIdx < 0 || idx > currentIdx) state = "pending";
    else if (idx === currentIdx) state = "current";
    else state = "complete";
    return { id, label: STAGE_LABELS[idx], state };
  });
}

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

export default async function HospitalReferralPage({ params }: PageProps) {
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
    return (
      <Forbidden message="Hospital role required to view this referral." />
    );
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
  if (
    referral.level !== "ucf_to_hospital" &&
    referral.level !== "hospital_admit"
  ) {
    notFound();
  }

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

  const fieldOrFromVitals = vitalsLine(referral.vital_signs);
  const arrivalVitals = vitalsLine(referral.vital_signs, "on_arrival");

  const isDirect = referral.level === "hospital_admit";
  const canAccept =
    referral.status === "pending" &&
    hasPermission(profile, "referral.accept");
  const canReject =
    referral.status === "pending" &&
    hasPermission(profile, "referral.accept");
  const canAssess =
    (referral.status === "accepted" || referral.status === "in_treatment") &&
    hasPermission(profile, "referral.assess");
  const canAdmit =
    (referral.status === "accepted" || referral.status === "in_treatment") &&
    hasPermission(profile, "referral.assess");
  const canDischarge =
    (referral.status === "accepted" ||
      referral.status === "in_treatment" ||
      referral.status === "admitted") &&
    hasPermission(profile, "referral.discharge");

  const timeline: TimelineEntry[] = [
    {
      id: "referred",
      at: referral.referred_at,
      title: isDirect ? <>Direct admit logged</> : <>Hospital referral sent</>,
      description: fromSite
        ? `From ${fromSite.name}`
        : isDirect
          ? "Walk-in / outside the field-UCF chain"
          : undefined,
    },
  ];
  if (referral.received_at) {
    timeline.push({
      id: "received",
      at: referral.received_at,
      title: <>Received at hospital</>,
      dotClassName: "text-blue-600",
    });
  }
  if (referral.discharged_at) {
    const violet = referral.status === "admitted";
    const rejected = referral.status === "rejected";
    timeline.push({
      id: "ended",
      at: referral.discharged_at,
      title: (
        <>
          {referral.status === "admitted"
            ? "Admitted to ward"
            : rejected
              ? "Rejected"
              : "Discharged"}
        </>
      ),
      description: referral.discharge_notes ?? undefined,
      dotClassName: rejected
        ? "text-red-600"
        : violet
          ? "text-violet-600"
          : "text-green-600",
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/dashboard/medical/hospital"
          className={buttonVariants({ variant: "ghost", size: "sm" })}
        >
          <ArrowLeft className="size-4" />
          Back to inbox
        </Link>
        <span className="font-mono text-xs text-muted-foreground">
          {referral.referral_number}
        </span>
        <Badge variant="outline" className="text-[10px] uppercase tracking-wider">
          {isDirect ? "Direct admit" : REFERRAL_LEVEL_LABELS[referral.level]}
        </Badge>
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

          {/* Carry-forward summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {isDirect ? "Reason for admission" : "Pre-hospital summary"}
              </CardTitle>
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
              {referral.initial_diagnosis ? (
                <div>
                  <div className="text-xs text-muted-foreground">
                    Working diagnosis
                  </div>
                  <div>{referral.initial_diagnosis}</div>
                </div>
              ) : null}
              {referral.treatment_given ? (
                <div>
                  <div className="text-xs text-muted-foreground">
                    Treatment given so far
                  </div>
                  <div className="whitespace-pre-wrap">
                    {referral.treatment_given}
                  </div>
                </div>
              ) : null}
              <div>
                <div className="text-xs text-muted-foreground">Vitals</div>
                <div className="font-mono text-xs">
                  {fieldOrFromVitals ?? "—"}
                  {arrivalVitals ? (
                    <span className="block">
                      <span className="text-muted-foreground">on arrival: </span>
                      {arrivalVitals}
                    </span>
                  ) : null}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Decision actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                {canAccept
                  ? "Reception"
                  : canAssess
                    ? "Hospital assessment"
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
                  <div className="flex flex-wrap gap-2">
                    <AcceptReferralButton referralId={referral.id} />
                    {canReject ? (
                      <RejectDialog referralId={referral.id} />
                    ) : null}
                  </div>
                </>
              ) : canAssess ? (
                <>
                  <HospitalAssessmentForm
                    referralId={referral.id}
                    initialDiagnosis={referral.initial_diagnosis}
                    treatmentPlan={referral.treatment_plan}
                    assessmentNotes={referral.assessment_notes}
                  />
                  <div className="border-t pt-4 flex flex-wrap gap-2">
                    {canAdmit ? <AdmitDialog referralId={referral.id} /> : null}
                    {canDischarge ? (
                      <DischargeDialog referralId={referral.id} />
                    ) : null}
                  </div>
                </>
              ) : referral.status === "admitted" ? (
                <>
                  {referral.assessment_notes ? (
                    <div className="space-y-1.5 text-sm">
                      <div className="text-xs text-muted-foreground">
                        Assessment / admission notes
                      </div>
                      <p className="whitespace-pre-wrap">
                        {referral.assessment_notes}
                      </p>
                    </div>
                  ) : null}
                  {canDischarge ? (
                    <div className="border-t pt-4">
                      <DischargeDialog referralId={referral.id} />
                    </div>
                  ) : null}
                </>
              ) : referral.status === "discharged" ||
                referral.status === "rejected" ? (
                <div className="space-y-2 text-sm">
                  <div className="text-xs text-muted-foreground">
                    {referral.status === "rejected"
                      ? "Rejection notes"
                      : "Discharge notes"}
                  </div>
                  <p className="whitespace-pre-wrap">
                    {referral.discharge_notes ?? "—"}
                  </p>
                  <div className="text-xs text-muted-foreground">
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
                <div className="text-xs text-muted-foreground">Hospital</div>
                <div>{toSite?.name ?? "—"}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Source</div>
                <div>
                  {isDirect ? "Direct admit" : (fromSite?.name ?? "—")}
                </div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Referred</div>
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
