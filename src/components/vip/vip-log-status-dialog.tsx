"use client";

import { useState, type ReactNode } from "react";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateVipLogRequestStatus } from "@/lib/actions/vip";
import {
  VIP_LOG_REQUEST_STATUSES,
  VIP_LOG_REQUEST_STATUS_LABELS,
  type VipLogRequestStatus,
} from "@/lib/labels";

interface Props {
  logId: string;
  current: VipLogRequestStatus;
  trigger: ReactNode;
}

export function VipLogStatusDialog({ logId, current, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<VipLogRequestStatus>(current);
  const [remarks, setRemarks] = useState("");
  const router = useRouter();

  async function submit() {
    setSubmitting(true);
    const result = await updateVipLogRequestStatus({
      log_id: logId,
      request_status: status,
      remarks: remarks.trim() || undefined,
    });
    setSubmitting(false);

    if (result.error) {
      toast.error("Update failed", { description: result.error });
      return;
    }
    toast.success("Request status updated");
    setOpen(false);
    setRemarks("");
    router.refresh();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setStatus(current);
      }}
    >
      <DialogTrigger render={trigger as React.ReactElement} />
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Update request status</DialogTitle>
          <DialogDescription>
            Triggered by Command Center. Remarks are appended to the log.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="req-status">Status</Label>
            <Select
              value={status}
              onValueChange={(v) => setStatus(v as VipLogRequestStatus)}
            >
              <SelectTrigger id="req-status" className="w-full">
                <SelectValue>
                  {(v: string | null) =>
                    v
                      ? VIP_LOG_REQUEST_STATUS_LABELS[v as VipLogRequestStatus]
                      : "Select status"
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {VIP_LOG_REQUEST_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {VIP_LOG_REQUEST_STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="req-remarks">Remarks (optional)</Label>
            <Textarea
              id="req-remarks"
              rows={3}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={submitting}
          >
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
