import { PageHeader } from "@/components/layout/page-header";
import { Forbidden } from "@/components/shared/forbidden";
import { DtrRoster } from "@/components/personnel/dtr-roster";
import { getCurrentProfile } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions";
import {
  getAttendanceLogsForDtr,
  getPersonnelForIds,
} from "@/lib/actions/personnel";
import { manilaDayBoundsUtc, todayInManila } from "@/lib/timezone";

interface PageProps {
  searchParams: Promise<{ from?: string; to?: string }>;
}

const YMD = /^\d{4}-\d{2}-\d{2}$/;

// Default DTR window = last 7 days ending today (Asia/Manila).
function defaultRange(today: string): { from: string; to: string } {
  const [y, m, d] = today.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, d, 12) - 6 * 86_400_000);
  const yy = start.getUTCFullYear();
  const mm = String(start.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(start.getUTCDate()).padStart(2, "0");
  return { from: `${yy}-${mm}-${dd}`, to: today };
}

export default async function DtrPage({ searchParams }: PageProps) {
  const profile = await getCurrentProfile();
  if (!profile || !hasPermission(profile, "personnel.manage")) {
    return (
      <Forbidden message="DTR generator requires the personnel.manage permission." />
    );
  }

  const sp = await searchParams;
  const today = todayInManila();
  const fallback = defaultRange(today);
  const from = sp.from && YMD.test(sp.from) ? sp.from : fallback.from;
  const to = sp.to && YMD.test(sp.to) ? sp.to : fallback.to;
  // Guard: from must be ≤ to. If reversed, swap.
  const [lo, hi] = from <= to ? [from, to] : [to, from];

  const { startUtc } = manilaDayBoundsUtc(lo);
  const { endUtc } = manilaDayBoundsUtc(hi);

  const [personnelRes, logsRes] = await Promise.all([
    getPersonnelForIds(),
    getAttendanceLogsForDtr(startUtc, endUtc),
  ]);

  const personnel = personnelRes.error ? [] : (personnelRes.data ?? []);
  const logs = logsRes.error ? [] : (logsRes.data ?? []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Daily Time Record"
        description="Generate CSC Form 48–style DTRs from attendance logs. Tick personnel and print all selected sheets in one run (each prints on its own page)."
      />
      {personnelRes.error || logsRes.error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          Failed to load DTR data:{" "}
          {personnelRes.error ?? logsRes.error}
        </div>
      ) : (
        <DtrRoster personnel={personnel} logs={logs} from={lo} to={hi} />
      )}
    </div>
  );
}
