import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Printer } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Forbidden } from "@/components/shared/forbidden";
import { getCurrentProfile } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions";
import { getDailyIncidentSummary } from "@/lib/actions/reports";
import { manilaDateLabel, formatManila } from "@/lib/timezone";
import {
  INCIDENT_CATEGORY_LABELS,
  INCIDENT_STATUS_LABELS,
  REFERRAL_LEVEL_LABELS,
  REFERRAL_STATUS_LABELS,
  SEVERITY_LABELS,
} from "@/lib/labels";
import { PrintButton } from "@/components/reports/print-button";

interface PageProps {
  params: Promise<{ date: string }>;
}

export default async function DailyIncidentReportPage({ params }: PageProps) {
  const { date } = await params;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) notFound();

  const profile = await getCurrentProfile();
  if (!profile || !hasPermission(profile, "reports.view")) {
    return (
      <Forbidden message="Reports access requires the reports.view permission." />
    );
  }

  const result = await getDailyIncidentSummary(date);
  if (result.error) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-destructive">{result.error}</p>
      </div>
    );
  }
  const summary = result.data!;
  const generatedAt = formatManila(new Date(), "MMM d, yyyy · HH:mm 'PHT'");

  return (
    <div className="mx-auto max-w-4xl space-y-6 print:max-w-none print:space-y-4">
      {/* Toolbar — hidden on print */}
      <div className="flex items-center justify-between gap-3 print:hidden">
        <Link
          href="/dashboard/reports"
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          <ArrowLeft className="size-4" />
          Back to reports
        </Link>
        <PrintButton>
          <Printer className="size-4" />
          Print / Save as PDF
        </PrintButton>
      </div>

      {/* Report header */}
      <header className="space-y-1 border-b pb-4">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Palarong Pambansa Delegation Monitoring System
        </p>
        <h1 className="text-2xl font-bold tracking-tight">
          Daily Incident Summary
        </h1>
        <p className="text-sm text-muted-foreground">
          {manilaDateLabel(summary.date)} · Generated {generatedAt} by{" "}
          {profile.full_name ?? profile.email}
        </p>
      </header>

      {/* Headline counts */}
      <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Total incidents" value={summary.total_incidents} />
        <Stat label="Critical" value={summary.by_severity.critical} accent="critical" />
        <Stat label="High" value={summary.by_severity.high} accent="high" />
        <Stat label="Referrals" value={summary.referrals.total} />
      </section>

      {/* By severity */}
      <ReportTable
        title="By severity"
        rows={[
          ["Critical", summary.by_severity.critical],
          ["High", summary.by_severity.high],
          ["Medium", summary.by_severity.medium],
          ["Low", summary.by_severity.low],
        ]}
        total={summary.total_incidents}
        emptyLabel={SEVERITY_LABELS.low}
      />

      {/* By category */}
      <ReportTable
        title="By category"
        rows={Object.entries(summary.by_category).map(([cat, count]) => [
          INCIDENT_CATEGORY_LABELS[cat as keyof typeof INCIDENT_CATEGORY_LABELS],
          count,
        ])}
        total={summary.total_incidents}
      />

      {/* By status */}
      <ReportTable
        title="By status"
        rows={Object.entries(summary.by_status).map(([s, count]) => [
          INCIDENT_STATUS_LABELS[s as keyof typeof INCIDENT_STATUS_LABELS],
          count,
        ])}
        total={summary.total_incidents}
      />

      {/* Top sites */}
      <section className="space-y-3 break-inside-avoid">
        <h2 className="text-lg font-semibold">Top 5 sites by incident volume</h2>
        {summary.top_sites.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No site-tagged incidents on this day.
          </p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="py-2 font-medium">Site</th>
                <th className="py-2 text-right font-medium">Incidents</th>
              </tr>
            </thead>
            <tbody>
              {summary.top_sites.map((s) => (
                <tr key={s.site_id} className="border-b">
                  <td className="py-2">{s.site_name}</td>
                  <td className="py-2 text-right font-mono">{s.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* Referrals */}
      <section className="space-y-3 break-inside-avoid">
        <h2 className="text-lg font-semibold">Referral activity</h2>
        <div className="grid gap-6 sm:grid-cols-2">
          <ReportTable
            title="By level"
            inline
            rows={Object.entries(summary.referrals.by_level).map(([k, c]) => [
              REFERRAL_LEVEL_LABELS[k as keyof typeof REFERRAL_LEVEL_LABELS],
              c,
            ])}
            total={summary.referrals.total}
          />
          <ReportTable
            title="By status"
            inline
            rows={Object.entries(summary.referrals.by_status).map(([k, c]) => [
              REFERRAL_STATUS_LABELS[k as keyof typeof REFERRAL_STATUS_LABELS],
              c,
            ])}
            total={summary.referrals.total}
          />
        </div>
      </section>

      <footer className="border-t pt-4 text-xs text-muted-foreground">
        This report was generated from live operational data. PII access is
        governed by the Data Privacy Act of 2012 (RA 10173).
      </footer>
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
  accent?: "critical" | "high";
}) {
  const accentClass =
    accent === "critical"
      ? "text-red-600"
      : accent === "high"
        ? "text-orange-600"
        : "text-foreground";
  return (
    <div className="rounded-md border p-4">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className={`mt-1 text-3xl font-bold tracking-tight ${accentClass}`}>
        {value}
      </div>
    </div>
  );
}

function ReportTable({
  title,
  rows,
  total,
  inline,
}: {
  title: string;
  rows: Array<[string, number]>;
  total: number;
  inline?: boolean;
  emptyLabel?: string;
}) {
  const visible = rows.filter(([, c]) => c > 0);
  return (
    <section className={inline ? "space-y-2" : "space-y-3 break-inside-avoid"}>
      <h2 className={inline ? "text-sm font-semibold" : "text-lg font-semibold"}>
        {title}
      </h2>
      {visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">No entries.</p>
      ) : (
        <table className="w-full border-collapse text-sm">
          <tbody>
            {visible.map(([label, count]) => {
              const pct = total > 0 ? Math.round((count / total) * 100) : 0;
              return (
                <tr key={label} className="border-b last:border-b-0">
                  <td className="py-1.5">{label}</td>
                  <td className="py-1.5 text-right font-mono w-16">{count}</td>
                  <td className="py-1.5 pl-3 text-right text-xs text-muted-foreground w-12">
                    {pct}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}
