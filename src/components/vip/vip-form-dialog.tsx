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
import { createVip, updateVip } from "@/lib/actions/vip";
import {
  createVipSchema,
  type CreateVipInput,
} from "@/lib/schemas/vip";
import type { Database } from "@/types/database";

type Vip = Database["palaro"]["Tables"]["vip_persons"]["Row"];
type Delegation = Pick<
  Database["palaro"]["Tables"]["delegations"]["Row"],
  "id" | "region_code" | "region_name"
>;

const NO_DELEGATION = "__none__";

interface Props {
  trigger: ReactNode;
  delegations: Delegation[];
  vip?: Vip;
}

export function VipFormDialog({ trigger, delegations, vip }: Props) {
  const isEdit = !!vip;
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  const form = useForm<CreateVipInput>({
    resolver: zodResolver(createVipSchema),
    defaultValues: {
      full_name: vip?.full_name ?? "",
      title: vip?.title ?? undefined,
      organization: vip?.organization ?? undefined,
      delegation_id: vip?.delegation_id ?? null,
      contact_number: vip?.contact_number ?? undefined,
      notes: vip?.notes ?? undefined,
    },
  });

  // Reset form when the dialog opens for a (potentially refreshed) edit target.
  useEffect(() => {
    if (open) {
      form.reset({
        full_name: vip?.full_name ?? "",
        title: vip?.title ?? undefined,
        organization: vip?.organization ?? undefined,
        delegation_id: vip?.delegation_id ?? null,
        contact_number: vip?.contact_number ?? undefined,
        notes: vip?.notes ?? undefined,
      });
    }
  }, [open, vip, form]);

  async function onSubmit(values: CreateVipInput) {
    setSubmitting(true);
    const result = isEdit
      ? await updateVip({ ...values, id: vip!.id })
      : await createVip(values);
    setSubmitting(false);

    if (result.error) {
      toast.error(isEdit ? "Update failed" : "Create failed", {
        description: result.error,
      });
      return;
    }
    toast.success(isEdit ? "VIP updated" : "VIP added");
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger as React.ReactElement} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit VIP" : "Add VIP"}</DialogTitle>
          <DialogDescription>
            VIP records are reusable across multiple movements.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <FormField
              control={form.control}
              name="full_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full name</FormLabel>
                  <FormControl>
                    <Input placeholder="Hon. Juan Dela Cruz" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Secretary, Senator…"
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
                name="organization"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Organization</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="DepEd, OP…"
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
              name="delegation_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Delegation (optional)</FormLabel>
                  <Select
                    value={field.value ?? NO_DELEGATION}
                    onValueChange={(v) =>
                      field.onChange(v === NO_DELEGATION ? null : v)
                    }
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue>
                          {(v: string | null) => {
                            if (!v || v === NO_DELEGATION) return "None";
                            const d = delegations.find((x) => x.id === v);
                            return d
                              ? `${d.region_code} — ${d.region_name}`
                              : "None";
                          }}
                        </SelectValue>
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={NO_DELEGATION}>None</SelectItem>
                      {delegations.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          {d.region_code} — {d.region_name}
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
              name="contact_number"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contact number</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="+63…"
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
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes</FormLabel>
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
                {isEdit ? "Save" : "Add VIP"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
