import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Printer } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Forbidden } from "@/components/shared/forbidden";
import { PrintButton } from "@/components/reports/print-button";
import { getCurrentProfile } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions";
import { getDelegationSummaryReport } from "@/lib/actions/reports";
import { formatManila, manilaDateLabel } from "@/lib/timezone";

interface PageProps {
  params: Promise<{ from: string; to: string }>;
}

export default async function PerDelegationReportPage({ params }: PageProps) {
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

  const result = await getDelegationSummaryReport(from, to);
  if (result.error) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-destructive">{result.error}</p>
      </div>
    );
  }
  const r = result.data!;
  const generatedAt = formatManila(new Date(), "MMM d, yyyy · HH:mm 'PHT'");

  const totals = r.rows.reduce(
    (acc, row) => ({
      incidents: acc.incidents + row.incidents,
      referrals: acc.referrals + row.referrals,
      vip_movements: acc.vip_movements + row.vip_movements,
      venue_bookings: acc.venue_bookings + row.venue_bookings,
      clinic_visits: acc.clinic_visits + row.clinic_visits,
    }),
    {
      incidents: 0,
      referrals: 0,
      vip_movements: 0,
      venue_bookings: 0,
      clinic_visits: 0,
    },
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
          Per-Delegation Summary
        </h1>
        <p className="text-sm text-muted-foreground">
          {manilaDateLabel(r.from)} — {manilaDateLabel(r.to)} · Generated{" "}
          {generatedAt} by {profile.full_name ?? profile.email}
        </p>
      </header>

      <section className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <Stat label="Incidents" value={totals.incidents} />
        <Stat label="Referrals" value={totals.referrals} />
        <Stat label="VIP movements" value={totals.vip_movements} />
        <Stat label="Bookings" value={totals.venue_bookings} />
        <Stat label="Clinic visits" value={totals.clinic_visits} />
      </section>

      <section className="space-y-3 break-inside-avoid">
        <h2 className="text-lg font-semibold">By region</h2>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
              <th className="py-2 font-medium">Region</th>
              <th className="py-2 text-right font-medium">Incidents</th>
              <th className="py-2 text-right font-medium">Referrals</th>
              <th className="py-2 text-right font-medium">VIP moves</th>
              <th className="py-2 text-right font-medium">Bookings</th>
              <th className="py-2 text-right font-medium">Clinic visits</th>
            </tr>
          </thead>
          <tbody>
            {r.rows.map((row) => {
              const total =
                row.incidents +
                row.referrals +
                row.vip_movements +
                row.venue_bookings +
                row.clinic_visits;
              const isQuiet = total === 0;
              return (
                <tr
                  key={row.delegation_id}
                  className={`border-b ${isQuiet ? "text-muted-foreground" : ""}`}
                >
                  <td className="py-1.5">
                    <span className="font-mono font-semibold">
                      {row.region_code}
                    </span>{" "}
                    <span className="text-xs">— {row.region_name}</span>
                  </td>
                  <td className="py-1.5 text-right font-mono">
                    {row.incidents}
                  </td>
                  <td className="py-1.5 text-right font-mono">
                    {row.referrals}
                  </td>
                  <td className="py-1.5 text-right font-mono">
                    {row.vip_movements}
                  </td>
                  <td className="py-1.5 text-right font-mono">
                    {row.venue_bookings}
                  </td>
                  <td className="py-1.5 text-right font-mono">
                    {row.clinic_visits}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 font-semibold">
              <td className="py-2">Total</td>
              <td className="py-2 text-right font-mono">{totals.incidents}</td>
              <td className="py-2 text-right font-mono">{totals.referrals}</td>
              <td className="py-2 text-right font-mono">
                {totals.vip_movements}
              </td>
              <td className="py-2 text-right font-mono">
                {totals.venue_bookings}
              </td>
              <td className="py-2 text-right font-mono">
                {totals.clinic_visits}
              </td>
            </tr>
          </tfoot>
        </table>
      </section>

      <footer className="border-t pt-4 text-xs text-muted-foreground">
        Linkages: incidents and referrals attribute by delegation_id directly;
        VIP movements via vip_persons.delegation_id; clinic visits via the
        patient&apos;s delegation. Delegation heads see the read-only view of
        their own region.
      </footer>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border p-4">
      <div className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-3xl font-bold tracking-tight">{value}</div>
    </div>
  );
}
