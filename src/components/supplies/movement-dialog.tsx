"use client";

import { useState, type ReactNode } from "react";
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
import { recordMovement } from "@/lib/actions/supplies";
import {
  recordMovementSchema,
  type RecordMovementInput,
} from "@/lib/schemas/supplies";
import {
  SUPPLY_MOVEMENT_TYPES,
  SUPPLY_MOVEMENT_TYPE_LABELS,
  type SupplyMovementType,
} from "@/lib/labels";
import type { Database } from "@/types/database";

type Supply = Database["palaro"]["Tables"]["medical_supplies"]["Row"];

interface Props {
  trigger: ReactNode;
  supplies: Supply[];
  defaultSupplyId?: string;
  defaultType?: SupplyMovementType;
}

export function MovementDialog({
  trigger,
  supplies,
  defaultSupplyId,
  defaultType = "stock_in",
}: Props) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  const form = useForm<RecordMovementInput>({
    resolver: zodResolver(recordMovementSchema),
    defaultValues: {
      supply_id: defaultSupplyId ?? "",
      movement_type: defaultType,
      quantity: 1,
      reason: undefined,
      reference_type: undefined,
      reference_id: null,
    },
  });

  async function onSubmit(values: RecordMovementInput) {
    setSubmitting(true);
    const result = await recordMovement(values);
    setSubmitting(false);

    if (result.error) {
      toast.error("Movement failed", { description: result.error });
      return;
    }
    toast.success(`Stock updated — now ${result.data!.new_stock}`);
    form.reset({
      supply_id: values.supply_id,
      movement_type: defaultType,
      quantity: 1,
      reason: undefined,
      reference_type: undefined,
      reference_id: null,
    });
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger as React.ReactElement} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record movement</DialogTitle>
          <DialogDescription>
            Stock-in adds; stock-out and expired subtract; adjustment is for
            re-counts.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <FormField
              control={form.control}
              name="supply_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Supply</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue>
                          {(v: string | null) => {
                            const s = supplies.find((x) => x.id === v);
                            return s ? (
                              `${s.name} · ${s.current_stock} ${s.unit}`
                            ) : (
                              <span className="text-muted-foreground">
                                Pick a supply
                              </span>
                            );
                          }}
                        </SelectValue>
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {supplies.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name} · {s.current_stock} {s.unit}
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
                name="movement_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={(v) =>
                        field.onChange(v as SupplyMovementType)
                      }
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue>
                            {(v: string | null) =>
                              v
                                ? SUPPLY_MOVEMENT_TYPE_LABELS[
                                    v as SupplyMovementType
                                  ]
                                : "Pick"
                            }
                          </SelectValue>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {SUPPLY_MOVEMENT_TYPES.map((t) => (
                          <SelectItem key={t} value={t}>
                            {SUPPLY_MOVEMENT_TYPE_LABELS[t]}
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
                name="quantity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quantity</FormLabel>
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
              name="reason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reason / notes</FormLabel>
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
                Record
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
