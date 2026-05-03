"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Pencil } from "lucide-react";
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
import { logVehicleMovement } from "@/lib/actions/vehicles";
import {
  logVehicleSchema,
  type LogVehicleInput,
} from "@/lib/schemas/vehicles";
import {
  VEHICLE_LOG_DIRECTION_LABELS,
  type VehicleLogDirection,
} from "@/lib/labels";
import type { Database } from "@/types/database";

type Vehicle = Database["palaro"]["Tables"]["vehicles"]["Row"];
type Site = Pick<
  Database["palaro"]["Tables"]["sites"]["Row"],
  "id" | "name" | "site_type"
>;

const DIRECTIONS: VehicleLogDirection[] = ["in", "out"];

interface Props {
  vehicles: Vehicle[];
  sites: Site[];
}

export function ManualLogDialog({ vehicles, sites }: Props) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  const form = useForm<LogVehicleInput>({
    resolver: zodResolver(logVehicleSchema),
    defaultValues: {
      vehicle_id: "",
      site_id: "",
      direction: "in",
      passenger_count: undefined,
      notes: undefined,
    },
  });

  async function onSubmit(values: LogVehicleInput) {
    setSubmitting(true);
    const result = await logVehicleMovement(values);
    setSubmitting(false);

    if (result.error) {
      toast.error("Log failed", { description: result.error });
      return;
    }
    toast.success(
      `${VEHICLE_LOG_DIRECTION_LABELS[result.data!.direction]} recorded`,
    );
    form.reset({
      vehicle_id: values.vehicle_id,
      site_id: values.site_id,
      direction: "in",
      passenger_count: undefined,
      notes: undefined,
    });
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" />}>
        <Pencil className="size-4" />
        Manual entry
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Log vehicle movement</DialogTitle>
          <DialogDescription>
            Use when QR scanning isn&apos;t available. Logged with your account
            as the recorder.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
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
              name="site_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Site</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue>
                          {(v: string | null) => {
                            const s = sites.find((x) => x.id === v);
                            return s ? (
                              s.name
                            ) : (
                              <span className="text-muted-foreground">
                                Pick a site
                              </span>
                            );
                          }}
                        </SelectValue>
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
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
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="direction"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Direction</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={(v) =>
                        field.onChange(v as VehicleLogDirection)
                      }
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue>
                            {(v: string | null) =>
                              v && (v === "in" || v === "out")
                                ? VEHICLE_LOG_DIRECTION_LABELS[v]
                                : "Pick"
                            }
                          </SelectValue>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {DIRECTIONS.map((d) => (
                          <SelectItem key={d} value={d}>
                            {VEHICLE_LOG_DIRECTION_LABELS[d]}
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
                name="passenger_count"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Passengers</FormLabel>
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
                Log
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
