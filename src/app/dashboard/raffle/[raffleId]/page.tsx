import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Forbidden } from "@/components/shared/forbidden";
import { PageHeader } from "@/components/layout/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RaffleFormDialog } from "@/components/raffle/raffle-form-dialog";
import { OpenDrawButton } from "@/components/raffle/open-draw-button";
import { DepartmentFormDialog } from "@/components/raffle/department-form-dialog";
import { DepartmentCard } from "@/components/raffle/department-card";
import { WinnersTable } from "@/components/raffle/winners-table";
import { getRaffle, getRaffleWinners } from "@/lib/actions/raffle";
import { getCurrentProfile } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions";

export default async function RaffleDetailPage({
  params,
}: {
  params: Promise<{ raffleId: string }>;
}) {
  const { raffleId } = await params;
  const profile = await getCurrentProfile();
  if (!profile || !hasPermission(profile, "raffle.view")) return <Forbidden />;

  const canManage = hasPermission(profile, "raffle.manage");
  const canDraw = hasPermission(profile, "raffle.draw");

  const [detail, winnersResult] = await Promise.all([
    getRaffle(raffleId),
    getRaffleWinners(raffleId),
  ]);

  if (detail.error || !detail.data) {
    return (
      <div className="space-y-6">
        <Link
          href="/dashboard/raffle"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          All raffles
        </Link>
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          {detail.error ?? "Raffle not found."}
        </div>
      </div>
    );
  }

  const { raffle, departments } = detail.data;
  const winners = winnersResult.error ? [] : winnersResult.data ?? [];
  const totalEntries = departments.reduce((s, d) => s + d.entry_count, 0);

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/raffle"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        All raffles
      </Link>

      <PageHeader
        title={raffle.name}
        description={
          raffle.description ??
          `${departments.length} department${departments.length === 1 ? "" : "s"} · ${totalEntries} entr${totalEntries === 1 ? "y" : "ies"}`
        }
        actions={
          <div className="flex items-center gap-2">
            {canManage ? <RaffleFormDialog raffle={raffle} /> : null}
            {canDraw && totalEntries > 0 ? (
              <OpenDrawButton raffleId={raffle.id} />
            ) : null}
          </div>
        }
      />

      <Tabs defaultValue="departments">
        <TabsList>
          <TabsTrigger value="departments">Departments &amp; Entries</TabsTrigger>
          <TabsTrigger value="winners">Winners ({winners.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="departments" className="space-y-4">
          {canManage ? (
            <div className="flex justify-end">
              <DepartmentFormDialog raffleId={raffle.id} />
            </div>
          ) : null}

          {departments.length === 0 ? (
            <div className="rounded-md border border-dashed p-12 text-center">
              <h3 className="font-semibold">No departments yet</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Add a department to start collecting entries.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {departments.map((d) => (
                <DepartmentCard
                  key={d.id}
                  department={d}
                  canManage={canManage}
                />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="winners">
          <WinnersTable
            winners={winners}
            raffleId={raffle.id}
            canManage={canManage}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
