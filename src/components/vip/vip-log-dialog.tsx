"use client";

import { useState, type ReactNode } from "react";
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
import { createVipLog } from "@/lib/actions/vip";
import {
  createVipLogSchema,
  type CreateVipLogInput,
} from "@/lib/schemas/vip";

interface Props {
  vipId: string;
  vipName: string;
  trigger: ReactNode;
}

export function VipLogDialog({ vipId, vipName, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  const form = useForm<CreateVipLogInput>({
    resolver: zodResolver(createVipLogSchema),
    defaultValues: {
      vip_id: vipId,
      from_location: undefined,
      to_location: undefined,
      logged_at: undefined,
      request: undefined,
      remarks: undefined,
    },
  });

  async function onSubmit(values: CreateVipLogInput) {
    setSubmitting(true);
    const result = await createVipLog(values);
    setSubmitting(false);

    if (result.error) {
      toast.error("Failed to log entry", { description: result.error });
      return;
    }
    toast.success("Entry logged");
    form.reset({
      vip_id: vipId,
      from_location: undefined,
      to_location: undefined,
      logged_at: undefined,
      request: undefined,
      remarks: undefined,
    });
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger as React.ReactElement} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Log entry — {vipName}</DialogTitle>
          <DialogDescription>
            Whereabouts, requests, and concerns. The system stamps the entry
            with the current time automatically.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="from_location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>From</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Hotel"
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
                name="to_location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>To</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Opening venue"
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
              name="request"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Request / concern</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={3}
                      placeholder="What does the VIP need?"
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
              name="remarks"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Remarks</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={2}
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
                Save
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
