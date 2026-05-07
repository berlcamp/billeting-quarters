"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowDown, ArrowUp, GripVertical, Loader2, Plus, X } from "lucide-react";
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
import { Label } from "@/components/ui/label";
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
const SITE_FREE_TEXT = "__free_text__";

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
      vehicle_id: null,
      route_name: "",
      scheduled_time: nowLocal(),
      delegation_id: null,
      notes: undefined,
      stops: [
        { site_id: null, label: "", notes: undefined },
        { site_id: null, label: "", notes: undefined },
      ],
    },
  });

  const { fields, append, remove, move } = useFieldArray({
    control: form.control,
    name: "stops",
  });

  useEffect(() => {
    if (!open) return;
    form.reset({
      vehicle_id: null,
      route_name: "",
      scheduled_time: nowLocal(),
      delegation_id: null,
      notes: undefined,
      stops: [
        { site_id: null, label: "", notes: undefined },
        { site_id: null, label: "", notes: undefined },
      ],
    });
  }, [open, form]);

  async function onSubmit(values: CreateRouteInput) {
    setSubmitting(true);
    const payload = {
      ...values,
      scheduled_time: values.scheduled_time
        ? new Date(values.scheduled_time).toISOString()
        : undefined,
      stops: values.stops.map((s) => ({
        site_id: s.site_id || null,
        label: s.label?.trim() || undefined,
        notes: s.notes,
      })),
    };
    const result = await createRoute(payload);
    setSubmitting(false);

    if (result.error) {
      toast.error("Create failed", { description: result.error });
      return;
    }
    toast.success("Route added");
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger as React.ReactElement} />
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add route</DialogTitle>
          <DialogDescription>
            Multi-stop loops like &quot;City Hall Plaza → BCES → ACED → DOME →
            City Hall Plaza&quot;. First stop is the origin; last is the
            destination.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="route_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Route name</FormLabel>
                    <FormControl>
                      <Input placeholder="Route 1 — City Hall loop" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="vehicle_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Default vehicle</FormLabel>
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
                              const veh = vehicles.find((x) => x.id === v);
                              return veh ? veh.vehicle_code : "—";
                            }}
                          </SelectValue>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={NONE}>None</SelectItem>
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
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Stops (in order)</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    append({ site_id: null, label: "", notes: undefined })
                  }
                >
                  <Plus className="size-3.5" />
                  Add stop
                </Button>
              </div>
              <ul className="space-y-2">
                {fields.map((stopField, index) => (
                  <li
                    key={stopField.id}
                    className="flex items-start gap-2 rounded-md border p-2"
                  >
                    <div className="flex flex-col items-center gap-1 pt-1.5">
                      <GripVertical className="size-4 text-muted-foreground" />
                      <span className="font-mono text-xs text-muted-foreground">
                        {index + 1}
                      </span>
                    </div>
                    <div className="flex-1 space-y-2">
                      <FormField
                        control={form.control}
                        name={`stops.${index}.site_id`}
                        render={({ field }) => (
                          <FormItem>
                            <Select
                              value={field.value ?? SITE_FREE_TEXT}
                              onValueChange={(v) =>
                                field.onChange(
                                  v === SITE_FREE_TEXT ? null : v,
                                )
                              }
                            >
                              <FormControl>
                                <SelectTrigger className="w-full">
                                  <SelectValue>
                                    {(v: string | null) => {
                                      if (!v || v === SITE_FREE_TEXT)
                                        return "Free-text label below";
                                      const s = sites.find((x) => x.id === v);
                                      return s ? s.name : "—";
                                    }}
                                  </SelectValue>
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value={SITE_FREE_TEXT}>
                                  Free-text label below
                                </SelectItem>
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
                        name={`stops.${index}.label`}
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input
                                placeholder='e.g. "Salvacion Evac. Center"'
                                {...field}
                                value={field.value ?? ""}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        disabled={index === 0}
                        onClick={() => move(index, index - 1)}
                        aria-label="Move up"
                      >
                        <ArrowUp className="size-3.5" />
                      </Button>
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        disabled={index === fields.length - 1}
                        onClick={() => move(index, index + 1)}
                        aria-label="Move down"
                      >
                        <ArrowDown className="size-3.5" />
                      </Button>
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        disabled={fields.length <= 2}
                        onClick={() => remove(index)}
                        aria-label="Remove stop"
                      >
                        <X className="size-3.5" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
              {form.formState.errors.stops?.message ? (
                <p className="text-xs text-destructive">
                  {form.formState.errors.stops.message}
                </p>
              ) : null}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="scheduled_time"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Scheduled (PHT)</FormLabel>
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
                              return d
                                ? `${d.region_code} — ${d.region_name}`
                                : "—";
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
                Add route
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
