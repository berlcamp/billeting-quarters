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
import { createRequest, updateRequest } from "@/lib/actions/food";
import {
  createRequestSchema,
  type CreateRequestInput,
} from "@/lib/schemas/food";
import { MEAL_TYPES, MEAL_TYPE_LABELS } from "@/lib/labels";
import type { Database } from "@/types/database";

type Request = Database["palaro"]["Tables"]["food_requests"]["Row"];
type Supplier = Pick<
  Database["palaro"]["Tables"]["food_suppliers"]["Row"],
  "id" | "name"
>;
type Site = Pick<
  Database["palaro"]["Tables"]["sites"]["Row"],
  "id" | "name" | "site_type"
>;
type MealType = (typeof MEAL_TYPES)[number];

const NO_SUPPLIER = "__none__";

function isoToLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

function localToIso(local: string): string {
  return new Date(local).toISOString();
}

function plusHoursLocal(hours: number): string {
  const d = new Date();
  d.setHours(d.getHours() + hours);
  return isoToLocal(d.toISOString());
}

interface Props {
  trigger: ReactNode;
  bqs: Site[];
  suppliers: Supplier[];
  request?: Request;
}

export function RequestFormDialog({ trigger, bqs, suppliers, request }: Props) {
  const isEdit = !!request;
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  const defaultMealType = (
    request && MEAL_TYPES.includes(request.meal_type as MealType)
      ? (request.meal_type as MealType)
      : "lunch"
  ) as MealType;

  const form = useForm<CreateRequestInput>({
    resolver: zodResolver(createRequestSchema),
    defaultValues: {
      bq_id: request?.bq_id ?? "",
      supplier_id: request?.supplier_id ?? null,
      meal_type: defaultMealType,
      quantity_meals: request?.quantity_meals ?? 50,
      required_at: request
        ? isoToLocal(request.required_at)
        : plusHoursLocal(4),
      notes: request?.notes ?? undefined,
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        bq_id: request?.bq_id ?? "",
        supplier_id: request?.supplier_id ?? null,
        meal_type: defaultMealType,
        quantity_meals: request?.quantity_meals ?? 50,
        required_at: request
          ? isoToLocal(request.required_at)
          : plusHoursLocal(4),
        notes: request?.notes ?? undefined,
      });
    }
  }, [open, request, defaultMealType, form]);

  async function onSubmit(values: CreateRequestInput) {
    setSubmitting(true);
    const payload = { ...values, required_at: localToIso(values.required_at) };
    const result = isEdit
      ? await updateRequest({ ...payload, id: request!.id })
      : await createRequest(payload);
    setSubmitting(false);

    if (result.error) {
      toast.error(isEdit ? "Update failed" : "Submit failed", {
        description: result.error,
      });
      return;
    }
    toast.success(isEdit ? "Request updated" : "Meal request submitted");
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger as React.ReactElement} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit meal request" : "Request meals"}
          </DialogTitle>
          <DialogDescription>
            BQs file requests; command center confirms a supplier and tracks
            delivery.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <FormField
              control={form.control}
              name="bq_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Billeting Quarter</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue>
                          {(v: string | null) => {
                            const b = bqs.find((x) => x.id === v);
                            return b ? (
                              b.name
                            ) : (
                              <span className="text-muted-foreground">
                                Pick a BQ
                              </span>
                            );
                          }}
                        </SelectValue>
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {bqs.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="meal_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Meal</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={(v) => field.onChange(v as MealType)}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue>
                            {(v: string | null) =>
                              v && MEAL_TYPES.includes(v as MealType)
                                ? MEAL_TYPE_LABELS[v as MealType]
                                : "Pick"
                            }
                          </SelectValue>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {MEAL_TYPES.map((t) => (
                          <SelectItem key={t} value={t}>
                            {MEAL_TYPE_LABELS[t]}
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
                name="quantity_meals"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Meal count</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        {...field}
                        value={field.value ?? 1}
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
            <FormField
              control={form.control}
              name="required_at"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Required by (PHT)</FormLabel>
                  <FormControl>
                    <Input
                      type="datetime-local"
                      {...field}
                      onChange={(e) => field.onChange(e.target.value)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="supplier_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Preferred supplier</FormLabel>
                  <Select
                    value={field.value ?? NO_SUPPLIER}
                    onValueChange={(v) =>
                      field.onChange(v === NO_SUPPLIER ? null : v)
                    }
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue>
                          {(v: string | null) => {
                            if (!v || v === NO_SUPPLIER) return "Any available";
                            return suppliers.find((x) => x.id === v)?.name ?? "—";
                          }}
                        </SelectValue>
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={NO_SUPPLIER}>Any available</SelectItem>
                      {suppliers.map((s) => (
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
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={2}
                      placeholder="Dietary restrictions, drop-off instructions…"
                      {...field}
                      value={field.value ?? ""}
                    />
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
                {isEdit ? "Save" : "Submit request"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
