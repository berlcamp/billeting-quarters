import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Printer } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Forbidden } from "@/components/shared/forbidden";
import { PrintButton } from "@/components/reports/print-button";
import { getCurrentProfile } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions";
import { getMedicalChainReport } from "@/lib/actions/reports";
import { formatManila, manilaDateLabel } from "@/lib/timezone";

interface PageProps {
  params: Promise<{ from: string; to: string }>;
}

function fmtMins(value: number | null): string {
  if (value === null) return "—";
  if (value < 60) return `${Math.round(value)} min`;
  const h = Math.floor(value / 60);
  const m = Math.round(value % 60);
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export default async function MedicalChainReportPage({ params }: PageProps) {
  const { from, to } = await params;
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(from) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(to)
  ) {
    notFound();
  }

  const profile = await getCurrentProfile();
  if (!profile || !hasPermission(profile, "reports.view")) {
    return (
      <Forbidden message="Reports access requires the reports.view permission." />
    );
  }

  const result = await getMedicalChainReport(from, to);
  if (result.error) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-destructive">{result.error}</p>
      </div>
    );
  }
  const r = result.data!;
  const generatedAt = formatManila(new Date(), "MMM d, yyyy · HH:mm 'PHT'");

  return (
    <div className="mx-auto max-w-4xl space-y-6 print:max-w-none print:space-y-4">
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

      <header className="space-y-1 border-b pb-4">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Palaro Bayugan Command
        </p>
        <h1 className="text-2xl font-bold tracking-tight">
          Medical Chain Throughput
        </h1>
        <p className="text-sm text-muted-foreground">
          {manilaDateLabel(r.from)} — {manilaDateLabel(r.to)} · Generated{" "}
          {generatedAt} by {profile.full_name ?? profile.email}
        </p>
      </header>

      <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Total referrals" value={r.totals.referrals} />
        <Stat label="Field → UCF" value={r.totals.field_to_ucf} />
        <Stat label="UCF → Hospital" value={r.totals.ucf_to_hospital} />
        <Stat
          label="Hospitalization rate"
          value={`${r.hospitalization_rate_pct}%`}
        />
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <StageCard
          title="Time to accept"
          subtitle="referred → received at receiving facility"
          stage={r.time_to_accept}
        />
        <StageCard
          title="Time to discharge"
          subtitle="received → discharged"
          stage={r.time_to_discharge}
        />
      </section>

      <section className="space-y-3 break-inside-avoid">
        <h2 className="text-lg font-semibold">Outcomes</h2>
        <table className="w-full border-collapse text-sm">
          <tbody>
            <OutcomeRow
              label="Discharged"
              count={r.totals.discharged}
              total={r.totals.referrals}
            />
            <OutcomeRow
              label="Admitted to hospital"
              count={r.totals.admitted}
              total={r.totals.referrals}
            />
            <OutcomeRow
              label="Rejected at intake"
              count={r.totals.rejected}
              total={r.totals.referrals}
            />
            <OutcomeRow
              label="Still in flight"
              count={r.totals.in_flight}
              total={r.totals.referrals}
            />
          </tbody>
        </table>
      </section>

      <section className="space-y-3 break-inside-avoid">
        <h2 className="text-lg font-semibold">Busiest receiving facilities</h2>
        {r.busiest_destinations.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No referrals routed in this window.
          </p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="py-2 font-medium">Site</th>
                <th className="py-2 text-right font-medium">Referrals</th>
              </tr>
            </thead>
            <tbody>
              {r.busiest_destinations.map((s) => (
                <tr key={s.site_id} className="border-b">
                  <td className="py-2">{s.site_name}</td>
                  <td className="py-2 text-right font-mono">{s.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <footer className="border-t pt-4 text-xs text-muted-foreground">
        Medians are robust to outliers from stalled referrals; the p90 column
        surfaces the long tail. Data Privacy Act of 2012 (RA 10173) applies to
        any patient-level export.
      </footer>
    </div>
  );

  function Stat({
    label,
    value,
  }: {
    label: string;
    value: string | number;
  }) {
    return (
      <div className="rounded-md border p-4">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">
          {label}
        </div>
        <div className="mt-1 text-3xl font-bold tracking-tight">{value}</div>
      </div>
    );
  }

  function StageCard({
    title,
    subtitle,
    stage,
  }: {
    title: string;
    subtitle: string;
    stage: { count: number; median_minutes: number | null; p90_minutes: number | null };
  }) {
    return (
      <div className="rounded-md border p-4">
        <div className="text-sm font-semibold">{title}</div>
        <div className="text-xs text-muted-foreground">{subtitle}</div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-sm">
          <Field label="N" value={String(stage.count)} />
          <Field label="Median" value={fmtMins(stage.median_minutes)} />
          <Field label="P90" value={fmtMins(stage.p90_minutes)} />
        </div>
      </div>
    );
  }

  function Field({ label, value }: { label: string; value: string }) {
    return (
      <div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
          {label}
        </div>
        <div className="font-mono text-base font-semibold">{value}</div>
      </div>
    );
  }

  function OutcomeRow({
    label,
    count,
    total,
  }: {
    label: string;
    count: number;
    total: number;
  }) {
    const pct = total > 0 ? Math.round((count / total) * 100) : 0;
    return (
      <tr className="border-b">
        <td className="py-1.5">{label}</td>
        <td className="py-1.5 text-right font-mono w-16">{count}</td>
        <td className="py-1.5 pl-3 text-right text-xs text-muted-foreground w-12">
          {pct}%
        </td>
      </tr>
    );
  }
}
