"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BedDouble } from "lucide-react";
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
import { admitReferral } from "@/lib/actions/referrals";

export function AdmitDialog({ referralId }: { referralId: string }) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function handle() {
    setBusy(true);
    const result = await admitReferral({
      id: referralId,
      admission_notes: notes.trim() || undefined,
    });
    setBusy(false);
    if (result.error) {
      toast.error("Admit failed", { description: result.error });
      return;
    }
    toast.success("Patient admitted");
    setOpen(false);
    setNotes("");
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" />}>
        <BedDouble className="size-4" />
        Admit to ward
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Admit to hospital ward</DialogTitle>
          <DialogDescription>
            Patient becomes an inpatient under hospital care.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <label htmlFor="admit-notes" className="text-sm font-medium">
            Admission notes (optional)
          </label>
          <Textarea
            id="admit-notes"
            rows={3}
            placeholder="Ward, attending physician, initial orders…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={busy}
          />
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
          <Button onClick={handle} disabled={busy}>
            {busy ? "Admitting…" : "Confirm admission"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
