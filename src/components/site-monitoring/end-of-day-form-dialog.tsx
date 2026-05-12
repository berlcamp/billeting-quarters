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
import { Checkbox } from "@/components/ui/checkbox";
import {
  createEndOfDayReport,
  updateEndOfDayReport,
} from "@/lib/actions/site-monitoring";
import {
  createEndOfDaySchema,
  type CreateEndOfDayInput,
} from "@/lib/schemas/site-monitoring";
import type { Database } from "@/types/database";

type Site = Pick<Database["palaro"]["Tables"]["sites"]["Row"], "id" | "name" | "site_type">;
type Row = Database["palaro"]["Tables"]["end_of_day_reports"]["Row"];

function todayPH(): string {
  // YYYY-MM-DD for the current Manila local date.
  const now = new Date();
  const ph = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return ph.toISOString().slice(0, 10);
}

interface Props {
  trigger: ReactNode;
  sites: Site[];
  report?: Row;
}

export function EndOfDayFormDialog({ trigger, sites, report }: Props) {
  const isEdit = !!report;
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  // Restrict to billeting quarters — end-of-day is a BQ headcount.
  const bqs = sites.filter((s) => s.site_type === "billeting_quarter");

  const form = useForm<CreateEndOfDayInput>({
    resolver: zodResolver(createEndOfDaySchema),
    defaultValues: {
      site_id: report?.site_id ?? "",
      report_date: report?.report_date ?? todayPH(),
      all_accounted_for: report?.all_accounted_for ?? true,
      outside_athletes: report?.outside_athletes ?? 0,
      outside_personnel: report?.outside_personnel ?? 0,
      outside_officials: report?.outside_officials ?? 0,
      outside_details: report?.outside_details ?? undefined,
      reporting_officer_name: report?.reporting_officer_name ?? "",
      reporting_officer_position: report?.reporting_officer_position ?? undefined,
      notes: report?.notes ?? undefined,
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        site_id: report?.site_id ?? "",
        report_date: report?.report_date ?? todayPH(),
        all_accounted_for: report?.all_accounted_for ?? true,
        outside_athletes: report?.outside_athletes ?? 0,
        outside_personnel: report?.outside_personnel ?? 0,
        outside_officials: report?.outside_officials ?? 0,
        outside_details: report?.outside_details ?? undefined,
        reporting_officer_name: report?.reporting_officer_name ?? "",
        reporting_officer_position:
          report?.reporting_officer_position ?? undefined,
        notes: report?.notes ?? undefined,
      });
    }
  }, [open, report, form]);

  const allAccounted = form.watch("all_accounted_for");

  async function onSubmit(values: CreateEndOfDayInput) {
    setSubmitting(true);
    // When everyone is accounted for, force the outside-counts to zero.
    const payload = values.all_accounted_for
      ? {
          ...values,
          outside_athletes: 0,
          outside_personnel: 0,
          outside_officials: 0,
          outside_details: undefined,
        }
      : values;

    const result = isEdit
      ? await updateEndOfDayReport({ ...payload, id: report!.id })
      : await createEndOfDayReport(payload);
    setSubmitting(false);

    if (result.error) {
      toast.error(isEdit ? "Update failed" : "Save failed", {
        description: result.error,
      });
      return;
    }
    toast.success(isEdit ? "Report updated" : "Report logged");
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger as React.ReactElement} />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit end-of-day report" : "End-of-Day report"}
          </DialogTitle>
          <DialogDescription>
            Confirm whether everyone at this BQ is accounted for tonight.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="site_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Billeting Quarter</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue>
                            {(v: string | null) => {
                              const s = bqs.find((x) => x.id === v);
                              return s ? (
                                s.name
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
                        {bqs.map((s) => (
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
                name="report_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="all_accounted_for"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start gap-3 rounded-md border p-3">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={(v) => field.onChange(v === true)}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>All accounted for</FormLabel>
                    <p className="text-xs text-muted-foreground">
                      Tick if everyone at this BQ is present tonight.
                    </p>
                  </div>
                </FormItem>
              )}
            />

            {!allAccounted ? (
              <div className="space-y-3 rounded-md border border-dashed p-3">
                <div className="grid grid-cols-3 gap-3">
                  <FormField
                    control={form.control}
                    name="outside_athletes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Athletes</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={0}
                            value={field.value ?? 0}
                            onChange={(e) =>
                              field.onChange(
                                e.target.value === ""
                                  ? 0
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
                    name="outside_personnel"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Personnel</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={0}
                            value={field.value ?? 0}
                            onChange={(e) =>
                              field.onChange(
                                e.target.value === ""
                                  ? 0
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
                    name="outside_officials"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Officials</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={0}
                            value={field.value ?? 0}
                            onChange={(e) =>
                              field.onChange(
                                e.target.value === ""
                                  ? 0
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
                  name="outside_details"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Who is outside?</FormLabel>
                      <FormControl>
                        <Textarea
                          rows={2}
                          placeholder="Names, expected return, reason."
                          {...field}
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="reporting_officer_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Reporting officer</FormLabel>
                    <FormControl>
                      <Input placeholder="Full name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="reporting_officer_position"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Position</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="e.g. Info Hub Officer, PO2"
                        {...field}
                        value={field.value ?? ""}
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
                    <Textarea
                      rows={2}
                      placeholder="Anything else."
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
                {isEdit ? "Save" : "Submit report"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
