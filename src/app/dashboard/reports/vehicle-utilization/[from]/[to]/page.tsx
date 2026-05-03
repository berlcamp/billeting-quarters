import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Printer } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Forbidden } from "@/components/shared/forbidden";
import { PrintButton } from "@/components/reports/print-button";
import { getCurrentProfile } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions";
import { getVehicleUtilizationReport } from "@/lib/actions/reports";
import { formatManila, manilaDateLabel } from "@/lib/timezone";
import { VEHICLE_TYPE_LABELS, type VehicleType } from "@/lib/labels";

interface PageProps {
  params: Promise<{ from: string; to: string }>;
}

export default async function VehicleUtilizationReportPage({
  params,
}: PageProps) {
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

  const result = await getVehicleUtilizationReport(from, to);
  if (result.error) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-destructive">{result.error}</p>
      </div>
    );
  }
  const r = result.data!;
  const generatedAt = formatManila(new Date(), "MMM d, yyyy · HH:mm 'PHT'");

  // p90 helps spot overcommitted shuttles vs. the long tail.
  const sorted = r.per_vehicle.map((v) => v.scans).sort((a, b) => a - b);
  const p90 = sorted.length
    ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.9))]
    : 0;
  const idle = r.per_vehicle.filter((v) => v.scans === 0).length;

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
          Vehicle Utilization
        </h1>
        <p className="text-sm text-muted-foreground">
          {manilaDateLabel(r.from)} — {manilaDateLabel(r.to)} · Generated{" "}
          {generatedAt} by {profile.full_name ?? profile.email}
        </p>
      </header>

      <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Total scans" value={r.totals.scans} />
        <Stat label="Check-ins" value={r.totals.in_scans} />
        <Stat label="Check-outs" value={r.totals.out_scans} />
        <Stat label="Idle vehicles" value={idle} accent={idle > 0} />
      </section>

      <section className="space-y-3 break-inside-avoid">
        <h2 className="text-lg font-semibold">Per-vehicle activity</h2>
        <p className="text-xs text-muted-foreground">
          Sorted by scan volume. Vehicles at or above the 90th percentile
          ({p90} scans) are highlighted as overcommitted.
        </p>
        {r.per_vehicle.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No registered vehicles in the system.
          </p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="py-2 font-medium">Vehicle</th>
                <th className="py-2 font-medium">Type</th>
                <th className="py-2 text-right font-medium">Scans</th>
                <th className="py-2 text-right font-medium">In</th>
                <th className="py-2 text-right font-medium">Out</th>
                <th className="py-2 text-right font-medium">Last seen</th>
              </tr>
            </thead>
            <tbody>
              {r.per_vehicle.map((v) => {
                const overcommitted = v.scans > 0 && v.scans >= p90 && p90 > 0;
                return (
                  <tr
                    key={v.vehicle_id}
                    className={`border-b ${
                      overcommitted ? "bg-orange-50/60" : ""
                    }`}
                  >
                    <td className="py-1.5 font-mono">{v.vehicle_code}</td>
                    <td className="py-1.5">
                      {VEHICLE_TYPE_LABELS[v.vehicle_type as VehicleType] ??
                        v.vehicle_type}
                    </td>
                    <td className="py-1.5 text-right font-mono font-semibold">
                      {v.scans}
                    </td>
                    <td className="py-1.5 text-right font-mono">{v.in_scans}</td>
                    <td className="py-1.5 text-right font-mono">{v.out_scans}</td>
                    <td className="py-1.5 text-right font-mono text-xs">
                      {v.last_scan_at
                        ? formatManila(v.last_scan_at, "MMM d · HH:mm")
                        : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <section className="space-y-3 break-inside-avoid">
        <h2 className="text-lg font-semibold">Per-site scan volume</h2>
        {r.per_site.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No vehicle scans recorded in this window.
          </p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="py-2 font-medium">Site</th>
                <th className="py-2 text-right font-medium">Scans</th>
                <th className="py-2 text-right font-medium">% of total</th>
              </tr>
            </thead>
            <tbody>
              {r.per_site.map((s) => {
                const pct =
                  r.totals.scans > 0
                    ? Math.round((s.scans / r.totals.scans) * 100)
                    : 0;
                return (
                  <tr key={s.site_id} className="border-b">
                    <td className="py-1.5">{s.site_name}</td>
                    <td className="py-1.5 text-right font-mono">{s.scans}</td>
                    <td className="py-1.5 text-right text-xs text-muted-foreground">
                      {pct}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <footer className="border-t pt-4 text-xs text-muted-foreground">
        A QR scan equals one in or out event. Idle vehicles may indicate
        misallocation or driver-side issues — verify before reassigning.
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
          accent ? "text-orange-600" : ""
        }`}
      >
        {value}
      </div>
    </div>
  );
}
