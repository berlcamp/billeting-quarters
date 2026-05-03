"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createSupply, updateSupply } from "@/lib/actions/supplies";
import {
  createSupplySchema,
  type CreateSupplyInput,
} from "@/lib/schemas/supplies";
import { SUPPLY_CATEGORIES, SUPPLY_UNITS } from "@/lib/labels";
import type { Database } from "@/types/database";

type Supply = Database["palaro"]["Tables"]["medical_supplies"]["Row"];
type Site = Pick<
  Database["palaro"]["Tables"]["sites"]["Row"],
  "id" | "name"
>;

const NO_SITE = "__none__";
const NO_CATEGORY = "__none__";

interface Props {
  trigger: ReactNode;
  supply?: Supply;
  sites: Site[];
}

export function SupplyFormDialog({ trigger, supply, sites }: Props) {
  const isEdit = !!supply;
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  const form = useForm<CreateSupplyInput>({
    resolver: zodResolver(createSupplySchema),
    defaultValues: {
      name: supply?.name ?? "",
      category: supply?.category ?? undefined,
      unit: supply?.unit ?? "pcs",
      current_stock: supply?.current_stock ?? 0,
      reorder_level: supply?.reorder_level ?? 10,
      expiry_date: supply?.expiry_date ?? "",
      storage_site_id: supply?.storage_site_id ?? null,
      notes: supply?.notes ?? undefined,
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        name: supply?.name ?? "",
        category: supply?.category ?? undefined,
        unit: supply?.unit ?? "pcs",
        current_stock: supply?.current_stock ?? 0,
        reorder_level: supply?.reorder_level ?? 10,
        expiry_date: supply?.expiry_date ?? "",
        storage_site_id: supply?.storage_site_id ?? null,
        notes: supply?.notes ?? undefined,
      });
    }
  }, [open, supply, form]);

  async function onSubmit(values: CreateSupplyInput) {
    setSubmitting(true);
    const payload = {
      ...values,
      expiry_date: values.expiry_date === "" ? undefined : values.expiry_date,
    };
    const result = isEdit
      ? await updateSupply({ ...payload, id: supply!.id })
      : await createSupply(payload);
    setSubmitting(false);

    if (result.error) {
      toast.error(isEdit ? "Update failed" : "Create failed", {
        description: result.error,
      });
      return;
    }
    toast.success(isEdit ? "Supply updated" : "Supply added");
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger as React.ReactElement} />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit supply" : "Add supply"}</DialogTitle>
          <DialogDescription>
            Stock levels are managed by movements. The starting stock entered
            here is logged as the first movement.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Paracetamol 500mg" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Category</FormLabel>
                    <Select
                      value={field.value ?? NO_CATEGORY}
                      onValueChange={(v) =>
                        field.onChange(v === NO_CATEGORY ? undefined : v)
                      }
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue>
                            {(v: string | null) =>
                              !v || v === NO_CATEGORY ? "—" : v
                            }
                          </SelectValue>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={NO_CATEGORY}>—</SelectItem>
                        {SUPPLY_CATEGORIES.map((c) => (
                          <SelectItem key={c} value={c}>
                            {c}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="unit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Unit</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue>{field.value || "Unit"}</SelectValue>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {SUPPLY_UNITS.map((u) => (
                          <SelectItem key={u} value={u}>
                            {u}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="current_stock"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {isEdit ? "Current stock (read-only)" : "Starting stock"}
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        readOnly={isEdit}
                        {...field}
                        value={field.value ?? 0}
                        onChange={(e) =>
                          field.onChange(
                            e.target.value === "" ? 0 : Number(e.target.value),
                          )
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="reorder_level"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reorder at</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        {...field}
                        value={field.value ?? 10}
                        onChange={(e) =>
                          field.onChange(
                            e.target.value === "" ? 0 : Number(e.target.value),
                          )
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="expiry_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Expiry</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
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
                name="storage_site_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Storage site</FormLabel>
                    <Select
                      value={field.value ?? NO_SITE}
                      onValueChange={(v) =>
                        field.onChange(v === NO_SITE ? null : v)
                      }
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue>
                            {(v: string | null) => {
                              if (!v || v === NO_SITE) return "—";
                              const s = sites.find((x) => x.id === v);
                              return s?.name ?? "—";
                            }}
                          </SelectValue>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={NO_SITE}>—</SelectItem>
                        {sites.map((s) => (
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
            </div>
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea rows={2} {...field} value={field.value ?? ""} />
                  </FormControl>
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
                {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
                {isEdit ? "Save" : "Add supply"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
