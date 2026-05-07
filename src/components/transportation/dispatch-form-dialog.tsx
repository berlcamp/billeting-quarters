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
import { createDispatch } from "@/lib/actions/vehicles";
import {
  createDispatchSchema,
  type CreateDispatchInput,
} from "@/lib/schemas/vehicles";
import { PALARO_SPORTS } from "@/lib/labels";
import type { Database } from "@/types/database";

type Vehicle = Pick<
  Database["palaro"]["Tables"]["vehicles"]["Row"],
  "id" | "vehicle_code" | "plate_number"
>;
type Site = Pick<
  Database["palaro"]["Tables"]["sites"]["Row"],
  "id" | "name" | "site_type"
>;
type Delegation = Pick<
  Database["palaro"]["Tables"]["delegations"]["Row"],
  "id" | "region_code" | "region_name"
>;
type Route = Pick<
  Database["palaro"]["Tables"]["vehicle_routes"]["Row"],
  "id" | "route_name"
>;

const NONE = "__none__";
const SPORT_OTHER = "__other__";

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
  routes: Route[];
}

export function DispatchFormDialog({
  trigger,
  vehicles,
  sites,
  delegations,
  routes,
}: Props) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [sportPick, setSportPick] = useState<string>("");
  const router = useRouter();

  const form = useForm<CreateDispatchInput>({
    resolver: zodResolver(createDispatchSchema),
    defaultValues: {
      vehicle_id: "",
      route_id: null,
      delegation_id: "",
      sport: "",
      team_count: 1,
      expected_pax: 1,
      origin_site_id: "",
      destination_site_id: "",
      scheduled_at: nowLocal(),
      notes: undefined,
    },
  });

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      form.reset({
        vehicle_id: "",
        route_id: null,
        delegation_id: "",
        sport: "",
        team_count: 1,
        expected_pax: 1,
        origin_site_id: "",
        destination_site_id: "",
        scheduled_at: nowLocal(),
        notes: undefined,
      });
      setSportPick("");
    }
  }

  async function onSubmit(values: CreateDispatchInput) {
    setSubmitting(true);
    const payload = {
      ...values,
      scheduled_at: values.scheduled_at
        ? new Date(values.scheduled_at).toISOString()
        : undefined,
    };
    const result = await createDispatch(payload);
    setSubmitting(false);

    if (result.error) {
      toast.error("Dispatch failed", { description: result.error });
      return;
    }
    toast.success("Dispatch created");
    handleOpenChange(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={trigger as React.ReactElement} />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Dispatch a vehicle</DialogTitle>
          <DialogDescription>
            Capture the trip before the vehicle leaves: delegation, team(s),
            pax boarded, and where it&apos;s going.
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
                name="route_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Route</FormLabel>
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
                              const r = routes.find((x) => x.id === v);
                              return r ? r.route_name : "—";
                            }}
                          </SelectValue>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={NONE}>None</SelectItem>
                        {routes.map((r) => (
                          <SelectItem key={r.id} value={r.id}>
                            {r.route_name}
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
              name="delegation_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Delegation</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue>
                          {(v: string | null) => {
                            const d = delegations.find((x) => x.id === v);
                            return d ? (
                              `${d.region_code} — ${d.region_name}`
                            ) : (
                              <span className="text-muted-foreground">
                                Pick a delegation
                              </span>
                            );
                          }}
                        </SelectValue>
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
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
                  <Select
                    value={
                      sportPick === SPORT_OTHER
                        ? SPORT_OTHER
                        : field.value || ""
                    }
                    onValueChange={(v) => {
                      const next = v ?? "";
                      setSportPick(next);
                      if (next !== SPORT_OTHER) field.onChange(next);
                      else field.onChange("");
                    }}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue>
                          {(v: string | null) => {
                            if (v === SPORT_OTHER) return "Other (type below)";
                            return v ? v : (
                              <span className="text-muted-foreground">
                                Pick a sport
                              </span>
                            );
                          }}
                        </SelectValue>
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {PALARO_SPORTS.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                      <SelectItem value={SPORT_OTHER}>
                        Other (type below)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  {sportPick === SPORT_OTHER ? (
                    <FormControl>
                      <Input
                        placeholder="Type sport / team label"
                        value={field.value}
                        onChange={(e) => field.onChange(e.target.value)}
                      />
                    </FormControl>
                  ) : null}
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="team_count"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Teams on this trip</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
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
                name="expected_pax"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Pax boarded at origin</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
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
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="origin_site_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>From</FormLabel>
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
                                  Origin
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
              <FormField
                control={form.control}
                name="destination_site_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>To</FormLabel>
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
                                  Destination
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
              name="scheduled_at"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Scheduled departure (PHT)</FormLabel>
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
                onClick={() => handleOpenChange(false)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? <Loader2 className="size-4 animate-spin" /> : null}
                Dispatch
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
