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
import {
  createGarbageCollector,
  updateGarbageCollector,
} from "@/lib/actions/garbage";
import {
  createGarbageCollectorSchema,
  type CreateGarbageCollectorInput,
} from "@/lib/schemas/garbage";
import type { Database } from "@/types/database";

type Collector = Database["palaro"]["Tables"]["garbage_collectors"]["Row"];

interface Props {
  /** Provided in edit mode, omitted in create mode (which uses the trigger button). */
  collector?: Collector | null;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

const emptyValues: CreateGarbageCollectorInput = {
  swm_coordinator_name: "",
  city_enro_coordinator_name: "",
  driver_name: "",
  vehicle_description: "",
  contact_number: "",
  is_active: true,
};

function toValues(c: Collector): CreateGarbageCollectorInput {
  return {
    swm_coordinator_name: c.swm_coordinator_name,
    city_enro_coordinator_name: c.city_enro_coordinator_name ?? "",
    driver_name: c.driver_name ?? "",
    vehicle_description: c.vehicle_description ?? "",
    contact_number: c.contact_number ?? "",
    is_active: c.is_active,
  };
}

export function CollectorDialog({
  collector,
  open: controlledOpen,
  onOpenChange,
}: Props) {
  const isEdit = !!collector;
  const [internalOpen, setInternalOpen] = useState(false);
  const open = isEdit ? !!controlledOpen : internalOpen;
  const setOpen = (next: boolean) => {
    if (isEdit) onOpenChange?.(next);
    else setInternalOpen(next);
  };

  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  const form = useForm<CreateGarbageCollectorInput>({
    resolver: zodResolver(createGarbageCollectorSchema),
    defaultValues: collector ? toValues(collector) : emptyValues,
  });

  useEffect(() => {
    if (open) {
      form.reset(collector ? toValues(collector) : emptyValues);
    }
  }, [open, collector, form]);

  async function onSubmit(values: CreateGarbageCollectorInput) {
    setSubmitting(true);
    const result = isEdit
      ? await updateGarbageCollector({ id: collector!.id, ...values })
      : await createGarbageCollector(values);
    setSubmitting(false);

    if (result.error) {
      toast.error(isEdit ? "Update failed" : "Create failed", {
        description: result.error,
      });
      return;
    }
    toast.success(isEdit ? "Collector updated" : "Collector added");
    setOpen(false);
    router.refresh();
  }

  const dialog = (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>
          {isEdit ? "Edit collector" : "Add garbage collector"}
        </DialogTitle>
        <DialogDescription>
          Collectors are the crews on the schedule. Inactive ones are hidden
          from rule and pickup pickers.
        </DialogDescription>
      </DialogHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
          <FormField
            control={form.control}
            name="swm_coordinator_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>SWM Coordinator name</FormLabel>
                <FormControl>
                  <Input placeholder="Juan Dela Cruz" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="city_enro_coordinator_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>City ENRO Coordinator name</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Maria Santos"
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
            name="driver_name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Driver name</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Pedro Santos"
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
            name="vehicle_description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Vehicle description</FormLabel>
                <FormControl>
                  <Input
                    placeholder="6-wheeler dump truck, plate ABC-1234"
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
            name="contact_number"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Contact number</FormLabel>
                <FormControl>
                  <Input
                    placeholder="0917…"
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
            name="is_active"
            render={({ field }) => (
              <FormItem className="flex items-center gap-2 space-y-0">
                <FormControl>
                  <Checkbox
                    checked={field.value ?? true}
                    onCheckedChange={(v) => field.onChange(v === true)}
                  />
                </FormControl>
                <FormLabel className="font-normal">Active</FormLabel>
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
              {submitting ? "Saving…" : isEdit ? "Save changes" : "Add collector"}
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
        Add collector
      </DialogTrigger>
      {dialog}
    </Dialog>
  );
}
