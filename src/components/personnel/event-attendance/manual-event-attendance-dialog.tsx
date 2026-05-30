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
import { Input } from "@/components/ui/input";
import { logManualEventAttendance } from "@/lib/actions/event-attendance";
import {
  manualEventAttendanceSchema,
  type ManualEventAttendanceInput,
} from "@/lib/schemas/event-attendance";

interface Props {
  eventId: string;
}

export function ManualEventAttendanceDialog({ eventId }: Props) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  const form = useForm<ManualEventAttendanceInput>({
    resolver: zodResolver(manualEventAttendanceSchema),
    defaultValues: {
      event_id: eventId,
      full_name: "",
      committee: undefined,
      designation: undefined,
    },
  });

  async function onSubmit(values: ManualEventAttendanceInput) {
    setSubmitting(true);
    const result = await logManualEventAttendance(values);
    setSubmitting(false);

    if (result.error) {
      toast.error("Failed to record", { description: result.error });
      return;
    }
    toast.success("Time-in recorded");
    form.reset({
      event_id: eventId,
      full_name: "",
      committee: undefined,
      designation: undefined,
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
          <DialogTitle>Manual time-in</DialogTitle>
          <DialogDescription>
            Log a person who isn&apos;t yet in the personnel system. Only the name
            is required.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="full_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full name</FormLabel>
                  <FormControl>
                    <Input placeholder="Juan Dela Cruz" {...field} autoFocus />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="committee"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Committee / Agency</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Optional"
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
              name="designation"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Designation</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Optional"
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
                Record time-in
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
