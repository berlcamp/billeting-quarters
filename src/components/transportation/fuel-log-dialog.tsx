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
import { createFuelLog } from "@/lib/actions/vehicles";
import {
  createFuelLogSchema,
  type CreateFuelLogInput,
} from "@/lib/schemas/vehicles";
import type { Database } from "@/types/database";

type Vehicle = Pick<
  Database["palaro"]["Tables"]["vehicles"]["Row"],
  "id" | "vehicle_code" | "plate_number"
>;

function isoToLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

function nowLocal(): string {
  return isoToLocal(new Date().toISOString());
}

interface Props {
  trigger: ReactNode;
  vehicles: Vehicle[];
}

export function FuelLogDialog({ trigger, vehicles }: Props) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  const form = useForm<CreateFuelLogInput>({
    resolver: zodResolver(createFuelLogSchema),
    defaultValues: {
      vehicle_id: "",
      refilled_at: nowLocal(),
      liters: 0,
      cost_php: undefined,
      odometer_km: undefined,
      station: undefined,
      notes: undefined,
    },
  });

  useEffect(() => {
    if (!open) return;
    form.reset({
      vehicle_id: "",
      refilled_at: nowLocal(),
      liters: 0,
      cost_php: undefined,
      odometer_km: undefined,
      station: undefined,
      notes: undefined,
    });
  }, [open, form]);

  async function onSubmit(values: CreateFuelLogInput) {
    setSubmitting(true);
    const result = await createFuelLog({
      ...values,
      refilled_at: new Date(values.refilled_at).toISOString(),
    });
    setSubmitting(false);

    if (result.error) {
      toast.error("Save failed", { description: result.error });
      return;
    }
    toast.success("Fuel entry recorded");
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger as React.ReactElement} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Log fuel refill</DialogTitle>
          <DialogDescription>
            Record liters added per vehicle. Cost and odometer are optional.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="vehicle_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Vehicle</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue>
                          {(v: string | null) => {
                            const veh = vehicles.find((x) => x.id === v);
                            return veh ? (
                              `${veh.vehicle_code}${veh.plate_number ? ` · ${veh.plate_number}` : ""}`
                            ) : (
                              <span className="text-muted-foreground">
                                Pick a vehicle
                              </span>
                            );
                          }}
                        </SelectValue>
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {vehicles.map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.vehicle_code}
                          {v.plate_number ? ` · ${v.plate_number}` : ""}
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
              name="refilled_at"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Refilled at (PHT)</FormLabel>
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
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="liters"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Liters</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min={0}
                        {...field}
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
                name="cost_php"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Cost (PHP)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.01"
                        min={0}
                        {...field}
                        value={field.value ?? ""}
                        onChange={(e) =>
                          field.onChange(
                            e.target.value === ""
                              ? undefined
                              : Number(e.target.value),
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
                name="odometer_km"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Odometer (km)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        {...field}
                        value={field.value ?? ""}
                        onChange={(e) =>
                          field.onChange(
                            e.target.value === ""
                              ? undefined
                              : Number(e.target.value),
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
                name="station"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Station</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ""} />
                    </FormControl>
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
                Save
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
