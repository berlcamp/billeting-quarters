import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Printer } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Forbidden } from "@/components/shared/forbidden";
import { PrintButton } from "@/components/reports/print-button";
import { getCurrentProfile } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions";
import { getOperationsSnapshot } from "@/lib/actions/reports";
import { formatManila, manilaDateLabel } from "@/lib/timezone";

interface PageProps {
  params: Promise<{ from: string; to: string }>;
}

export default async function OperationsSnapshotPage({ params }: PageProps) {
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

  const result = await getOperationsSnapshot(from, to);
  if (result.error) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-destructive">{result.error}</p>
      </div>
    );
  }
  const r = result.data!;
  const generatedAt = formatManila(new Date(), "MMM d, yyyy · HH:mm 'PHT'");

  // Bar chart: scale each column proportional to the day with the most events.
  const peak = Math.max(
    1,
    ...r.days.map((d) => d.incidents + d.referrals + d.visits),
  );

  return (
    <div className="mx-auto max-w-5xl space-y-6 print:max-w-none print:space-y-4">
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
          Palaro Command
        </p>
        <h1 className="text-2xl font-bold tracking-tight">
          Operations Snapshot
        </h1>
        <p className="text-sm text-muted-foreground">
          {manilaDateLabel(r.from)} — {manilaDateLabel(r.to)} · Generated{" "}
          {generatedAt} by {profile.full_name ?? profile.email}
        </p>
      </header>

      <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Incidents" value={r.totals.incidents} />
        <Stat
          label="Critical"
          value={r.totals.critical}
          accent={r.totals.critical > 0}
        />
        <Stat label="Referrals" value={r.totals.referrals} />
        <Stat label="Clinic visits" value={r.totals.visits} />
      </section>

      <section className="space-y-3 break-inside-avoid">
        <h2 className="text-lg font-semibold">Daily volume</h2>
        <div className="rounded-md border p-4">
          <div
            className="grid items-end gap-1"
            style={{
              gridTemplateColumns: `repeat(${r.days.length}, minmax(20px, 1fr))`,
              minHeight: "180px",
            }}
          >
            {r.days.map((d) => {
              const total = d.incidents + d.referrals + d.visits;
              const incH = (d.incidents / peak) * 100;
              const refH = (d.referrals / peak) * 100;
              const visH = (d.visits / peak) * 100;
              return (
                <div
                  key={d.date}
                  className="group flex flex-col justify-end gap-0.5"
                  title={`${d.date} — incidents ${d.incidents}, referrals ${d.referrals}, visits ${d.visits}`}
                >
                  <div
                    className="rounded-t bg-yellow-400/70"
                    style={{ height: `${incH}%` }}
                  />
                  <div
                    className="bg-violet-400/70"
                    style={{ height: `${refH}%` }}
                  />
                  <div
                    className="rounded-b bg-blue-400/70"
                    style={{ height: `${visH}%` }}
                  />
                  <div className="text-center font-mono text-[9px] text-muted-foreground">
                    {d.date.slice(5)}
                  </div>
                  {total > 0 ? (
                    <div className="text-center font-mono text-[10px] font-semibold text-foreground">
                      {total}
                    </div>
                  ) : (
                    <div className="h-3" />
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <LegendChip color="bg-yellow-400/70" label="Incidents" />
            <LegendChip color="bg-violet-400/70" label="Referrals" />
            <LegendChip color="bg-blue-400/70" label="Clinic visits" />
          </div>
        </div>
      </section>

      <section className="space-y-3 break-inside-avoid">
        <h2 className="text-lg font-semibold">Daily breakdown</h2>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
              <th className="py-2 font-medium">Date</th>
              <th className="py-2 text-right font-medium">Incidents</th>
              <th className="py-2 text-right font-medium">Critical</th>
              <th className="py-2 text-right font-medium">Referrals</th>
              <th className="py-2 text-right font-medium">Clinic visits</th>
            </tr>
          </thead>
          <tbody>
            {r.days.map((d) => (
              <tr key={d.date} className="border-b">
                <td className="py-1.5 font-mono text-xs">{d.date}</td>
                <td className="py-1.5 text-right font-mono">{d.incidents}</td>
                <td
                  className={`py-1.5 text-right font-mono ${
                    d.critical > 0 ? "text-red-600 font-semibold" : ""
                  }`}
                >
                  {d.critical}
                </td>
                <td className="py-1.5 text-right font-mono">{d.referrals}</td>
                <td className="py-1.5 text-right font-mono">{d.visits}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <footer className="border-t pt-4 text-xs text-muted-foreground">
        Day boundaries follow Asia/Manila (UTC+8). Counts come from live
        operational data.
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
  accent?: boolean;
}) {
  return (
    <div className="rounded-md border p-4">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div
        className={`mt-1 text-3xl font-bold tracking-tight ${
          accent ? "text-red-600" : ""
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function LegendChip({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`inline-block size-3 rounded ${color}`} />
      <span>{label}</span>
    </div>
  );
}
