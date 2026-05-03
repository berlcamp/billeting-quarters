import { Plus } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Forbidden } from "@/components/shared/forbidden";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DayGrid } from "@/components/venues/day-grid";
import { DayPicker } from "@/components/venues/day-picker";
import { ScheduleFormDialog } from "@/components/venues/schedule-form-dialog";
import { ScheduleTable } from "@/components/venues/schedule-table";
import { getDelegations } from "@/lib/actions/delegations";
import { getSites } from "@/lib/actions/sites";
import { getSchedules } from "@/lib/actions/venues";
import { getCurrentProfile } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions";
import { manilaDayBoundsUtc, todayInManila } from "@/lib/timezone";

interface PageProps {
  searchParams: Promise<{ date?: string }>;
}

export default async function VenuesPage({ searchParams }: PageProps) {
  const profile = await getCurrentProfile();
  const canBook = !!profile && hasPermission(profile, "venue.book");
  const canApprove =
    !!profile && hasPermission(profile, "venue.approve_special");

  if (!canBook && !canApprove) {
    return (
      <Forbidden message="Venues requires venue.book or venue.approve_special permission." />
    );
  }

  const sp = await searchParams;
  const date =
    sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : todayInManila();
  const { startUtc, endUtc } = manilaDayBoundsUtc(date);

  const [sitesRes, delegationsRes, daySchedulesRes, allSchedulesRes] =
    await Promise.all([
      getSites(false),
      getDelegations(false),
      getSchedules(startUtc, endUtc),
      getSchedules(),
    ]);

  const sites = sitesRes.error ? [] : (sitesRes.data ?? []);
  const venues = sites.filter((s) => s.site_type === "playing_venue");
  const delegations = delegationsRes.error ? [] : (delegationsRes.data ?? []);
  const daySchedules = daySchedulesRes.error
    ? []
    : (daySchedulesRes.data ?? []);
  const allSchedules = allSchedulesRes.error
    ? []
    : (allSchedulesRes.data ?? []);

  const pendingApprovals = allSchedules.filter(
    (s) => s.status === "special_request",
  ).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Venues"
        description="Practice slot booking and special venue requests."
        actions={
          canBook ? (
            <ScheduleFormDialog
              venues={venues}
              delegations={delegations}
              trigger={
                <Button>
                  <Plus className="size-4" />
                  Book slot
                </Button>
              }
            />
          ) : undefined
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Playing venues" value={venues.length} />
        <StatCard label="Bookings on this day" value={daySchedules.length} />
        <StatCard
          label="Pending special requests"
          value={pendingApprovals}
          accent={pendingApprovals > 0}
        />
      </div>

      <Tabs defaultValue="grid">
        <TabsList>
          <TabsTrigger value="grid">Day grid</TabsTrigger>
          <TabsTrigger value="all">All bookings</TabsTrigger>
        </TabsList>

        <TabsContent value="grid" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
              <div>
                <CardTitle className="text-base">Practice schedule</CardTitle>
                <CardDescription>
                  Click an empty cell to book; click an existing slot to edit.
                </CardDescription>
              </div>
              <DayPicker date={date} />
            </CardHeader>
            <CardContent>
              <DayGrid
                date={date}
                venues={venues}
                delegations={delegations}
                schedules={daySchedules}
                canBook={canBook}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="all" className="mt-4">
          <ScheduleTable
            schedules={allSchedules}
            venues={venues}
            delegations={delegations}
            canBook={canBook}
            canApprove={canApprove}
          />
        </TabsContent>
      </Tabs>
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
          accent ? "text-yellow-600" : "text-foreground"
        }`}
      >
        {value}
      </div>
    </div>
  );
}
