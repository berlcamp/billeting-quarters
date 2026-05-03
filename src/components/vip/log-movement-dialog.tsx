"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus } from "lucide-react";
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
import { createMovement } from "@/lib/actions/vip";
import {
  createMovementSchema,
  type CreateMovementInput,
} from "@/lib/schemas/vip";
import type { Database } from "@/types/database";

type Vip = Pick<
  Database["palaro"]["Tables"]["vip_persons"]["Row"],
  "id" | "full_name" | "title" | "organization"
>;
type Site = Pick<
  Database["palaro"]["Tables"]["sites"]["Row"],
  "id" | "name" | "site_type"
>;

const NO_SITE = "__none__";

interface Props {
  vips: Vip[];
  sites: Site[];
}

// Build a string like "2026-05-03T14:30" for <input type="datetime-local"> default.
function nowLocalIso() {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

// Convert a datetime-local string ("YYYY-MM-DDTHH:mm") to ISO with the local
// offset, so the server stores the UTC moment correctly.
function localToIsoWithOffset(local: string): string {
  if (!local) return local;
  return new Date(local).toISOString();
}

export function LogMovementDialog({ vips, sites }: Props) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  const form = useForm<CreateMovementInput>({
    resolver: zodResolver(createMovementSchema),
    defaultValues: {
      vip_id: "",
      destination_site_id: null,
      estimated_arrival: nowLocalIso(),
      purpose: undefined,
      vehicle_info: undefined,
      escort_count: undefined,
      notes: undefined,
    },
  });

  async function onSubmit(values: CreateMovementInput) {
    setSubmitting(true);
    const result = await createMovement({
      ...values,
      estimated_arrival: localToIsoWithOffset(values.estimated_arrival),
    });
    setSubmitting(false);

    if (result.error) {
      toast.error("Failed to log movement", { description: result.error });
      return;
    }
    toast.success("Movement logged");
    form.reset({
      vip_id: "",
      destination_site_id: null,
      estimated_arrival: nowLocalIso(),
      purpose: undefined,
      vehicle_info: undefined,
      escort_count: undefined,
      notes: undefined,
    });
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <Plus className="size-4" />
        Log movement
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Log VIP movement</DialogTitle>
          <DialogDescription>
            Records the estimated arrival. Log actual arrival and departure
            from the row actions once the VIP is in motion.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <FormField
              control={form.control}
              name="vip_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>VIP</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue>
                          {(v: string | null) => {
                            const vip = vips.find((x) => x.id === v);
                            return vip ? (
                              `${vip.full_name}${vip.title ? ` · ${vip.title}` : ""}`
                            ) : (
                              <span className="text-muted-foreground">
                                Select a VIP
                              </span>
                            );
                          }}
                        </SelectValue>
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {vips.length === 0 ? (
                        <div className="p-2 text-xs text-muted-foreground">
                          No VIPs yet — add one first.
                        </div>
                      ) : (
                        vips.map((v) => (
                          <SelectItem key={v.id} value={v.id}>
                            {v.full_name}
                            {v.title ? ` · ${v.title}` : ""}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="destination_site_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Destination (optional)</FormLabel>
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
                            const site = sites.find((s) => s.id === v);
                            return site ? site.name : "None";
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
              name="estimated_arrival"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Estimated arrival (PHT)</FormLabel>
                  <FormControl>
                    <Input
                      type="datetime-local"
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
              name="purpose"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Purpose</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Opening ceremony, courtside…"
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="vehicle_info"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vehicle</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Plate / convoy"
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
                name="escort_count"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Escorts</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        inputMode="numeric"
                        step="1"
                        min={0}
                        max={200}
                        placeholder="0"
                        value={field.value ?? ""}
                        onChange={(e) => {
                          const v = e.target.value;
                          field.onChange(v === "" ? undefined : Number(v));
                        }}
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
