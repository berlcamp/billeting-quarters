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
import { DAY_OF_WEEK_LABELS, ISO_DAYS } from "@/lib/garbage-week";
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
  day_of_week: 1,
  time_of_day: "06:00",
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
    day_of_week: r.day_of_week,
    time_of_day: trimTime(r.time_of_day),
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
                            c.coordinator_name
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
                        {c.coordinator_name}
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
              name="day_of_week"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Day of week</FormLabel>
                  <Select
                    value={String(field.value ?? 1)}
                    onValueChange={(v) => field.onChange(Number(v))}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue>
                          {(v: string | null) => {
                            const n = Number(v);
                            return DAY_OF_WEEK_LABELS[n] ?? "Pick a day";
                          }}
                        </SelectValue>
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {ISO_DAYS.map((d) => (
                        <SelectItem key={d} value={String(d)}>
                          {DAY_OF_WEEK_LABELS[d]}
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
              name="time_of_day"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Time (PHT)</FormLabel>
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
