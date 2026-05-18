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
import { updateAttendanceLog } from "@/lib/actions/personnel";
import {
  updateAttendanceLogSchema,
  type UpdateAttendanceLogInput,
} from "@/lib/schemas/personnel";
import {
  ATTENDANCE_TYPE_LABELS,
  type AttendanceType,
} from "@/lib/labels";
import type { Database } from "@/types/database";

type AttendanceLog = Database["palaro"]["Tables"]["attendance_logs"]["Row"];
type Site = Pick<Database["palaro"]["Tables"]["sites"]["Row"], "id" | "name">;

const NO_SITE = "__none__";
const TYPES: AttendanceType[] = ["time_in", "time_out"];

// `datetime-local` inputs render whatever string we give them as a naive
// wall-clock value. We want editors to see PHT regardless of their browser
// timezone, so we project the stored UTC instant into Asia/Manila parts.
function utcToManilaLocal(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

function manilaLocalToUtc(local: string): string {
  // PHT is UTC+8 with no DST — append the offset and let Date parse it.
  return new Date(`${local}:00+08:00`).toISOString();
}

interface Props {
  trigger: ReactNode;
  log: AttendanceLog;
  sites: Site[];
  personnelName?: string | null;
}

export function AttendanceEditDialog({
  trigger,
  log,
  sites,
  personnelName,
}: Props) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  const form = useForm<UpdateAttendanceLogInput>({
    resolver: zodResolver(updateAttendanceLogSchema),
    defaultValues: {
      id: log.id,
      scanned_at: log.scanned_at,
      type: log.type as AttendanceType,
      site_id: log.site_id ?? null,
      notes: log.notes ?? undefined,
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        id: log.id,
        scanned_at: log.scanned_at,
        type: log.type as AttendanceType,
        site_id: log.site_id ?? null,
        notes: log.notes ?? undefined,
      });
    }
  }, [open, log, form]);

  async function onSubmit(values: UpdateAttendanceLogInput) {
    setSubmitting(true);
    const result = await updateAttendanceLog(values);
    setSubmitting(false);

    if (result.error) {
      toast.error("Update failed", { description: result.error });
      return;
    }
    toast.success("Attendance log updated");
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger as React.ReactElement} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit attendance entry</DialogTitle>
          <DialogDescription>
            {personnelName ? `${personnelName} · ` : ""}Times are entered in PHT
            and stored in UTC.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <FormField
              control={form.control}
              name="scanned_at"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Time (PHT)</FormLabel>
                  <FormControl>
                    <Input
                      type="datetime-local"
                      value={field.value ? utcToManilaLocal(field.value) : ""}
                      onChange={(e) =>
                        field.onChange(
                          e.target.value ? manilaLocalToUtc(e.target.value) : "",
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
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Type</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={(v) => field.onChange(v as AttendanceType)}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue>
                          {(v: string | null) =>
                            v && (v === "time_in" || v === "time_out") ? (
                              ATTENDANCE_TYPE_LABELS[v]
                            ) : (
                              <span className="text-muted-foreground">
                                Pick a type
                              </span>
                            )
                          }
                        </SelectValue>
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {ATTENDANCE_TYPE_LABELS[t]}
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
                Save
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
