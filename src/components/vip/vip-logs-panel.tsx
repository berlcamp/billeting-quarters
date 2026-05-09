"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Plus, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { useRealtimePostgresChanges } from "@/lib/hooks/use-realtime";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { VipLogDialog } from "./vip-log-dialog";
import { VipLogStatusDialog } from "./vip-log-status-dialog";
import { getVipLogs } from "@/lib/actions/vip";
import { cn } from "@/lib/utils";
import { formatManila } from "@/lib/timezone";
import {
  VIP_LOG_REQUEST_STATUS_BADGE,
  VIP_LOG_REQUEST_STATUS_LABELS,
  type VipLogRequestStatus,
} from "@/lib/labels";
import type { Database } from "@/types/database";

type VipLog = Database["palaro"]["Tables"]["vip_logs"]["Row"];

interface VipLite {
  id: string;
  full_name: string;
  protocol_officer_id: string | null;
}

interface Props {
  vips: VipLite[];
  initialVipId?: string | null;
  initialLogs?: VipLog[];
  // When true, the user can update request statuses (Command Center).
  canUpdateStatus: boolean;
  // When true, the picker is hidden and only the assigned VIP is shown
  // (Protocol Officer auto-detect).
  lockedToVip?: boolean;
}

export function VipLogsPanel({
  vips,
  initialVipId,
  initialLogs,
  canUpdateStatus,
  lockedToVip = false,
}: Props) {
  const router = useRouter();
  const [vipId, setVipId] = useState<string | null>(
    initialVipId ?? vips[0]?.id ?? null,
  );
  const [logs, setLogs] = useState<VipLog[]>(initialLogs ?? []);
  const [loading, setLoading] = useState(false);

  const vipMap = useMemo(() => {
    const m = new Map<string, VipLite>();
    for (const v of vips) m.set(v.id, v);
    return m;
  }, [vips]);
  const activeVip = vipId ? vipMap.get(vipId) ?? null : null;

  // Fetch whenever the picked VIP changes (and once on mount if we don't
  // already have rows for the initial VIP).
  useEffect(() => {
    if (!vipId) {
      setLogs([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    getVipLogs(vipId).then((res) => {
      if (cancelled) return;
      setLoading(false);
      if (res.error) {
        toast.error("Failed to load logs", { description: res.error });
        return;
      }
      setLogs(res.data ?? []);
    });
    return () => {
      cancelled = true;
    };
  }, [vipId]);

  // Realtime: any vip_logs change → refetch the current VIP's list.
  useRealtimePostgresChanges<VipLog>(
    { schema: "palaro", table: "vip_logs", event: "*" },
    () => {
      if (!vipId) return;
      getVipLogs(vipId).then((res) => {
        if (!res.error) setLogs(res.data ?? []);
      });
      router.refresh();
    },
  );

  return (
    <div className="space-y-4">
      {!lockedToVip ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">VIP</span>
          <Select
            value={vipId ?? undefined}
            onValueChange={(v) => setVipId(v)}
          >
            <SelectTrigger className="w-72">
              <SelectValue>
                {(v: string | null) => {
                  if (!v) return "Select a VIP";
                  return vipMap.get(v)?.full_name ?? "Unknown VIP";
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {vips.length === 0 ? (
                <div className="p-2 text-xs text-muted-foreground">
                  No VIPs yet.
                </div>
              ) : (
                vips.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.full_name}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          {activeVip ? (
            <VipLogDialog
              vipId={activeVip.id}
              vipName={activeVip.full_name}
              trigger={
                <Button size="sm">
                  <Plus className="size-4" />
                  Log entry
                </Button>
              }
            />
          ) : null}
        </div>
      ) : activeVip ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border bg-muted/40 px-3 py-2">
          <div className="text-sm">
            <span className="text-muted-foreground">Your assigned VIP: </span>
            <span className="font-medium">{activeVip.full_name}</span>
          </div>
          <VipLogDialog
            vipId={activeVip.id}
            vipName={activeVip.full_name}
            trigger={
              <Button size="sm">
                <Plus className="size-4" />
                Log entry
              </Button>
            }
          />
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-md border p-6 text-center text-sm text-muted-foreground">
          Loading…
        </div>
      ) : !activeVip ? (
        <div className="rounded-md border p-6 text-center text-sm text-muted-foreground">
          Select a VIP to see their log.
        </div>
      ) : logs.length === 0 ? (
        <div className="rounded-md border p-6 text-center text-sm text-muted-foreground">
          No log entries yet for {activeVip.full_name}.
        </div>
      ) : (
        <ol className="space-y-2">
          {logs.map((log) => {
            const status = log.request_status as VipLogRequestStatus;
            return (
              <li
                key={log.id}
                className="rounded-md border p-3 text-sm space-y-1.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-mono text-xs text-muted-foreground">
                    {formatManila(log.logged_at, "MMM d · HH:mm")}
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-medium",
                        VIP_LOG_REQUEST_STATUS_BADGE[status],
                      )}
                    >
                      {VIP_LOG_REQUEST_STATUS_LABELS[status]}
                    </span>
                    {canUpdateStatus ? (
                      <VipLogStatusDialog
                        logId={log.id}
                        current={status}
                        trigger={
                          <Button
                            size="icon-sm"
                            variant="ghost"
                            aria-label="Update request status"
                          >
                            <Settings2 className="size-3.5" />
                          </Button>
                        }
                      />
                    ) : null}
                  </div>
                </div>

                {log.from_location || log.to_location ? (
                  <div className="flex flex-wrap items-center gap-1.5 text-xs">
                    <span className="text-muted-foreground">From</span>
                    <span className="font-medium">
                      {log.from_location ?? "—"}
                    </span>
                    <ArrowRight className="size-3 text-muted-foreground" />
                    <span className="text-muted-foreground">To</span>
                    <span className="font-medium">
                      {log.to_location ?? "—"}
                    </span>
                  </div>
                ) : null}

                {log.request ? (
                  <div className="text-sm">
                    <span className="text-muted-foreground">Request: </span>
                    {log.request}
                  </div>
                ) : null}

                {log.remarks ? (
                  <div className="whitespace-pre-line text-xs text-muted-foreground">
                    {log.remarks}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
