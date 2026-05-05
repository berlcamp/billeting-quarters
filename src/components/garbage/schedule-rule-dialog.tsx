"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  createGarbageScheduleRule,
  updateGarbageScheduleRule,
} from "@/lib/actions/garbage";
import {
  createGarbageRuleSchema,
  type CreateGarbageRuleInput,
} from "@/lib/schemas/garbage";
import { DAY_OF_WEEK_SHORT, ISO_DAYS } from "@/lib/garbage-week";
import { cn } from "@/lib/utils";
import type { Database } from "@/types/database";

type Rule = Database["palaro"]["Tables"]["garbage_schedule_rules"]["Row"];
type Collector = Database["palaro"]["Tables"]["garbage_collectors"]["Row"];
type Site = Pick<
  Database["palaro"]["Tables"]["sites"]["Row"],
  "id" | "name" | "site_type"
>;

interface Props {
  rule?: Rule | null;
  collectors: Collector[];
  sites: Site[];
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const emptyValues: CreateGarbageRuleInput = {
  collector_id: "",
  site_id: "",
  days_of_week: [],
  time_of_day: "06:00",
  time_of_day_pm: "",
  is_active: true,
  notes: "",
};

function trimTime(value: string): string {
  return value.slice(0, 5);
}

function toValues(r: Rule): CreateGarbageRuleInput {
  return {
    collector_id: r.collector_id,
    site_id: r.site_id,
    days_of_week: [...(r.days_of_week ?? [])].sort((a, b) => a - b),
    time_of_day: trimTime(r.time_of_day),
    time_of_day_pm: r.time_of_day_pm ? trimTime(r.time_of_day_pm) : "",
    is_active: r.is_active,
    notes: r.notes ?? "",
  };
}

export function ScheduleRuleDialog({
  rule,
  collectors,
  sites,
  open: controlledOpen,
  onOpenChange,
}: Props) {
  const isEdit = !!rule;
  const [internalOpen, setInternalOpen] = useState(false);
  const open = isEdit ? !!controlledOpen : internalOpen;
  const setOpen = (next: boolean) => {
    if (isEdit) onOpenChange?.(next);
    else setInternalOpen(next);
  };

  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  const form = useForm<CreateGarbageRuleInput>({
    resolver: zodResolver(createGarbageRuleSchema),
    defaultValues: rule ? toValues(rule) : emptyValues,
  });

  useEffect(() => {
    if (open) {
      form.reset(rule ? toValues(rule) : emptyValues);
    }
  }, [open, rule, form]);

  async function onSubmit(values: CreateGarbageRuleInput) {
    setSubmitting(true);
    const result = isEdit
      ? await updateGarbageScheduleRule({ id: rule!.id, ...values })
      : await createGarbageScheduleRule(values);
    setSubmitting(false);

    if (result.error) {
      toast.error(isEdit ? "Update failed" : "Create failed", {
        description: result.error,
      });
      return;
    }
    toast.success(isEdit ? "Rule updated" : "Rule added");
    setOpen(false);
    router.refresh();
  }

  const dialog = (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>
          {isEdit ? "Edit schedule rule" : "Add schedule rule"}
        </DialogTitle>
        <DialogDescription>
          A rule repeats every week. Each week&apos;s pickups are generated
          from the active rules.
        </DialogDescription>
      </DialogHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
          <FormField
            control={form.control}
            name="collector_id"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Collector</FormLabel>
                <Select value={field.value} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue>
                        {(v: string | null) => {
                          const c = collectors.find((x) => x.id === v);
                          return c ? (
                            (c.driver_name ?? "—")
                          ) : (
                            <span className="text-muted-foreground">
                              Pick a collector
                            </span>
                          );
                        }}
                      </SelectValue>
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {collectors.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {(c.driver_name ?? "—")}
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
          <FormField
            control={form.control}
            name="days_of_week"
            render={({ field }) => {
              const selected = new Set(field.value ?? []);
              const toggle = (d: number) => {
                const next = new Set(selected);
                if (next.has(d)) next.delete(d);
                else next.add(d);
                field.onChange(Array.from(next).sort((a, b) => a - b));
              };
              return (
                <FormItem>
                  <FormLabel>Days of week</FormLabel>
                  <div className="flex flex-wrap gap-1.5">
                    {ISO_DAYS.map((d) => {
                      const isOn = selected.has(d);
                      return (
                        <button
                          key={d}
                          type="button"
                          onClick={() => toggle(d)}
                          aria-pressed={isOn}
                          className={cn(
                            "h-9 min-w-12 rounded-md border px-3 text-xs font-medium transition-colors",
                            isOn
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border bg-background text-muted-foreground hover:bg-muted",
                          )}
                        >
                          {DAY_OF_WEEK_SHORT[d]}
                        </button>
                      );
                    })}
                  </div>
                  <FormMessage />
                </FormItem>
              );
            }}
          />
          <div className="grid grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="time_of_day"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>AM time (PHT)</FormLabel>
                  <FormControl>
                    <Input
                      type="time"
                      step={60}
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
              name="time_of_day_pm"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    PM time{" "}
                    <span className="text-muted-foreground">(optional)</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      type="time"
                      step={60}
                      value={field.value ?? ""}
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
            name="is_active"
            render={({ field }) => (
              <FormItem className="flex items-center gap-2 space-y-0">
                <FormControl>
                  <Checkbox
                    checked={field.value ?? true}
                    onCheckedChange={(v) => field.onChange(v === true)}
                  />
                </FormControl>
                <FormLabel className="font-normal">
                  Active — include in weekly generation
                </FormLabel>
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
              {submitting ? "Saving…" : isEdit ? "Save changes" : "Add rule"}
            </Button>
          </DialogFooter>
        </form>
      </Form>
    </DialogContent>
  );

  if (isEdit) {
    return (
      <Dialog open={open} onOpenChange={setOpen}>
        {dialog}
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <Plus className="size-4" />
        Add rule
      </DialogTrigger>
      {dialog}
    </Dialog>
  );
}
