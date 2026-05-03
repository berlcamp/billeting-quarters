"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createDelegation, updateDelegation } from "@/lib/actions/delegations";
import {
  createDelegationSchema,
  type CreateDelegationInput,
} from "@/lib/schemas/delegations";
import type { Database } from "@/types/database";

type Delegation = Database["palaro"]["Tables"]["delegations"]["Row"];
type Site = Database["palaro"]["Tables"]["sites"]["Row"];

const NO_BQ = "__none__";

interface DelegationDialogProps {
  delegation?: Delegation | null;
  bqSites: Pick<Site, "id" | "name">[];
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const emptyValues: CreateDelegationInput = {
  region_code: "",
  region_name: "",
  short_name: undefined,
  head_of_delegation: undefined,
  contact_number: undefined,
  total_athletes: 0,
  total_coaches: 0,
  total_officials: 0,
  color_hex: undefined,
  assigned_bq_id: null,
};

function delegationToValues(d: Delegation): CreateDelegationInput {
  return {
    region_code: d.region_code,
    region_name: d.region_name,
    short_name: d.short_name ?? undefined,
    head_of_delegation: d.head_of_delegation ?? undefined,
    contact_number: d.contact_number ?? undefined,
    total_athletes: d.total_athletes ?? 0,
    total_coaches: d.total_coaches ?? 0,
    total_officials: d.total_officials ?? 0,
    color_hex: d.color_hex ?? undefined,
    assigned_bq_id: d.assigned_bq_id ?? null,
  };
}

export function DelegationDialog({
  delegation,
  bqSites,
  open: controlledOpen,
  onOpenChange,
}: DelegationDialogProps) {
  const isEdit = !!delegation;
  const [internalOpen, setInternalOpen] = useState(false);
  const open = isEdit ? !!controlledOpen : internalOpen;
  const setOpen = (next: boolean) => {
    if (isEdit) onOpenChange?.(next);
    else setInternalOpen(next);
  };

  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  const form = useForm<CreateDelegationInput>({
    resolver: zodResolver(createDelegationSchema),
    defaultValues: delegation ? delegationToValues(delegation) : emptyValues,
  });

  useEffect(() => {
    if (open) {
      form.reset(delegation ? delegationToValues(delegation) : emptyValues);
    }
  }, [open, delegation, form]);

  async function onSubmit(values: CreateDelegationInput) {
    setSubmitting(true);
    const result = isEdit
      ? await updateDelegation({ id: delegation!.id, ...values })
      : await createDelegation(values);
    setSubmitting(false);

    if (result.error) {
      toast.error(isEdit ? "Update failed" : "Create failed", {
        description: result.error,
      });
      return;
    }
    toast.success(isEdit ? "Delegation updated" : "Delegation added");
    setOpen(false);
    router.refresh();
  }

  const dialog = (
    <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>
          {isEdit ? "Edit delegation" : "Add delegation"}
        </DialogTitle>
        <DialogDescription>
          {isEdit
            ? "Update this delegation's details."
            : "Add one of the 17 Philippine regions competing in the Palaro."}
        </DialogDescription>
      </DialogHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
          <div className="grid grid-cols-3 gap-3">
            <FormField
              control={form.control}
              name="region_code"
              render={({ field }) => (
                <FormItem className="col-span-1">
                  <FormLabel>Code</FormLabel>
                  <FormControl>
                    <Input placeholder="NCR" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="region_name"
              render={({ field }) => (
                <FormItem className="col-span-2">
                  <FormLabel>Region name</FormLabel>
                  <FormControl>
                    <Input placeholder="National Capital Region" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="short_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Short name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="NCR"
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="color_hex"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Color</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="#1e40af"
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <FormField
            control={form.control}
            name="head_of_delegation"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Head of delegation</FormLabel>
                <FormControl>
                  <Input {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="contact_number"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Contact number</FormLabel>
                <FormControl>
                  <Input {...field} value={field.value ?? ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="grid grid-cols-3 gap-3">
            <FormField
              control={form.control}
              name="total_athletes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Athletes</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      value={field.value ?? 0}
                      onChange={(e) => {
                        const v = e.target.value;
                        field.onChange(v === "" ? 0 : Number(v));
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="total_coaches"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Coaches</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      value={field.value ?? 0}
                      onChange={(e) => {
                        const v = e.target.value;
                        field.onChange(v === "" ? 0 : Number(v));
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="total_officials"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Officials</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      value={field.value ?? 0}
                      onChange={(e) => {
                        const v = e.target.value;
                        field.onChange(v === "" ? 0 : Number(v));
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <FormField
            control={form.control}
            name="assigned_bq_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Assigned BQ</FormLabel>
                <Select
                  value={field.value ?? NO_BQ}
                  onValueChange={(v) =>
                    field.onChange(v === NO_BQ ? null : v)
                  }
                >
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue>
                        {(v: string | null) => {
                          if (!v || v === NO_BQ) {
                            return (
                              <span className="text-muted-foreground">
                                No BQ assigned
                              </span>
                            );
                          }
                          const site = bqSites.find((s) => s.id === v);
                          return site ? site.name : v;
                        }}
                      </SelectValue>
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value={NO_BQ}>No BQ assigned</SelectItem>
                    {bqSites.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving…" : isEdit ? "Save changes" : "Add delegation"}
            </Button>
          </DialogFooter>
        </form>
      </Form>
    </DialogContent>
  );

  if (isEdit) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        {dialog}
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <Plus className="size-4" />
        Add delegation
      </DialogTrigger>
      {dialog}
    </Dialog>
  );
}
