import { Plus, UserCog } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Forbidden } from "@/components/shared/forbidden";
import { LiveBadge } from "@/components/shared/live-badge";
import { Button } from "@/components/ui/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { LogMovementDialog } from "@/components/vip/log-movement-dialog";
import { MovementsTable } from "@/components/vip/movements-table";
import { VipFormDialog } from "@/components/vip/vip-form-dialog";
import { VipsTable } from "@/components/vip/vips-table";
import { getCurrentProfile } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions";
import { getMovements, getVips } from "@/lib/actions/vip";
import { getDelegations } from "@/lib/actions/delegations";
import { getSites } from "@/lib/actions/sites";

export default async function VipPage() {
  const profile = await getCurrentProfile();
  if (!profile || !hasPermission(profile, "vip.manage")) {
    return (
      <Forbidden message="VIP tracking requires the vip.manage permission." />
    );
  }

  const [vipsRes, movementsRes, sitesRes, delegationsRes] = await Promise.all([
    getVips(false),
    getMovements(200),
    getSites(false),
    getDelegations(false),
  ]);

  const vips = vipsRes.error ? [] : (vipsRes.data ?? []);
  const movements = movementsRes.error ? [] : (movementsRes.data ?? []);
  const sites = sitesRes.error ? [] : (sitesRes.data ?? []);
  const delegations = delegationsRes.error ? [] : (delegationsRes.data ?? []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="VIP Tracking"
        description="Estimated and actual arrivals/departures for protocol officers and command center."
        actions={
          <div className="flex items-center gap-2">
            <VipFormDialog
              delegations={delegations}
              trigger={
                <Button variant="outline">
                  <UserCog className="size-4" />
                  Add VIP
                </Button>
              }
            />
            <LogMovementDialog vips={vips} sites={sites} />
          </div>
        }
      />

      <Tabs defaultValue="movements">
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="movements">Movements</TabsTrigger>
            <TabsTrigger value="vips">VIPs ({vips.length})</TabsTrigger>
          </TabsList>
          <LiveBadge label="Live" />
        </div>

        <TabsContent value="movements" className="mt-4">
          <MovementsTable
            initialMovements={movements}
            vips={vips}
            sites={sites}
          />
        </TabsContent>

        <TabsContent value="vips" className="mt-4">
          <div className="mb-3 flex items-center justify-end">
            <VipFormDialog
              delegations={delegations}
              trigger={
                <Button size="sm" variant="outline">
                  <Plus className="size-4" />
                  Add VIP
                </Button>
              }
            />
          </div>
          <VipsTable vips={vips} delegations={delegations} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
