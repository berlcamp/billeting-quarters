"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Pencil, Plus } from "lucide-react";
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
import { createEvent, updateEvent } from "@/lib/actions/event-attendance";
import {
  createEventSchema,
  type CreateEventInput,
} from "@/lib/schemas/event-attendance";
import type { Database } from "@/types/database";

type EventRow = Database["palaro"]["Tables"]["events"]["Row"];

interface Props {
  event?: EventRow;
  trigger?: ReactNode;
}

// `<input type="datetime-local">` wants "yyyy-MM-ddTHH:mm" — slice the stored
// ISO string down to that.
function toLocalInput(iso: string | null | undefined): string {
  if (!iso) return "";
  return iso.slice(0, 16);
}

export function EventFormDialog({ event, trigger }: Props) {
  const isEdit = !!event;
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  const form = useForm<CreateEventInput>({
    resolver: zodResolver(createEventSchema),
    defaultValues: {
      name: event?.name ?? "",
      description: event?.description ?? undefined,
      location: event?.location ?? undefined,
      event_date: toLocalInput(event?.event_date),
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        name: event?.name ?? "",
        description: event?.description ?? undefined,
        location: event?.location ?? undefined,
        event_date: toLocalInput(event?.event_date),
      });
    }
  }, [open, event, form]);

  async function onSubmit(values: CreateEventInput) {
    setSubmitting(true);
    const result = isEdit
      ? await updateEvent({ ...values, id: event!.id })
      : await createEvent(values);
    setSubmitting(false);

    if (result.error) {
      toast.error(isEdit ? "Update failed" : "Create failed", {
        description: result.error,
      });
      return;
    }
    toast.success(isEdit ? "Event updated" : "Event created");
    setOpen(false);
    router.refresh();
  }

  const defaultTrigger = isEdit ? (
    <Button variant="outline" size="sm">
      <Pencil className="size-3.5" />
      Edit
    </Button>
  ) : (
    <Button>
      <Plus className="size-4" />
      New event
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={(trigger ?? defaultTrigger) as React.ReactElement} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit event" : "New event"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the event details."
              : "Create an event, then log time-in attendance by scanning personnel QR codes."}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g. Opening Ceremony"
                      {...field}
                      autoFocus
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Location</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Optional venue / location"
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
              name="event_date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date &amp; time</FormLabel>
                  <FormControl>
                    <Input
                      type="datetime-local"
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
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={3}
                      placeholder="Optional notes."
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
                {isEdit ? "Save" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
