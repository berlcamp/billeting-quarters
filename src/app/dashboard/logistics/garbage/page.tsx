import Link from "next/link";
import { ChevronLeft, ChevronRight, Settings } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Forbidden } from "@/components/shared/forbidden";
import { buttonVariants } from "@/components/ui/button";
import { WeeklySchedule } from "@/components/garbage/weekly-schedule";
import {
  generateGarbageWeek,
  getGarbageCollections,
  getGarbageCollectors,
} from "@/lib/actions/garbage";
import { getSites } from "@/lib/actions/sites";
import { getCurrentProfile } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions";
import {
  addDaysYmd,
  manilaWeekBoundsUtc,
  manilaWeekStart,
} from "@/lib/garbage-week";
import { formatManila } from "@/lib/timezone";

interface PageProps {
  searchParams: Promise<{ week?: string }>;
}

export default async function GarbageCollectionPage({ searchParams }: PageProps) {
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

  const sp = await searchParams;
  const weekStart =
    sp.week && /^\d{4}-\d{2}-\d{2}$/.test(sp.week)
      ? sp.week
      : manilaWeekStart();
  const prevWeek = addDaysYmd(weekStart, -7);
  const nextWeek = addDaysYmd(weekStart, 7);
  const today = manilaWeekStart();

  // Auto-materialize this week's pickups from the active rules. Idempotent —
  // the action queries existing rows and inserts only the missing combos.
  // Skip for non-managers (no permission). We capture the error so the page
  // can surface it instead of silently rendering empty.
  let generateError: string | null = null;
  if (canManage) {
    const genRes = await generateGarbageWeek({ week_start: weekStart });
    if (genRes.error) generateError = genRes.error;
  }

  const { startUtc, endUtc } = manilaWeekBoundsUtc(weekStart);
  const [collectionsRes, collectorsRes, sitesRes] = await Promise.all([
    getGarbageCollections(startUtc, endUtc),
    getGarbageCollectors(true),
    getSites(false),
  ]);

  const collections = collectionsRes.error ? [] : (collectionsRes.data ?? []);
  const collectors = collectorsRes.error ? [] : (collectorsRes.data ?? []);
  const sites = sitesRes.error ? [] : (sitesRes.data ?? []);

  const total = collections.length;
  const collected = collections.filter((c) => c.status === "collected").length;
  const remaining = total - collected;

  const weekEndYmd = addDaysYmd(weekStart, 6);
  const weekLabel = `${formatManila(`${weekStart}T04:00:00.000Z`, "MMM d")} – ${formatManila(`${weekEndYmd}T04:00:00.000Z`, "MMM d, yyyy")}`;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Garbage Collection"
        description="Auto-generated weekly pickups from your schedule rules. Tick off each pickup as it's collected."
        actions={
          canManage ? (
            <Link
              href="/dashboard/logistics/garbage/settings"
              className={buttonVariants({ variant: "outline", size: "sm" })}
            >
              <Settings className="size-4" />
              Settings
            </Link>
          ) : undefined
        }
      />

      {generateError ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          Couldn&apos;t auto-generate this week:{" "}
          <span className="font-mono text-xs">{generateError}</span>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-card px-3 py-2">
        <div className="flex items-center gap-2">
          <Link
            href={`/dashboard/logistics/garbage?week=${prevWeek}`}
            className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
            aria-label="Previous week"
          >
            <ChevronLeft className="size-4" />
          </Link>
          <div className="min-w-0">
            <div className="text-sm font-medium">{weekLabel}</div>
            <div className="text-xs text-muted-foreground">
              {collected} of {total} collected · {remaining} remaining
            </div>
          </div>
          <Link
            href={`/dashboard/logistics/garbage?week=${nextWeek}`}
            className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
            aria-label="Next week"
          >
            <ChevronRight className="size-4" />
          </Link>
        </div>
        {weekStart !== today ? (
          <Link
            href="/dashboard/logistics/garbage"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            This week
          </Link>
        ) : null}
      </div>

      {total === 0 ? (
        <div className="rounded-md border border-dashed p-8 text-center">
          <p className="text-sm font-medium">No pickups for this week.</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {canManage ? (
              <>
                Add collectors and weekly schedule rules in{" "}
                <Link
                  href="/dashboard/logistics/garbage/settings"
                  className="underline underline-offset-2"
                >
                  Settings
                </Link>{" "}
                — this view fills in automatically.
              </>
            ) : (
              "Once schedule rules are added, the week populates automatically."
            )}
          </p>
        </div>
      ) : (
        <WeeklySchedule
          weekStart={weekStart}
          collections={collections}
          collectors={collectors}
          sites={sites}
          canLog={canLog}
        />
      )}
    </div>
  );
}
