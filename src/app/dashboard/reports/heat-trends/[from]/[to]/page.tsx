import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Printer } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Forbidden } from "@/components/shared/forbidden";
import { PrintButton } from "@/components/reports/print-button";
import { getCurrentProfile } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions";
import { getHeatTrendsReport } from "@/lib/actions/reports";
import { formatManila, manilaDateLabel } from "@/lib/timezone";
import { HEAT_DANGER_LABELS } from "@/lib/heat-index";

interface PageProps {
  params: Promise<{ from: string; to: string }>;
}

const HEAT_DANGER_BADGE: Record<string, string> = {
  caution: "bg-yellow-100 text-yellow-800",
  extreme_caution: "bg-orange-100 text-orange-800",
  danger: "bg-red-100 text-red-800",
  extreme_danger: "bg-red-200 text-red-900 font-semibold",
};

export default async function HeatTrendsReportPage({ params }: PageProps) {
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

  const result = await getHeatTrendsReport(from, to);
  if (result.error) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-destructive">{result.error}</p>
      </div>
    );
  }
  const r = result.data!;
  const generatedAt = formatManila(new Date(), "MMM d, yyyy · HH:mm 'PHT'");
  const totalSuspensions = r.suspension_events.length;
  const venuesAtRisk = r.rows.filter((row) => row.suspension_days > 0).length;

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
          Heat-Index Trends
        </h1>
        <p className="text-sm text-muted-foreground">
          {manilaDateLabel(r.from)} — {manilaDateLabel(r.to)} · Generated{" "}
          {generatedAt} by {profile.full_name ?? profile.email}
        </p>
      </header>

      <section className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Stat label="Sites tracked" value={r.rows.length} />
        <Stat
          label="Venues w/ suspension day"
          value={venuesAtRisk}
          accent={venuesAtRisk > 0}
        />
        <Stat
          label="Suspension events"
          value={totalSuspensions}
          critical={totalSuspensions > 0}
        />
      </section>

      <section className="space-y-3 break-inside-avoid">
        <h2 className="text-lg font-semibold">Daily peak by venue</h2>
        {r.rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No heat-index readings logged in this window.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-b bg-muted/40 text-left uppercase tracking-wider text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Site</th>
                  {r.rows[0].days.map((d) => (
                    <th
                      key={d.date}
                      className="px-2 py-2 text-center font-mono font-medium"
                    >
                      {d.date.slice(5)}
                    </th>
                  ))}
                  <th className="px-3 py-2 text-right font-medium">Peak</th>
                </tr>
              </thead>
              <tbody>
                {r.rows.map((row) => (
                  <tr key={row.site_id} className="border-b">
                    <td className="px-3 py-1.5 font-medium">{row.site_name}</td>
                    {row.days.map((d) => (
                      <td
                        key={d.date}
                        className={`px-2 py-1.5 text-center font-mono ${
                          d.suspension_recommended
                            ? "bg-red-100 font-semibold text-red-800"
                            : ""
                        }`}
                      >
                        {d.max_heat_c !== null
                          ? d.max_heat_c.toFixed(1)
                          : "—"}
                      </td>
                    ))}
                    <td className="px-3 py-1.5 text-right font-mono font-semibold">
                      {row.overall_peak_c !== null
                        ? `${row.overall_peak_c.toFixed(1)}°C`
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-3 break-inside-avoid">
        <h2 className="text-lg font-semibold">Suspension events</h2>
        {r.suspension_events.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No game-suspension flags raised in this window.
          </p>
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="py-2 font-medium">When (PHT)</th>
                <th className="py-2 font-medium">Site</th>
                <th className="py-2 text-right font-medium">Heat index</th>
                <th className="py-2 text-right font-medium">Danger level</th>
              </tr>
            </thead>
            <tbody>
              {r.suspension_events.map((e) => {
                const badgeCls =
                  e.danger_level && HEAT_DANGER_BADGE[e.danger_level]
                    ? HEAT_DANGER_BADGE[e.danger_level]
                    : "bg-gray-100 text-gray-700";
                const dangerLabel =
                  e.danger_level && e.danger_level in HEAT_DANGER_LABELS
                    ? HEAT_DANGER_LABELS[
                        e.danger_level as keyof typeof HEAT_DANGER_LABELS
                      ]
                    : (e.danger_level ?? "—");
                return (
                  <tr key={e.id} className="border-b">
                    <td className="py-1.5 font-mono text-xs">
                      {formatManila(e.recorded_at, "MMM d · HH:mm")}
                    </td>
                    <td className="py-1.5">{e.site_name}</td>
                    <td className="py-1.5 text-right font-mono">
                      {e.heat_index_c !== null
                        ? `${e.heat_index_c.toFixed(1)}°C`
                        : "—"}
                    </td>
                    <td className="py-1.5 text-right">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs ${badgeCls}`}
                      >
                        {dangerLabel}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <footer className="border-t pt-4 text-xs text-muted-foreground">
        Cells highlighted in red mark days where a game-suspension flag was
        raised at that venue. Heat indexes use the NWS formula.
      </footer>
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
  critical,
}: {
  label: string;
  value: number;
  accent?: boolean;
  critical?: boolean;
}) {
  return (
    <div className="rounded-md border p-4">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div
        className={`mt-1 text-3xl font-bold tracking-tight ${
          critical ? "text-red-600" : accent ? "text-orange-600" : ""
        }`}
      >
        {value}
      </div>
    </div>
  );
}
