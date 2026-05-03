import { Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Forbidden } from "@/components/shared/forbidden";
import { Button } from "@/components/ui/button";
import { GarbageFormDialog } from "@/components/garbage/garbage-form-dialog";
import { GarbageTable } from "@/components/garbage/garbage-table";
import { getGarbageCollections } from "@/lib/actions/garbage";
import { getSites } from "@/lib/actions/sites";
import { getCurrentProfile } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions";

export default async function GarbageCollectionPage() {
  const profile = await getCurrentProfile();
  const canLog =
    !!profile &&
    (hasPermission(profile, "garbage.log") ||
      hasPermission(profile, "garbage.manage"));
  const canManage = !!profile && hasPermission(profile, "garbage.manage");

  if (!canLog) {
    return (
      <Forbidden message="Garbage collection requires garbage.log or garbage.manage permission." />
    );
  }

  const [rowsRes, sitesRes] = await Promise.all([
    getGarbageCollections(),
    getSites(false),
  ]);
  const rows = rowsRes.error ? [] : (rowsRes.data ?? []);
  const sites = sitesRes.error ? [] : (sitesRes.data ?? []);

  const nowMs = new Date().getTime();
  const overdue = rows.filter(
    (r) =>
      r.status === "scheduled" &&
      Date.parse(r.scheduled_at) < nowMs - 30 * 60 * 1000,
  ).length;
  const upcoming = rows.filter(
    (r) =>
      r.status === "scheduled" && Date.parse(r.scheduled_at) >= nowMs,
  ).length;
  const collectedToday = rows.filter(
    (r) =>
      r.status === "collected" &&
      r.collected_at &&
      Date.parse(r.collected_at) > nowMs - 24 * 60 * 60 * 1000,
  ).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Garbage Collection"
        description="Schedule pickups across all sites and log collection or misses."
        actions={
          canManage ? (
            <GarbageFormDialog
              sites={sites}
              trigger={
                <Button>
                  <Plus className="size-4" />
                  Schedule pickup
                </Button>
              }
            />
          ) : undefined
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Upcoming" value={upcoming} />
        <StatCard label="Overdue" value={overdue} accent={overdue > 0} />
        <StatCard label="Collected (24h)" value={collectedToday} />
      </div>

      <GarbageTable rows={rows} sites={sites} canManage={canManage} />
    </div>
  );
}

function StatCard({
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
          accent ? "text-orange-600" : "text-foreground"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
