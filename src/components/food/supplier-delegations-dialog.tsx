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
import { Checkbox } from "@/components/ui/checkbox";
import { setSupplierDelegations } from "@/lib/actions/food";
import type { Database } from "@/types/database";

type Delegation = Pick<
  Database["palaro"]["Tables"]["delegations"]["Row"],
  "id" | "region_code" | "region_name"
>;
type Supplier = Pick<
  Database["palaro"]["Tables"]["food_suppliers"]["Row"],
  "id" | "name"
>;
type Assignment = Pick<
  Database["palaro"]["Tables"]["food_supplier_delegations"]["Row"],
  "supplier_id" | "delegation_id" | "priority"
>;

interface Props {
  trigger: ReactNode;
  supplier: Supplier;
  delegations: Delegation[];
  assignments: Assignment[];
}

export function SupplierDelegationsDialog({
  trigger,
  supplier,
  delegations,
  assignments,
}: Props) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const router = useRouter();

  // Preselect this supplier's current assignments whenever the dialog opens.
  useEffect(() => {
    if (open) {
      const ids = assignments
        .filter((a) => a.supplier_id === supplier.id)
        .map((a) => a.delegation_id);
      setSelected(new Set(ids));
    }
  }, [open, assignments, supplier.id]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function save() {
    setSubmitting(true);
    const result = await setSupplierDelegations({
      supplier_id: supplier.id,
      delegation_ids: Array.from(selected),
    });
    setSubmitting(false);

    if (result.error) {
      toast.error("Save failed", { description: result.error });
      return;
    }
    toast.success("Assignments saved");
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger as React.ReactElement} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Assign delegations</DialogTitle>
          <DialogDescription>
            Food requests from BQs of these delegations route to{" "}
            <span className="font-medium">{supplier.name}</span> first.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[50vh] space-y-2 overflow-y-auto">
          {delegations.map((d) => {
            const checked = selected.has(d.id);
            return (
              <label
                key={d.id}
                className="flex cursor-pointer items-center gap-3 rounded-md border p-2 hover:bg-muted/40"
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={() => toggle(d.id)}
                />
                <div className="flex-1 text-sm">
                  <div className="font-medium">{d.region_code}</div>
                  <div className="text-xs text-muted-foreground">
                    {d.region_name}
                  </div>
                </div>
              </label>
            );
          })}
          {delegations.length === 0 ? (
            <div className="rounded-md border p-3 text-sm text-muted-foreground">
              No delegations yet.
            </div>
          ) : null}
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
          <Button type="button" onClick={save} disabled={submitting}>
            {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
