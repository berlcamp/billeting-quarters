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
import { requestGarbageCollection } from "@/lib/actions/garbage";
import {
  requestGarbageCollectionSchema,
  type RequestGarbageCollectionInput,
} from "@/lib/schemas/garbage";
import type { Database } from "@/types/database";

type Site = Pick<
  Database["palaro"]["Tables"]["sites"]["Row"],
  "id" | "name" | "site_type"
>;

function isoToLocal(iso: string): string {
  const d = new Date(iso);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

function nowLocalPlusHours(hours: number): string {
  const d = new Date();
  d.setHours(d.getHours() + hours);
  return isoToLocal(d.toISOString());
}

interface Props {
  trigger: ReactNode;
  sites: Site[];
}

export function RequestCollectionDialog({ trigger, sites }: Props) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();
  const bqs = sites.filter((s) => s.site_type === "billeting_quarter");

  const form = useForm<RequestGarbageCollectionInput>({
    resolver: zodResolver(requestGarbageCollectionSchema),
    defaultValues: {
      site_id: "",
      requested_at: nowLocalPlusHours(2),
      notes: undefined,
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        site_id: "",
        requested_at: nowLocalPlusHours(2),
        notes: undefined,
      });
    }
  }, [open, form]);

  async function onSubmit(values: RequestGarbageCollectionInput) {
    setSubmitting(true);
    const payload = {
      ...values,
      requested_at: new Date(values.requested_at).toISOString(),
    };
    const result = await requestGarbageCollection(payload);
    setSubmitting(false);

    if (result.error) {
      toast.error("Request failed", { description: result.error });
      return;
    }
    toast.success("Pickup requested");
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger as React.ReactElement} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Request garbage collection</DialogTitle>
          <DialogDescription>
            Files an on-demand pickup request from your BQ to the garbage
            committee.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                            const b = bqs.find((x) => x.id === v);
                            return b ? (
                              b.name
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
                      {bqs.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.name}
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
              name="requested_at"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Requested pickup (PHT)</FormLabel>
                  <FormControl>
                    <Input type="datetime-local" {...field} />
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
                    <Textarea
                      rows={2}
                      placeholder="Anything the committee should know."
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
                Submit request
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
