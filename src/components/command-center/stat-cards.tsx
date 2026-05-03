"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  SEVERITIES,
  SEVERITY_LABELS,
  type IncidentSeverity,
} from "@/lib/labels";
import type { Database } from "@/types/database";

type Incident = Database["palaro"]["Tables"]["incidents"]["Row"];
type Referral = Database["palaro"]["Tables"]["referrals"]["Row"];

interface StatCardsProps {
  incidents: Incident[];
  referrals: Referral[];
}

function isToday(iso: string | null): boolean {
  if (!iso) return false;
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

export function StatCards({ incidents, referrals }: StatCardsProps) {
  const openIncidents = incidents.filter(
    (i) => i.status === "open" || i.status === "in_progress",
  );
  const severityBreakdown: Record<IncidentSeverity, number> = {
    low: 0,
    medium: 0,
    high: 0,
    critical: 0,
  };
  for (const i of openIncidents) severityBreakdown[i.severity]++;

  const critical = incidents.filter(
    (i) =>
      i.severity === "critical" &&
      i.status !== "resolved" &&
      i.status !== "closed",
  ).length;

  const activeReferrals = referrals.filter(
    (r) =>
      r.status === "pending" ||
      r.status === "accepted" ||
      r.status === "in_treatment",
  ).length;

  const hospitalizationsToday = referrals.filter(
    (r) =>
      (r.level === "ucf_to_hospital" || r.level === "hospital_admit") &&
      isToday(r.referred_at),
  ).length;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Open incidents
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="text-3xl font-bold tabular-nums">
            {openIncidents.length}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            {SEVERITIES.map((s) => (
              <span key={s} className="inline-flex items-center gap-1">
                <span className={cn("size-1.5 rounded-full", DOT[s])} />
                {SEVERITY_LABELS[s]}: {severityBreakdown[s]}
              </span>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className={cn(critical > 0 && "border-destructive/60")}>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Critical (active)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className={cn(
              "text-3xl font-bold tabular-nums",
              critical > 0 && "text-destructive animate-pulse",
            )}
          >
            {critical}
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">
            {critical > 0
              ? "Requires immediate command-center attention"
              : "All clear"}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Active referrals
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold tabular-nums">{activeReferrals}</div>
          <p className="text-[11px] text-muted-foreground mt-2">
            Pending · Accepted · In treatment
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Hospitalizations today
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold tabular-nums">
            {hospitalizationsToday}
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">
            Patients sent to hospital today
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

const DOT: Record<IncidentSeverity, string> = {
  low: "bg-gray-400",
  medium: "bg-yellow-500",
  high: "bg-orange-500",
  critical: "bg-red-500",
};
