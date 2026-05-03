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
import { createRoute } from "@/lib/actions/vehicles";
import {
  createRouteSchema,
  type CreateRouteInput,
} from "@/lib/schemas/vehicles";
import type { Database } from "@/types/database";

type Vehicle = Pick<
  Database["palaro"]["Tables"]["vehicles"]["Row"],
  "id" | "vehicle_code" | "plate_number"
>;
type Site = Pick<
  Database["palaro"]["Tables"]["sites"]["Row"],
  "id" | "name"
>;
type Delegation = Pick<
  Database["palaro"]["Tables"]["delegations"]["Row"],
  "id" | "region_code" | "region_name"
>;

const NONE = "__none__";

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
  sites: Site[];
  delegations: Delegation[];
}

export function RouteFormDialog({
  trigger,
  vehicles,
  sites,
  delegations,
}: Props) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  const form = useForm<CreateRouteInput>({
    resolver: zodResolver(createRouteSchema),
    defaultValues: {
      vehicle_id: "",
      route_name: "",
      origin_site_id: null,
      destination_site_id: null,
      scheduled_time: nowLocal(),
      delegation_id: null,
      notes: undefined,
    },
  });

  async function onSubmit(values: CreateRouteInput) {
    setSubmitting(true);
    const payload = {
      ...values,
      scheduled_time: values.scheduled_time
        ? new Date(values.scheduled_time).toISOString()
        : undefined,
    };
    const result = await createRoute(payload);
    setSubmitting(false);

    if (result.error) {
      toast.error("Create failed", { description: result.error });
      return;
    }
    toast.success("Route added");
    form.reset({
      vehicle_id: "",
      route_name: "",
      origin_site_id: null,
      destination_site_id: null,
      scheduled_time: nowLocal(),
      delegation_id: null,
      notes: undefined,
    });
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger as React.ReactElement} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add route</DialogTitle>
          <DialogDescription>
            Pre-define a recurring shuttle. Times are in PHT, stored in UTC.
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
              name="route_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Route name</FormLabel>
                  <FormControl>
                    <Input placeholder="BQ-A → PV-Stadium" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="origin_site_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Origin</FormLabel>
                    <Select
                      value={field.value ?? NONE}
                      onValueChange={(v) =>
                        field.onChange(v === NONE ? null : v)
                      }
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue>
                            {(v: string | null) => {
                              if (!v || v === NONE) return "—";
                              const s = sites.find((x) => x.id === v);
                              return s ? s.name : "—";
                            }}
                          </SelectValue>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={NONE}>None</SelectItem>
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
              <FormField
                control={form.control}
                name="destination_site_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Destination</FormLabel>
                    <Select
                      value={field.value ?? NONE}
                      onValueChange={(v) =>
                        field.onChange(v === NONE ? null : v)
                      }
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue>
                            {(v: string | null) => {
                              if (!v || v === NONE) return "—";
                              const s = sites.find((x) => x.id === v);
                              return s ? s.name : "—";
                            }}
                          </SelectValue>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={NONE}>None</SelectItem>
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
              name="scheduled_time"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Scheduled time (PHT)</FormLabel>
                  <FormControl>
                    <Input
                      type="datetime-local"
                      {...field}
                      value={field.value ?? ""}
                      onChange={(e) => field.onChange(e.target.value)}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="delegation_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Delegation</FormLabel>
                  <Select
                    value={field.value ?? NONE}
                    onValueChange={(v) => field.onChange(v === NONE ? null : v)}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue>
                          {(v: string | null) => {
                            if (!v || v === NONE) return "—";
                            const d = delegations.find((x) => x.id === v);
                            return d ? `${d.region_code} — ${d.region_name}` : "—";
                          }}
                        </SelectValue>
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={NONE}>None</SelectItem>
                      {delegations.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.region_code} — {d.region_name}
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
                Add route
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
