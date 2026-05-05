"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createSchedule, updateSchedule } from "@/lib/actions/venues";
import {
  createScheduleSchema,
  type CreateScheduleInput,
} from "@/lib/schemas/venues";
import { PALARO_SPORTS } from "@/lib/labels";
import type { Database } from "@/types/database";

type Venue = Pick<
  Database["palaro"]["Tables"]["sites"]["Row"],
  "id" | "name" | "site_type"
>;
type Delegation = Pick<
  Database["palaro"]["Tables"]["delegations"]["Row"],
  "id" | "region_code" | "region_name"
>;
type Schedule = Database["palaro"]["Tables"]["venue_schedules"]["Row"];

const SPORT_NONE = "__none__";

function isoToLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

function localToIso(local: string): string {
  return new Date(local).toISOString();
}

function nowLocal(): string {
  return isoToLocal(new Date().toISOString());
}

function plusHoursLocal(hours: number): string {
  const d = new Date();
  d.setHours(d.getHours() + hours);
  return isoToLocal(d.toISOString());
}

interface Props {
  trigger: ReactNode;
  venues: Venue[];
  delegations: Delegation[];
  schedule?: Schedule;
  defaultVenueId?: string;
  defaultStart?: string; // ISO
}

export function ScheduleFormDialog({
  trigger,
  venues,
  delegations,
  schedule,
  defaultVenueId,
  defaultStart,
}: Props) {
  const isEdit = !!schedule;
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  const form = useForm<CreateScheduleInput>({
    resolver: zodResolver(createScheduleSchema),
    defaultValues: {
      venue_id: schedule?.venue_id ?? defaultVenueId ?? "",
      delegation_id: schedule?.delegation_id ?? "",
      sport: schedule?.sport ?? undefined,
      scheduled_start: schedule
        ? isoToLocal(schedule.scheduled_start)
        : defaultStart
          ? isoToLocal(defaultStart)
          : nowLocal(),
      scheduled_end: schedule
        ? isoToLocal(schedule.scheduled_end)
        : plusHoursLocal(2),
      is_special_request: schedule?.is_special_request ?? false,
      special_request_reason: schedule?.special_request_reason ?? undefined,
      notes: schedule?.notes ?? undefined,
    },
  });

  const isSpecial = useWatch({
    control: form.control,
    name: "is_special_request",
  });

  useEffect(() => {
    if (open) {
      form.reset({
        venue_id: schedule?.venue_id ?? defaultVenueId ?? "",
        delegation_id: schedule?.delegation_id ?? "",
        sport: schedule?.sport ?? undefined,
        scheduled_start: schedule
          ? isoToLocal(schedule.scheduled_start)
          : defaultStart
            ? isoToLocal(defaultStart)
            : nowLocal(),
        scheduled_end: schedule
          ? isoToLocal(schedule.scheduled_end)
          : plusHoursLocal(2),
        is_special_request: schedule?.is_special_request ?? false,
        special_request_reason: schedule?.special_request_reason ?? undefined,
        notes: schedule?.notes ?? undefined,
      });
    }
  }, [open, schedule, defaultVenueId, defaultStart, form]);

  async function onSubmit(values: CreateScheduleInput) {
    setSubmitting(true);
    const payload = {
      ...values,
      scheduled_start: localToIso(values.scheduled_start),
      scheduled_end: localToIso(values.scheduled_end),
    };
    const result = isEdit
      ? await updateSchedule({ ...payload, id: schedule!.id })
      : await createSchedule(payload);
    setSubmitting(false);

    if (result.error) {
      toast.error(isEdit ? "Update failed" : "Booking failed", {
        description: result.error,
      });
      return;
    }
    toast.success(isEdit ? "Booking updated" : "Practice slot booked");
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger nativeButton={false} render={trigger as React.ReactElement} />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit booking" : "Book practice slot"}
          </DialogTitle>
          <DialogDescription>
            Times are in PHT, stored in UTC. Special requests need approval
            before they convert to confirmed bookings.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <FormField
              control={form.control}
              name="venue_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Venue</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue>
                          {(v: string | null) => {
                            const venue = venues.find((x) => x.id === v);
                            return venue ? (
                              venue.name
                            ) : (
                              <span className="text-muted-foreground">
                                Pick a venue
                              </span>
                            );
                          }}
                        </SelectValue>
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {venues.map((v) => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.name}
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
                  <FormLabel>Sport</FormLabel>
                  <Select
                    value={field.value ?? SPORT_NONE}
                    onValueChange={(v) =>
                      field.onChange(v === SPORT_NONE ? undefined : v)
                    }
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue>
                          {(v: string | null) => {
                            if (!v || v === SPORT_NONE) return "—";
                            return v;
                          }}
                        </SelectValue>
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={SPORT_NONE}>—</SelectItem>
                      {PALARO_SPORTS.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
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
                name="scheduled_start"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Start (PHT)</FormLabel>
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
                name="scheduled_end"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>End (PHT)</FormLabel>
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
            </div>
            <FormField
              control={form.control}
              name="is_special_request"
              render={({ field }) => (
                <FormItem className="flex items-center gap-2 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value ?? false}
                      onCheckedChange={(v) => field.onChange(v === true)}
                    />
                  </FormControl>
                  <FormLabel className="font-normal">
                    Special request — overrides conflicts; needs approval
                  </FormLabel>
                </FormItem>
              )}
            />
            {isSpecial ? (
              <FormField
                control={form.control}
                name="special_request_reason"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reason</FormLabel>
                    <FormControl>
                      <Textarea
                        rows={2}
                        placeholder="Why this slot is needed despite the conflict…"
                        {...field}
                        value={field.value ?? ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : null}
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
                {isEdit ? "Save" : "Book slot"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
