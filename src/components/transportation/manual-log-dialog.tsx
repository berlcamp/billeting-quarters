"use client";

import { useEffect, useState } from "react";
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
type Delegation = Pick<
  Database["palaro"]["Tables"]["delegations"]["Row"],
  "id" | "region_code" | "region_name"
>;
type Dispatch = Pick<
  Database["palaro"]["Tables"]["vehicle_dispatches"]["Row"],
  | "id"
  | "vehicle_id"
  | "delegation_id"
  | "sport"
  | "team_count"
  | "origin_site_id"
  | "destination_site_id"
  | "status"
>;

const DIRECTIONS: VehicleLogDirection[] = ["in", "out"];
const NONE = "__none__";

interface Props {
  vehicles: Vehicle[];
  sites: Site[];
  delegations: Delegation[];
  dispatches: Dispatch[];
}

export function ManualLogDialog({
  vehicles,
  sites,
  delegations,
  dispatches,
}: Props) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  const form = useForm<LogVehicleInput>({
    resolver: zodResolver(logVehicleSchema),
    defaultValues: {
      vehicle_id: "",
      site_id: "",
      direction: "in",
      dispatch_id: null,
      delegation_id: null,
      sport: undefined,
      team_count: undefined,
      passenger_count: undefined,
      from_site_id: null,
      to_site_id: null,
      notes: undefined,
    },
  });

  const watchVehicleId = form.watch("vehicle_id");
  const watchDispatchId = form.watch("dispatch_id");

  // Pre-fill snapshot fields from the picked dispatch (only when the user
  // hasn't already typed a value).
  useEffect(() => {
    if (!watchDispatchId) return;
    const d = dispatches.find((x) => x.id === watchDispatchId);
    if (!d) return;
    const v = form.getValues();
    form.reset({
      ...v,
      delegation_id: v.delegation_id ?? d.delegation_id,
      sport: v.sport || d.sport || undefined,
      team_count: v.team_count ?? d.team_count ?? undefined,
      from_site_id: v.from_site_id ?? d.origin_site_id,
      to_site_id: v.to_site_id ?? d.destination_site_id,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchDispatchId]);

  const eligibleDispatches = dispatches.filter(
    (d) =>
      (d.status === "scheduled" || d.status === "in_transit") &&
      (!watchVehicleId || d.vehicle_id === watchVehicleId),
  );

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
      dispatch_id: values.dispatch_id ?? null,
      delegation_id: null,
      sport: undefined,
      team_count: undefined,
      passenger_count: undefined,
      from_site_id: null,
      to_site_id: null,
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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Log vehicle movement</DialogTitle>
          <DialogDescription>
            For when QR scanning isn&apos;t available. Pick the dispatch to
            auto-fill delegation, sport, and from/to.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
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
                                veh.vehicle_code
                              ) : (
                                <span className="text-muted-foreground">
                                  Pick
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
                    <FormLabel>Site (where scan happens)</FormLabel>
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
                                  Pick
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
            </div>

            <FormField
              control={form.control}
              name="dispatch_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Dispatch (auto-fills below)</FormLabel>
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
                            if (!v || v === NONE) return "None";
                            const d = dispatches.find((x) => x.id === v);
                            return d
                              ? `${d.sport ?? "Trip"} · ${d.id.slice(0, 8)}`
                              : "—";
                          }}
                        </SelectValue>
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={NONE}>None (ad-hoc scan)</SelectItem>
                      {eligibleDispatches.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.sport ?? "Trip"} · {d.id.slice(0, 8)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-3 gap-3">
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
                    <FormLabel>Pax</FormLabel>
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
                name="team_count"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Teams</FormLabel>
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

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="delegation_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Delegation</FormLabel>
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
                              const d = delegations.find((x) => x.id === v);
                              return d ? d.region_code : "—";
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
                name="sport"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sport / team</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value ?? ""}
                        placeholder="e.g. Taekwondo"
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
                name="from_site_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>From</FormLabel>
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
                name="to_site_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>To</FormLabel>
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
