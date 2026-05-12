"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, X } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { closeTrip } from "@/lib/actions/vehicles";

interface Props {
  dispatchId: string;
  remaining: number;
  canForce: boolean;
}

export function CloseTripButton({ dispatchId, remaining, canForce }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function attempt(force: boolean) {
    setSubmitting(true);
    const result = await closeTrip({
      dispatch_id: dispatchId,
      force,
      reason: force ? reason.trim() || undefined : undefined,
    });
    setSubmitting(false);
    if (result.error) {
      toast.error("Close failed", { description: result.error });
      return;
    }
    toast.success("Trip closed");
    setOpen(false);
    router.refresh();
  }

  if (remaining === 0) {
    return (
      <Button onClick={() => attempt(false)} disabled={submitting}>
        {submitting ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <CheckCircle2 className="size-4" />
        )}
        Close trip
      </Button>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="destructive" onClick={() => setOpen(true)}>
        <X className="size-4" />
        Force close ({remaining} on board)
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Force-close trip</DialogTitle>
          <DialogDescription>
            {remaining} passengers are still on board. Provide a reason.
            Force-close requires vehicle.manage permission.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="force-reason">Reason</Label>
          <Textarea
            id="force-reason"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Bus broke down at terminal, passengers transferred to another vehicle."
          />
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => attempt(true)}
            disabled={submitting || !canForce || reason.trim().length === 0}
          >
            {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
            Force close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
