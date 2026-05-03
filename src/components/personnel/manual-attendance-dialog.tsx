"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, UserPlus } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { recordAttendance } from "@/lib/actions/personnel";
import {
  recordAttendanceSchema,
  type RecordAttendanceInput,
} from "@/lib/schemas/personnel";
import {
  ATTENDANCE_TYPE_LABELS,
  type AttendanceType,
} from "@/lib/labels";
import type { Database } from "@/types/database";

type Personnel = Pick<
  Database["palaro"]["Tables"]["profiles"]["Row"],
  "id" | "full_name" | "email" | "role" | "agency"
>;
type Site = Pick<
  Database["palaro"]["Tables"]["sites"]["Row"],
  "id" | "name" | "site_type"
>;

const NO_SITE = "__none__";

interface Props {
  personnel: Personnel[];
  sites: Site[];
}

const TYPES: AttendanceType[] = ["time_in", "time_out"];

export function ManualAttendanceDialog({ personnel, sites }: Props) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  const form = useForm<RecordAttendanceInput>({
    resolver: zodResolver(recordAttendanceSchema),
    defaultValues: {
      personnel_id: "",
      site_id: null,
      type: "time_in",
      notes: undefined,
    },
  });

  async function onSubmit(values: RecordAttendanceInput) {
    setSubmitting(true);
    const result = await recordAttendance(values);
    setSubmitting(false);

    if (result.error) {
      toast.error("Failed to record", { description: result.error });
      return;
    }
    toast.success(`${ATTENDANCE_TYPE_LABELS[result.data!.type]} recorded`);
    form.reset({
      personnel_id: "",
      site_id: null,
      type: "time_in",
      notes: undefined,
    });
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" />}>
        <UserPlus className="size-4" />
        Manual entry
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record attendance</DialogTitle>
          <DialogDescription>
            Use when QR scanning isn&apos;t available. Logged with your account
            as the recorder.
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
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Type</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={(v) =>
                      field.onChange(v as AttendanceType)
                    }
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
                Record
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
