import { ClipboardList, Plus, UsersRound, Moon } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Forbidden } from "@/components/shared/forbidden";
import { Button } from "@/components/ui/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { VisitFormDialog } from "@/components/site-monitoring/visit-form-dialog";
import { VisitsTable } from "@/components/site-monitoring/visits-table";
import { ExternalPersonnelFormDialog } from "@/components/site-monitoring/external-personnel-form-dialog";
import { ExternalPersonnelTable } from "@/components/site-monitoring/external-personnel-table";
import { EndOfDayFormDialog } from "@/components/site-monitoring/end-of-day-form-dialog";
import { EndOfDayTable } from "@/components/site-monitoring/end-of-day-table";
import { getCurrentProfile } from "@/lib/auth/session";
import { hasAnyPermission } from "@/lib/permissions";
import {
  getEndOfDayReports,
  getExternalPersonnel,
  getVisits,
} from "@/lib/actions/site-monitoring";
import { getSites } from "@/lib/actions/sites";

export default async function SiteMonitoringPage() {
  const profile = await getCurrentProfile();
  const canAccess =
    !!profile &&
    hasAnyPermission(profile, [
      "site_monitoring.log",
      "site_monitoring.manage",
      "external_personnel.log",
      "end_of_day.log",
    ]);
  if (!canAccess) {
    return (
      <Forbidden message="Site Monitoring requires the information_hub_officer or command_center role." />
    );
  }

  const [visitsRes, externalsRes, eodRes, sitesRes] = await Promise.all([
    getVisits(200),
    getExternalPersonnel(500),
    getEndOfDayReports(200),
    getSites(false),
  ]);
  const visits = visitsRes.error ? [] : (visitsRes.data ?? []);
  const externals = externalsRes.error ? [] : (externalsRes.data ?? []);
  const eod = eodRes.error ? [] : (eodRes.data ?? []);
  const sites = sitesRes.error ? [] : (sitesRes.data ?? []);

  // "Today" approximated in Manila local time.
  const phToday = new Date(new Date().getTime() + 8 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const visitsToday = visits.filter(
    (v) =>
      new Date(new Date(v.visited_at).getTime() + 8 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10) === phToday,
  ).length;
  const externalsToday = externals.filter(
    (l) =>
      new Date(new Date(l.logged_at).getTime() + 8 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10) === phToday,
  ).length;
  const eodToday = eod.filter((r) => r.report_date === phToday).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Site Monitoring"
        description="Information Hub officer log: site visits, external personnel, and the nightly end-of-day report."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Visits today"
          value={visitsToday}
          icon={<ClipboardList className="size-4" />}
        />
        <StatCard
          label="External personnel today"
          value={externalsToday}
          icon={<UsersRound className="size-4" />}
        />
        <StatCard
          label="EOD reports today"
          value={eodToday}
          icon={<Moon className="size-4" />}
        />
      </div>

      <Tabs defaultValue="visits">
        <TabsList>
          <TabsTrigger value="visits">Visits</TabsTrigger>
          <TabsTrigger value="externals">External personnel</TabsTrigger>
          <TabsTrigger value="eod">End of day</TabsTrigger>
        </TabsList>

        <TabsContent value="visits" className="mt-4">
          <div className="mb-3 flex justify-end">
            <VisitFormDialog
              sites={sites.map((s) => ({ id: s.id, name: s.name }))}
              trigger={
                <Button>
                  <Plus className="size-4" />
                  Log visit
                </Button>
              }
            />
          </div>
          <VisitsTable
            visits={visits}
            sites={sites.map((s) => ({ id: s.id, name: s.name }))}
            canEdit
          />
        </TabsContent>

        <TabsContent value="externals" className="mt-4">
          <div className="mb-3 flex justify-end">
            <ExternalPersonnelFormDialog
              sites={sites.map((s) => ({ id: s.id, name: s.name }))}
              trigger={
                <Button>
                  <Plus className="size-4" />
                  Log personnel
                </Button>
              }
            />
          </div>
          <ExternalPersonnelTable
            logs={externals}
            sites={sites.map((s) => ({ id: s.id, name: s.name }))}
            canEdit
          />
        </TabsContent>

        <TabsContent value="eod" className="mt-4">
          <div className="mb-3 flex justify-end">
            <EndOfDayFormDialog
              sites={sites.map((s) => ({
                id: s.id,
                name: s.name,
                site_type: s.site_type,
              }))}
              trigger={
                <Button>
                  <Plus className="size-4" />
                  New EOD report
                </Button>
              }
            />
          </div>
          <EndOfDayTable
            reports={eod}
            sites={sites.map((s) => ({
              id: s.id,
              name: s.name,
              site_type: s.site_type,
            }))}
            canEdit
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon?: React.ReactNode;
}) {
  return (
    <div className="rounded-md border p-4">
      <div className="flex items-center justify-between">
        <div className="text-xs uppercase tracking-wider text-muted-foreground">
          {label}
        </div>
        <div className="text-muted-foreground">{icon}</div>
      </div>
      <div className="mt-1 text-3xl font-bold tracking-tight">{value}</div>
    </div>
  );
}
