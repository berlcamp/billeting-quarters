"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ban } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { rejectReferral } from "@/lib/actions/referrals";

export function RejectDialog({ referralId }: { referralId: string }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function handle() {
    if (!reason.trim()) {
      toast.error("Rejection reason is required.");
      return;
    }
    setBusy(true);
    const result = await rejectReferral({
      id: referralId,
      reason: reason.trim(),
    });
    setBusy(false);
    if (result.error) {
      toast.error("Reject failed", { description: result.error });
      return;
    }
    toast.success("Referral rejected");
    setOpen(false);
    setReason("");
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" />}>
        <Ban className="size-4" />
        Reject
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reject referral</DialogTitle>
          <DialogDescription>
            Use this when the hospital cannot accept the patient (no capacity,
            wrong specialty, etc.). The referring site will be notified.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <label htmlFor="reject-reason" className="text-sm font-medium">
            Reason
          </label>
          <Textarea
            id="reject-reason"
            rows={3}
            placeholder="Why is this referral being rejected?"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={busy}
          />
          <p className="text-xs text-muted-foreground">Required.</p>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button variant="destructive" onClick={handle} disabled={busy}>
            {busy ? "Rejecting…" : "Confirm rejection"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
