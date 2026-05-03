"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
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
import { dischargeReferral } from "@/lib/actions/referrals";

export function DischargeDialog({ referralId }: { referralId: string }) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function handleDischarge() {
    if (!notes.trim()) {
      toast.error("Discharge notes are required.");
      return;
    }
    setBusy(true);
    const result = await dischargeReferral({
      id: referralId,
      discharge_notes: notes.trim(),
    });
    setBusy(false);
    if (result.error) {
      toast.error("Discharge failed", { description: result.error });
      return;
    }
    toast.success("Patient discharged");
    setOpen(false);
    setNotes("");
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <LogOut className="size-4" />
        Discharge
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Discharge patient</DialogTitle>
          <DialogDescription>
            Record discharge notes. This closes the referral.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <label htmlFor="discharge-notes" className="text-sm font-medium">
            Discharge notes
          </label>
          <Textarea
            id="discharge-notes"
            rows={4}
            placeholder="Disposition, follow-up instructions, observations…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
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
          <Button onClick={handleDischarge} disabled={busy}>
            {busy ? "Discharging…" : "Confirm discharge"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
