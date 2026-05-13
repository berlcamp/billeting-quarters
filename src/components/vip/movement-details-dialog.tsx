"use client";

import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MovementActions } from "./movement-actions";
import { setMovementStatus } from "@/lib/actions/vip";
import { cn } from "@/lib/utils";
import {
  VIP_MOVEMENT_STATUS_BADGE,
  VIP_MOVEMENT_STATUS_LABELS,
  VIP_MOVEMENT_STATUSES,
  type VipMovementStatus,
} from "@/lib/labels";
import { formatManila } from "@/lib/timezone";
import type { Database } from "@/types/database";

type Movement = Database["palaro"]["Tables"]["vip_movements"]["Row"];

interface ProfileLite {
  id: string;
  full_name: string | null;
  email: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  movement: Movement | null;
  vipName: string | null;
  vipTitle?: string | null;
  vipOrganization?: string | null;
  destinationName: string | null;
  creator: ProfileLite | null;
  // True iff the current viewer is the creator (and may take actions).
  canAct: boolean;
  // Super-admin override — shows an inline status select that bypasses the
  // closed-state guard, so departed/cancelled movements can be re-opened.
  canForceStatus?: boolean;
}

function Field({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="space-y-0.5">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={cn("text-sm", mono && "font-mono")}>
        {value || <span className="text-muted-foreground">—</span>}
      </div>
    </div>
  );
}

export function MovementDetailsDialog({
  open,
  onOpenChange,
  movement,
  vipName,
  vipTitle,
  vipOrganization,
  destinationName,
  creator,
  canAct,
  canForceStatus = false,
}: Props) {
  const router = useRouter();
  if (!movement) return null;
  const status = movement.status as VipMovementStatus;
  const movementId = movement.id;

  async function handleForceStatus(next: VipMovementStatus) {
    const result = await setMovementStatus({
      movement_id: movementId,
      status: next,
    });
    if (result.error) {
      toast.error("Status change failed", { description: result.error });
      return;
    }
    toast.success(`Status set to ${VIP_MOVEMENT_STATUS_LABELS[next]}`);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>{vipName ?? "Movement"}</span>
            {canForceStatus ? (
              <Select
                value={status}
                onValueChange={(v) =>
                  handleForceStatus(v as VipMovementStatus)
                }
              >
                <SelectTrigger
                  className={cn(
                    "h-7 w-36 border-transparent text-xs font-medium",
                    VIP_MOVEMENT_STATUS_BADGE[status],
                  )}
                  aria-label="Change status"
                >
                  <SelectValue>
                    {(v: string | null) =>
                      VIP_MOVEMENT_STATUS_LABELS[
                        (v ?? status) as VipMovementStatus
                      ]
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {VIP_MOVEMENT_STATUSES.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {VIP_MOVEMENT_STATUS_LABELS[opt]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-xs font-medium",
                  VIP_MOVEMENT_STATUS_BADGE[status],
                )}
              >
                {VIP_MOVEMENT_STATUS_LABELS[status]}
              </span>
            )}
          </DialogTitle>
          {vipTitle || vipOrganization ? (
            <DialogDescription>
              {[vipTitle, vipOrganization].filter(Boolean).join(" · ")}
            </DialogDescription>
          ) : null}
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Destination" value={destinationName} />
          <Field
            label="Protocol Officer"
            value={creator ? creator.full_name ?? creator.email : null}
          />
          <Field
            label="ETA"
            mono
            value={
              movement.estimated_arrival
                ? formatManila(movement.estimated_arrival, "MMM d · HH:mm")
                : null
            }
          />
          <Field
            label="ATA"
            mono
            value={
              movement.actual_arrival
                ? formatManila(movement.actual_arrival, "MMM d · HH:mm")
                : null
            }
          />
          <Field
            label="ETD"
            mono
            value={
              movement.estimated_departure
                ? formatManila(movement.estimated_departure, "MMM d · HH:mm")
                : null
            }
          />
          <Field
            label="ATD"
            mono
            value={
              movement.actual_departure
                ? formatManila(movement.actual_departure, "MMM d · HH:mm")
                : null
            }
          />
          <Field label="Purpose" value={movement.purpose} />
          <Field label="Vehicle" value={movement.vehicle_info} />
          <Field
            label="Escorts"
            value={
              movement.escort_count !== null
                ? String(movement.escort_count)
                : null
            }
          />
          <Field
            label="Created"
            mono
            value={formatManila(movement.created_at, "MMM d · HH:mm")}
          />
        </div>

        {movement.from_location || movement.to_location ? (
          <div className="flex flex-wrap items-center gap-1.5 rounded-md border bg-muted/40 px-3 py-2 text-sm">
            <span className="text-muted-foreground">From</span>
            <span className="font-medium">{movement.from_location ?? "—"}</span>
            <ArrowRight className="size-3 text-muted-foreground" />
            <span className="text-muted-foreground">To</span>
            <span className="font-medium">{movement.to_location ?? "—"}</span>
          </div>
        ) : null}

        {movement.request ? (
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">
              Request / concern
            </div>
            <div className="whitespace-pre-line rounded-md border bg-muted/40 p-2 text-sm">
              {movement.request}
            </div>
          </div>
        ) : null}

        {movement.remarks ? (
          <div className="space-y-1">
            <div className="text-xs text-muted-foreground">Remarks</div>
            <div className="whitespace-pre-line rounded-md border bg-muted/40 p-2 text-sm">
              {movement.remarks}
            </div>
          </div>
        ) : null}

        {canAct ? (
          <div className="flex items-center justify-end pt-2">
            <MovementActions movement={movement} />
          </div>
        ) : status !== "departed" && status !== "cancelled" ? (
          <p className="pt-2 text-right text-xs text-muted-foreground">
            Only the creator can change this movement.
          </p>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
