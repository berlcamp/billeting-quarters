import Link from "next/link";
import {
  Activity,
  CalendarDays,
  ClipboardList,
  FileBarChart,
  Lock,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Forbidden } from "@/components/shared/forbidden";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { getCurrentProfile } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions";
import { todayInManila } from "@/lib/timezone";
import { DailyIncidentReportCard } from "@/components/reports/daily-incident-report-card";
import { RecentAuditLog } from "@/components/reports/recent-audit-log";
import { getRecentAuditLogs } from "@/lib/actions/audit";

export default async function ReportsPage() {
  const profile = await getCurrentProfile();
  if (!profile || !hasPermission(profile, "reports.view")) {
    return (
      <Forbidden message="Reports access requires the reports.view permission." />
    );
  }

  const today = todayInManila();
  const auditResult = await getRecentAuditLogs(20);
  const auditLogs = auditResult.error ? [] : (auditResult.data ?? []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Daily summaries, audit trail, and operational analytics."
      />

      <DailyIncidentReportCard defaultDate={today} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <PlaceholderReportCard
          icon={Activity}
          title="Medical chain throughput"
          description="Field → UCF → Hospital flow metrics. Time-to-accept, time-to-discharge, hospitalization rates."
        />
        <PlaceholderReportCard
          icon={ClipboardList}
          title="Incident trends"
          description="Multi-day breakdowns by category, severity, and venue. Heatmap overlays."
        />
        <PlaceholderReportCard
          icon={CalendarDays}
          title="Per-delegation summary"
          description="All operational events grouped by region (NCR, CAR, …). Read-only for delegation heads."
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="size-4" />
            Recent activity (audit log)
          </CardTitle>
          <CardDescription>
            Last 20 state-changing actions. Full compliance trail captured per
            mutation.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RecentAuditLog entries={auditLogs} />
          <div className="mt-4 text-xs text-muted-foreground">
            <Link
              href="/dashboard/admin/settings"
              className="underline-offset-2 hover:underline"
            >
              Audit retention is governed by RA 10173 — see admin settings.
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function PlaceholderReportCard({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof FileBarChart;
  title: string;
  description: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Icon className="size-4 text-muted-foreground" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
          Coming soon
        </span>
      </CardContent>
    </Card>
  );
}
