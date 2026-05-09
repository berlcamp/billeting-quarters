"use client";

import { useEffect, useState, type ReactNode } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  assignProtocolOfficer,
  getProtocolOfficerCandidates,
} from "@/lib/actions/vip";

interface VipLite {
  id: string;
  full_name: string;
  protocol_officer_id: string | null;
}

interface Props {
  vip: VipLite;
  trigger: ReactNode;
}

const NONE = "__none__";

export function AssignProtocolOfficerDialog({ vip, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [candidates, setCandidates] = useState<
    { id: string; full_name: string | null; email: string }[]
  >([]);
  const [selected, setSelected] = useState<string>(
    vip.protocol_officer_id ?? NONE,
  );
  const router = useRouter();

  // Load the candidate list lazily on open. Re-resolve every time so a
  // freshly-invited officer shows up without a hard refresh.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoadingCandidates(true);
    getProtocolOfficerCandidates().then((res) => {
      if (cancelled) return;
      setLoadingCandidates(false);
      if (res.error) {
        toast.error("Failed to load protocol officers", {
          description: res.error,
        });
        return;
      }
      setCandidates(res.data ?? []);
    });
    setSelected(vip.protocol_officer_id ?? NONE);
    return () => {
      cancelled = true;
    };
  }, [open, vip.protocol_officer_id]);

  async function submit() {
    setSubmitting(true);
    const result = await assignProtocolOfficer({
      vip_id: vip.id,
      protocol_officer_id: selected === NONE ? null : selected,
    });
    setSubmitting(false);

    if (result.error) {
      toast.error("Assignment failed", { description: result.error });
      return;
    }
    toast.success(
      selected === NONE ? "Protocol officer cleared" : "Protocol officer assigned",
    );
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger as React.ReactElement} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Assign Protocol Officer</DialogTitle>
          <DialogDescription>
            One Protocol Officer per VIP. Reassigning here releases their
            previous VIP automatically.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label>VIP</Label>
          <p className="text-sm">{vip.full_name}</p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="po">Protocol Officer</Label>
          <Select
            value={selected}
            onValueChange={(v) => setSelected(v ?? NONE)}
          >
            <SelectTrigger id="po" className="w-full">
              <SelectValue>
                {(v: string | null) => {
                  if (!v || v === NONE) return "Unassigned";
                  const c = candidates.find((x) => x.id === v);
                  return c
                    ? `${c.full_name ?? c.email}`
                    : "Unassigned";
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>Unassigned</SelectItem>
              {loadingCandidates ? (
                <div className="p-2 text-xs text-muted-foreground">
                  Loading…
                </div>
              ) : candidates.length === 0 ? (
                <div className="p-2 text-xs text-muted-foreground">
                  No active profiles hold the Protocol Officer role yet.
                </div>
              ) : (
                candidates.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.full_name ?? c.email}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>

        <DialogFooter>
          <Button
            type="button"
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
