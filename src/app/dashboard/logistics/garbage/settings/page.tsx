import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Forbidden } from "@/components/shared/forbidden";
import { Button, buttonVariants } from "@/components/ui/button";
import { CollectorDialog } from "@/components/garbage/collector-dialog";
import { CollectorsTable } from "@/components/garbage/collectors-table";
import { ScheduleRuleDialog } from "@/components/garbage/schedule-rule-dialog";
import { ScheduleRulesTable } from "@/components/garbage/schedule-rules-table";
import {
  getGarbageCollectors,
  getGarbageScheduleRules,
} from "@/lib/actions/garbage";
import { getSites } from "@/lib/actions/sites";
import { getCurrentProfile } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions";

export default async function GarbageSettingsPage() {
  const profile = await getCurrentProfile();
  if (!profile || !hasPermission(profile, "garbage.manage")) {
    return (
      <Forbidden message="Garbage settings require the garbage.manage permission." />
    );
  }

  const [collectorsRes, rulesRes, sitesRes] = await Promise.all([
    getGarbageCollectors(true),
    getGarbageScheduleRules(true),
    getSites(false),
  ]);

  const collectors = collectorsRes.error ? [] : (collectorsRes.data ?? []);
  const rules = rulesRes.error ? [] : (rulesRes.data ?? []);
  const sites = sitesRes.error ? [] : (sitesRes.data ?? []);
  const activeCollectors = collectors.filter((c) => c.is_active);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Garbage settings"
        description="Manage collectors and the recurring weekly schedule. Each week's pickups are generated from the active rules below."
        actions={
          <Link
            href="/dashboard/logistics/garbage"
            className={buttonVariants({ variant: "outline", size: "sm" })}
          >
            <ArrowLeft className="size-4" />
            Back to weekly view
          </Link>
        }
      />

      <section className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Collectors</h2>
            <p className="text-sm text-muted-foreground">
              Coordinator, vehicle, and contact for each pickup crew.
            </p>
          </div>
          <CollectorDialog />
        </div>
        <CollectorsTable collectors={collectors} />
      </section>

      <section className="space-y-3">
        <div className="flex items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">
              Weekly schedule rules
            </h2>
            <p className="text-sm text-muted-foreground">
              Day, time, collector, and site. Rules repeat every week and drive
              the auto-generated weekly view.
            </p>
          </div>
          {activeCollectors.length > 0 && sites.length > 0 ? (
            <ScheduleRuleDialog
              collectors={activeCollectors}
              sites={sites}
            />
          ) : (
            <Button disabled variant="outline" size="sm">
              Add a collector and a site first
            </Button>
          )}
        </div>
        <ScheduleRulesTable
          rules={rules}
          collectors={collectors}
          sites={sites}
        />
      </section>
    </div>
  );
}
