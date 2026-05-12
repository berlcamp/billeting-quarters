"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useRealtimePostgresChanges } from "@/lib/hooks/use-realtime";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { MovementDetailsDialog } from "./movement-details-dialog";
import { cn } from "@/lib/utils";
import {
  ACTIVE_VIP_STATUSES,
  VIP_MOVEMENT_STATUS_BADGE,
  VIP_MOVEMENT_STATUS_LABELS,
  type VipMovementStatus,
} from "@/lib/labels";
import { formatManila } from "@/lib/timezone";
import type { Database } from "@/types/database";

type Movement = Database["palaro"]["Tables"]["vip_movements"]["Row"];
type Vip = Pick<
  Database["palaro"]["Tables"]["vip_persons"]["Row"],
  "id" | "full_name" | "title" | "organization"
>;
type Site = Pick<Database["palaro"]["Tables"]["sites"]["Row"], "id" | "name">;
type ProfileLite = {
  id: string;
  full_name: string | null;
  email: string;
};

interface Props {
  initialMovements: Movement[];
  vips: Vip[];
  sites: Site[];
  profiles: ProfileLite[];
  // The signed-in profile id. Used to gate which rows expose action buttons.
  currentProfileId: string;
  // True if the viewer is super_admin — bypasses creator gate.
  isSuperAdmin: boolean;
}

const ACTIVE = new Set<VipMovementStatus>(ACTIVE_VIP_STATUSES);

export function MovementsTable({
  initialMovements,
  vips,
  sites,
  profiles,
  currentProfileId,
  isSuperAdmin,
}: Props) {
  const router = useRouter();
  const [showClosed, setShowClosed] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const vipMap = useMemo(() => {
    const m = new Map<string, Vip>();
    for (const v of vips) m.set(v.id, v);
    return m;
  }, [vips]);
  const siteMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of sites) m.set(s.id, s.name);
    return m;
  }, [sites]);
  const profileMap = useMemo(() => {
    const m = new Map<string, ProfileLite>();
    for (const p of profiles) m.set(p.id, p);
    return m;
  }, [profiles]);

  function creatorIdOf(m: Movement): string | null {
    return m.created_by ?? m.protocol_officer_id ?? null;
  }
  function isOwnerOf(m: Movement): boolean {
    if (isSuperAdmin) return true;
    const cid = creatorIdOf(m);
    return cid != null && cid === currentProfileId;
  }

  // Realtime: any change → re-fetch the server-rendered page. Don't keep a
  // local copy of `initialMovements` in useState — the prop won't sync after
  // router.refresh(), so the table goes stale on every server-side update.
  useRealtimePostgresChanges<Movement>(
    { schema: "palaro", table: "vip_movements", event: "*" },
    () => {
      router.refresh();
    },
  );

  const visible = useMemo(() => {
    const filtered = showClosed
      ? initialMovements
      : initialMovements.filter((m) =>
          ACTIVE.has(m.status as VipMovementStatus),
        );
    // Active first by ETA, then closed by most recent update.
    return [...filtered].sort((a, b) => {
      const aActive = ACTIVE.has(a.status as VipMovementStatus);
      const bActive = ACTIVE.has(b.status as VipMovementStatus);
      if (aActive !== bActive) return aActive ? -1 : 1;
      if (aActive) {
        return (
          new Date(a.estimated_arrival ?? a.created_at).getTime() -
          new Date(b.estimated_arrival ?? b.created_at).getTime()
        );
      }
      return (
        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );
    });
  }, [initialMovements, showClosed]);

  const columns: DataTableColumn<Movement>[] = [
    {
      id: "vip",
      header: "VIP",
      cell: (m) => {
        const vip = vipMap.get(m.vip_id);
        return (
          <div className="flex flex-col">
            <span className="font-medium">
              {vip?.full_name ?? "Unknown VIP"}
            </span>
            {vip?.title || vip?.organization ? (
              <span className="text-xs text-muted-foreground">
                {[vip?.title, vip?.organization].filter(Boolean).join(" · ")}
              </span>
            ) : null}
          </div>
        );
      },
    },
    {
      id: "destination",
      header: "Destination",
      cell: (m) =>
        m.destination_site_id ? (
          siteMap.get(m.destination_site_id) ?? "—"
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      id: "status",
      header: "Status",
      cell: (m) => {
        const s = m.status as VipMovementStatus;
        return (
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-xs font-medium",
              VIP_MOVEMENT_STATUS_BADGE[s],
            )}
          >
            {VIP_MOVEMENT_STATUS_LABELS[s]}
          </span>
        );
      },
    },
    {
      id: "eta",
      header: "ETA / ATA",
      cell: (m) => (
        <div className="flex flex-col text-xs">
          <span className="font-mono">
            ETA {formatManila(m.estimated_arrival, "MMM d · HH:mm")}
          </span>
          {m.actual_arrival ? (
            <span className="font-mono text-foreground">
              ATA {formatManila(m.actual_arrival, "MMM d · HH:mm")}
            </span>
          ) : null}
        </div>
      ),
    },
    {
      id: "etd",
      header: "ETD / ATD",
      cell: (m) => (
        <div className="flex flex-col text-xs">
          {m.estimated_departure ? (
            <span className="font-mono">
              ETD {formatManila(m.estimated_departure, "MMM d · HH:mm")}
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
          {m.actual_departure ? (
            <span className="font-mono text-foreground">
              ATD {formatManila(m.actual_departure, "MMM d · HH:mm")}
            </span>
          ) : null}
        </div>
      ),
    },
    {
      id: "officer",
      header: "Protocol Officer",
      cell: (m) => {
        const cid = creatorIdOf(m);
        const officer = cid ? profileMap.get(cid) : null;
        return officer ? (
          <span className="text-sm">
            {officer.full_name ?? officer.email}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">Unassigned</span>
        );
      },
    },
    {
      id: "request",
      header: "Request / concern",
      className: "max-w-[20rem]",
      cell: (m) =>
        m.request ? (
          <span
            className="line-clamp-2 whitespace-pre-line text-sm"
            title={m.request}
          >
            {m.request}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
  ];

  const openMovement = openId
    ? visible.find((m) => m.id === openId) ?? null
    : null;

  const filters = (
    <button
      type="button"
      onClick={() => setShowClosed((v) => !v)}
      className="rounded-md border border-input bg-background px-2.5 py-1 text-xs hover:bg-muted"
    >
      {showClosed ? "Hide closed" : "Show closed"}
    </button>
  );

  return (
    <>
      <DataTable
        data={visible}
        columns={columns}
        rowKey={(m) => m.id}
        filters={filters}
        pageSize={20}
        onRowClick={(m) => setOpenId(m.id)}
        searchable={{
          placeholder: "Search by VIP, destination, request…",
          predicate: (m, q) => {
            const vip = vipMap.get(m.vip_id);
            const dest = m.destination_site_id
              ? siteMap.get(m.destination_site_id)
              : null;
            return (
              (vip?.full_name?.toLowerCase().includes(q) ?? false) ||
              (vip?.title?.toLowerCase().includes(q) ?? false) ||
              (vip?.organization?.toLowerCase().includes(q) ?? false) ||
              (dest?.toLowerCase().includes(q) ?? false) ||
              (m.request?.toLowerCase().includes(q) ?? false) ||
              (m.purpose?.toLowerCase().includes(q) ?? false) ||
              (m.from_location?.toLowerCase().includes(q) ?? false) ||
              (m.to_location?.toLowerCase().includes(q) ?? false)
            );
          },
        }}
        empty={{
          title: showClosed ? "No movements" : "No active movements",
          description: showClosed
            ? "Log the first movement to start tracking."
            : "All current VIP movements are closed.",
        }}
      />
      <MovementDetailsDialog
        open={openMovement !== null}
        onOpenChange={(o) => {
          if (!o) setOpenId(null);
        }}
        movement={openMovement}
        vipName={
          openMovement ? vipMap.get(openMovement.vip_id)?.full_name ?? null : null
        }
        vipTitle={
          openMovement ? vipMap.get(openMovement.vip_id)?.title ?? null : null
        }
        vipOrganization={
          openMovement
            ? vipMap.get(openMovement.vip_id)?.organization ?? null
            : null
        }
        destinationName={
          openMovement && openMovement.destination_site_id
            ? siteMap.get(openMovement.destination_site_id) ?? null
            : null
        }
        creator={(() => {
          if (!openMovement) return null;
          const cid = creatorIdOf(openMovement);
          return cid ? profileMap.get(cid) ?? null : null;
        })()}
        canAct={openMovement ? isOwnerOf(openMovement) : false}
      />
    </>
  );
}
