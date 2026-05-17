import { notFound } from "next/navigation";
import { Fraunces } from "next/font/google";
import { DrawBoard } from "@/components/raffle/draw/draw-board";
import { getRaffle, getRaffleEntries } from "@/lib/actions/raffle";
import { requireActiveProfile } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
});

export default async function RaffleDrawPage({
  params,
}: {
  params: Promise<{ raffleId: string }>;
}) {
  const { raffleId } = await params;
  const profile = await requireActiveProfile();
  if (!hasPermission(profile, "raffle.draw")) {
    return (
      <div className="min-h-screen bg-[#0a1740] text-white">
        <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
          <h1 className="text-2xl font-semibold">Access denied</h1>
          <p className="text-sm text-white/70">
            You don&apos;t have permission to run the raffle draw.
          </p>
        </div>
      </div>
    );
  }

  const [detail, entries] = await Promise.all([
    getRaffle(raffleId),
    getRaffleEntries(raffleId),
  ]);

  if (detail.error || !detail.data) {
    notFound();
  }

  const departments = detail.data.departments.map((d) => ({
    id: d.id,
    name: d.name,
    entry_count: d.entry_count,
  }));

  return (
    <div className={`${fraunces.variable} min-h-screen bg-[#0a1740]`}>
      <DrawBoard
        raffle={{
          id: detail.data.raffle.id,
          name: detail.data.raffle.name,
        }}
        departments={departments}
        entries={entries.error ? [] : entries.data ?? []}
      />
    </div>
  );
}
