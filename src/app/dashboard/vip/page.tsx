import Link from "next/link";
import { Plus, UserCog, X } from "lucide-react";
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
import { hasPermission, isSuperAdmin } from "@/lib/permissions";
import {
  getMovements,
  getProfilesByIds,
  getProtocolOfficerCandidates,
  getVips,
} from "@/lib/actions/vip";
import { getDelegations } from "@/lib/actions/delegations";
import { getSites } from "@/lib/actions/sites";

export default async function VipPage({
  searchParams,
}: {
  searchParams?: Promise<{ vip?: string; tab?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const profile = await getCurrentProfile();
  if (!profile || !hasPermission(profile, "vip.manage")) {
    return (
      <Forbidden message="VIP tracking requires the vip.manage permission." />
    );
  }

  const isProtocolOfficer = profile.roles.includes("protocol_officer");
  const isBroadViewer = profile.roles.some(
    (r) => r === "command_center" || r === "super_admin",
  );

  const [vipsRes, movementsRes, sitesRes, delegationsRes, officersRes] =
    await Promise.all([
      getVips(false),
      getMovements(200),
      getSites(false),
      getDelegations(false),
      getProtocolOfficerCandidates(),
    ]);

  const vips = vipsRes.error ? [] : (vipsRes.data ?? []);
  const allMovements = movementsRes.error ? [] : (movementsRes.data ?? []);
  const sites = sitesRes.error ? [] : (sitesRes.data ?? []);
  const delegations = delegationsRes.error ? [] : (delegationsRes.data ?? []);
  const officers =
    officersRes.error || !officersRes.data ? [] : officersRes.data;

  // When ?vip=<id> is present, scope the movements tab to that VIP and
  // default to the movements tab.
  const focusedVip = params.vip
    ? vips.find((v) => v.id === params.vip) ?? null
    : null;
  const movements = focusedVip
    ? allMovements.filter((m) => m.vip_id === focusedVip.id)
    : allMovements;
  const defaultTab = focusedVip ? "movements" : params.tab ?? "movements";

  // Resolve creator/protocol-officer profile names referenced by movements.
  // Combines created_by (new) and protocol_officer_id (legacy fallback).
  const creatorIds = Array.from(
    new Set(
      movements.flatMap((m) =>
        [m.created_by, m.protocol_officer_id].filter(
          (v): v is string => Boolean(v),
        ),
      ),
    ),
  );
  const movementProfilesRes =
    creatorIds.length > 0 ? await getProfilesByIds(creatorIds) : { data: [] };
  const movementProfiles =
    "data" in movementProfilesRes && movementProfilesRes.data
      ? movementProfilesRes.data
      : [];

  // Command Center / Super Admin create and assign VIPs. Protocol Officers
  // log movements for the VIPs assigned to them.
  const canCreateVip = isBroadViewer;
  const canLogMovement = isProtocolOfficer && vips.length > 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="VIP Tracking"
        description={
          isBroadViewer
            ? "Create and assign VIPs to Protocol Officers; monitor every movement across the event."
            : "VIPs assigned to you. Log movements as they arrive and depart."
        }
        actions={
          <div className="flex items-center gap-2">
            {canCreateVip ? (
              <VipFormDialog
                delegations={delegations}
                protocolOfficers={officers}
                trigger={
                  <Button variant="outline">
                    <UserCog className="size-4" />
                    Add VIP
                  </Button>
                }
              />
            ) : null}
            {canLogMovement ? (
              <LogMovementDialog vips={vips} sites={sites} />
            ) : null}
          </div>
        }
      />

      <Tabs defaultValue={defaultTab}>
        <div className="flex items-center justify-between">
          <TabsList>
            <TabsTrigger value="movements">Movements</TabsTrigger>
            <TabsTrigger value="vips">VIPs ({vips.length})</TabsTrigger>
          </TabsList>
          <LiveBadge label="Live" />
        </div>

        <TabsContent value="movements" className="mt-4 space-y-3">
          {focusedVip ? (
            <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2 text-sm">
              <div>
                Showing movements for{" "}
                <span className="font-semibold">{focusedVip.full_name}</span>
                {focusedVip.title ? (
                  <span className="text-muted-foreground">
                    {" "}
                    · {focusedVip.title}
                  </span>
                ) : null}
              </div>
              <Link
                href="/dashboard/vip"
                className="inline-flex items-center gap-1 rounded-md border bg-background px-2 py-1 text-xs hover:bg-muted"
              >
                <X className="size-3.5" />
                Clear filter
              </Link>
            </div>
          ) : null}
          <MovementsTable
            initialMovements={movements}
            vips={vips}
            sites={sites}
            profiles={movementProfiles}
            currentProfileId={profile.id}
            isSuperAdmin={isSuperAdmin(profile)}
          />
        </TabsContent>

        <TabsContent value="vips" className="mt-4">
          {canCreateVip ? (
            <div className="mb-3 flex items-center justify-end">
              <VipFormDialog
                delegations={delegations}
                protocolOfficers={officers}
                trigger={
                  <Button size="sm" variant="outline">
                    <Plus className="size-4" />
                    Add VIP
                  </Button>
                }
              />
            </div>
          ) : null}
          <VipsTable
            vips={vips}
            delegations={delegations}
            protocolOfficers={officers}
            canAssign={canCreateVip}
            canEdit={canCreateVip}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
