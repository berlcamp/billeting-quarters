"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  cancelMovement,
  logArrival,
  logDeparture,
  setEstimatedDeparture,
} from "@/lib/actions/vip";
import type { Database } from "@/types/database";
import type { VipMovementStatus } from "@/lib/labels";

type Movement = Database["palaro"]["Tables"]["vip_movements"]["Row"];

type Action = "arrived" | "etd" | "departed" | "cancel";

interface Props {
  movement: Movement;
}

function nowLocalIso() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

export function MovementActions({ movement }: Props) {
  const [active, setActive] = useState<Action | null>(null);
  const status = movement.status as VipMovementStatus;
  const isClosed = status === "departed" || status === "cancelled";

  if (isClosed) {
    return (
      <span className="text-xs text-muted-foreground">No actions</span>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {status === "eta_logged" ? (
        <Button size="sm" variant="outline" onClick={() => setActive("arrived")}>
          Log arrival
        </Button>
      ) : null}
      {status === "arrived" ? (
        <Button size="sm" variant="outline" onClick={() => setActive("etd")}>
          Set ETD
        </Button>
      ) : null}
      {(status === "arrived" || status === "etd_logged") ? (
        <Button size="sm" onClick={() => setActive("departed")}>
          Log departure
        </Button>
      ) : null}
      <Button
        size="sm"
        variant="ghost"
        onClick={() => setActive("cancel")}
      >
        Cancel
      </Button>

      {active === "arrived" ? (
        <ArrivalDialog
          movementId={movement.id}
          onClose={() => setActive(null)}
        />
      ) : null}
      {active === "etd" ? (
        <EtdDialog movementId={movement.id} onClose={() => setActive(null)} />
      ) : null}
      {active === "departed" ? (
        <DepartureDialog
          movementId={movement.id}
          onClose={() => setActive(null)}
        />
      ) : null}
      {active === "cancel" ? (
        <CancelDialog
          movementId={movement.id}
          onClose={() => setActive(null)}
        />
      ) : null}
    </div>
  );
}

function ArrivalDialog({
  movementId,
  onClose,
}: {
  movementId: string;
  onClose: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [actualArrival, setActualArrival] = useState(nowLocalIso());
  const [notes, setNotes] = useState("");
  const router = useRouter();

  async function submit() {
    setSubmitting(true);
    const result = await logArrival({
      movement_id: movementId,
      actual_arrival: actualArrival
        ? new Date(actualArrival).toISOString()
        : undefined,
      notes: notes || undefined,
    });
    setSubmitting(false);

    if (result.error) {
      toast.error("Failed to log arrival", { description: result.error });
      return;
    }
    toast.success("Arrival logged");
    onClose();
    router.refresh();
  }

  return (
    <Dialog open onOpenChange={(o) => (o ? null : onClose())}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Log arrival</DialogTitle>
          <DialogDescription>
            Defaults to now. Adjust only if logging retroactively.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ata">Actual arrival (PHT)</Label>
            <Input
              id="ata"
              type="datetime-local"
              value={actualArrival}
              onChange={(e) => setActualArrival(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ata-notes">Notes</Label>
            <Textarea
              id="ata-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EtdDialog({
  movementId,
  onClose,
}: {
  movementId: string;
  onClose: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [etd, setEtd] = useState(nowLocalIso());
  const [notes, setNotes] = useState("");
  const router = useRouter();

  async function submit() {
    setSubmitting(true);
    const result = await setEstimatedDeparture({
      movement_id: movementId,
      estimated_departure: new Date(etd).toISOString(),
      notes: notes || undefined,
    });
    setSubmitting(false);

    if (result.error) {
      toast.error("Failed to set ETD", { description: result.error });
      return;
    }
    toast.success("ETD set");
    onClose();
    router.refresh();
  }

  return (
    <Dialog open onOpenChange={(o) => (o ? null : onClose())}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Set estimated departure</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="etd">ETD (PHT)</Label>
            <Input
              id="etd"
              type="datetime-local"
              value={etd}
              onChange={(e) => setEtd(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="etd-notes">Notes</Label>
            <Textarea
              id="etd-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DepartureDialog({
  movementId,
  onClose,
}: {
  movementId: string;
  onClose: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [atd, setAtd] = useState(nowLocalIso());
  const [notes, setNotes] = useState("");
  const router = useRouter();

  async function submit() {
    setSubmitting(true);
    const result = await logDeparture({
      movement_id: movementId,
      actual_departure: atd ? new Date(atd).toISOString() : undefined,
      notes: notes || undefined,
    });
    setSubmitting(false);

    if (result.error) {
      toast.error("Failed to log departure", { description: result.error });
      return;
    }
    toast.success("Departure logged");
    onClose();
    router.refresh();
  }

  return (
    <Dialog open onOpenChange={(o) => (o ? null : onClose())}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Log departure</DialogTitle>
          <DialogDescription>
            Defaults to now. Adjust only if logging retroactively.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="atd">Actual departure (PHT)</Label>
            <Input
              id="atd"
              type="datetime-local"
              value={atd}
              onChange={(e) => setAtd(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="atd-notes">Notes</Label>
            <Textarea
              id="atd-notes"
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CancelDialog({
  movementId,
  onClose,
}: {
  movementId: string;
  onClose: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [reason, setReason] = useState("");
  const router = useRouter();

  async function submit() {
    if (!reason.trim()) {
      toast.error("Reason is required");
      return;
    }
    setSubmitting(true);
    const result = await cancelMovement({
      movement_id: movementId,
      reason: reason.trim(),
    });
    setSubmitting(false);

    if (result.error) {
      toast.error("Failed to cancel", { description: result.error });
      return;
    }
    toast.success("Movement cancelled");
    onClose();
    router.refresh();
  }

  return (
    <Dialog open onOpenChange={(o) => (o ? null : onClose())}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Cancel movement</DialogTitle>
          <DialogDescription>
            Cancellation is irreversible — record a reason for the audit log.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="cancel-reason">Reason</Label>
          <Textarea
            id="cancel-reason"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Back
          </Button>
          <Button variant="destructive" onClick={submit} disabled={submitting}>
            {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
            Cancel movement
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
