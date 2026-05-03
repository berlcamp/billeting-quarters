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
import { createDuty, updateDuty } from "@/lib/actions/personnel";
import {
  createDutySchema,
  type CreateDutyInput,
} from "@/lib/schemas/personnel";
import type { Database } from "@/types/database";

type Profile = Database["palaro"]["Tables"]["profiles"]["Row"];
type Site = Pick<
  Database["palaro"]["Tables"]["sites"]["Row"],
  "id" | "name" | "site_type"
>;
type Duty = Database["palaro"]["Tables"]["duty_schedules"]["Row"];

const NO_SITE = "__none__";

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
  personnel: Profile[];
  sites: Site[];
  duty?: Duty;
}

export function DutyFormDialog({ trigger, personnel, sites, duty }: Props) {
  const isEdit = !!duty;
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  const form = useForm<CreateDutyInput>({
    resolver: zodResolver(createDutySchema),
    defaultValues: {
      personnel_id: duty?.personnel_id ?? "",
      site_id: duty?.site_id ?? null,
      duty_start: duty ? isoToLocal(duty.duty_start) : nowLocal(),
      duty_end: duty ? isoToLocal(duty.duty_end) : plusHoursLocal(8),
      shift_label: duty?.shift_label ?? undefined,
      notes: duty?.notes ?? undefined,
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        personnel_id: duty?.personnel_id ?? "",
        site_id: duty?.site_id ?? null,
        duty_start: duty ? isoToLocal(duty.duty_start) : nowLocal(),
        duty_end: duty ? isoToLocal(duty.duty_end) : plusHoursLocal(8),
        shift_label: duty?.shift_label ?? undefined,
        notes: duty?.notes ?? undefined,
      });
    }
  }, [open, duty, form]);

  async function onSubmit(values: CreateDutyInput) {
    setSubmitting(true);
    const payload = {
      ...values,
      duty_start: localToIso(values.duty_start),
      duty_end: localToIso(values.duty_end),
    };
    const result = isEdit
      ? await updateDuty({ ...payload, id: duty!.id })
      : await createDuty(payload);
    setSubmitting(false);

    if (result.error) {
      toast.error(isEdit ? "Update failed" : "Create failed", {
        description: result.error,
      });
      return;
    }
    toast.success(isEdit ? "Shift updated" : "Shift scheduled");
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger as React.ReactElement} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit shift" : "Schedule shift"}</DialogTitle>
          <DialogDescription>
            Times are entered in PHT and stored in UTC.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <FormField
              control={form.control}
              name="personnel_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Personnel</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue>
                          {(v: string | null) => {
                            const p = personnel.find((x) => x.id === v);
                            return p ? (
                              p.full_name || p.email
                            ) : (
                              <span className="text-muted-foreground">
                                Select personnel
                              </span>
                            );
                          }}
                        </SelectValue>
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {personnel.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.full_name || p.email}
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
                  <FormLabel>Site (optional)</FormLabel>
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
                            if (!v || v === NO_SITE) return "None";
                            const s = sites.find((x) => x.id === v);
                            return s ? s.name : "None";
                          }}
                        </SelectValue>
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={NO_SITE}>None</SelectItem>
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
                name="duty_start"
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
                name="duty_end"
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
              name="shift_label"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Shift label</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="morning, evening, graveyard…"
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
                {isEdit ? "Save" : "Schedule"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
