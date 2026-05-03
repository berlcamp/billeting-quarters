"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowUpCircle } from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { createUcfToHospitalReferral } from "@/lib/actions/referrals";
import {
  createUcfToHospitalReferralSchema,
  type CreateUcfToHospitalReferralInput,
} from "@/lib/schemas/referrals";
import type { Database } from "@/types/database";

type Site = Pick<Database["palaro"]["Tables"]["sites"]["Row"], "id" | "name">;

interface ReferToHospitalDialogProps {
  sourceUcfReferralId: string;
  hospitalSites: Site[];
}

export function ReferToHospitalDialog({
  sourceUcfReferralId,
  hospitalSites,
}: ReferToHospitalDialogProps) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  const form = useForm<CreateUcfToHospitalReferralInput>({
    resolver: zodResolver(createUcfToHospitalReferralSchema),
    defaultValues: {
      source_ucf_referral_id: sourceUcfReferralId,
      to_site_id: "",
      escalation_notes: undefined,
    },
  });

  async function onSubmit(values: CreateUcfToHospitalReferralInput) {
    setSubmitting(true);
    const result = await createUcfToHospitalReferral(values);
    setSubmitting(false);
    if (result.error) {
      toast.error("Hospital referral failed", { description: result.error });
      return;
    }
    toast.success(`Hospital referral created: ${result.data!.referral_number}`, {
      description: "The receiving hospital has been notified.",
    });
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button variant="outline" />}>
        <ArrowUpCircle className="size-4" />
        Refer to Hospital
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Escalate to Hospital</DialogTitle>
          <DialogDescription>
            Patient details, vitals, and your UCF assessment carry forward
            automatically. The current UCF referral will be marked as Admitted.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <FormField
              control={form.control}
              name="to_site_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Target hospital</FormLabel>
                  <Select
                    value={field.value ?? ""}
                    onValueChange={field.onChange}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue>
                          {(v: string | null) => {
                            if (!v) {
                              return (
                                <span className="text-muted-foreground">
                                  Pick a hospital
                                </span>
                              );
                            }
                            const site = hospitalSites.find((s) => s.id === v);
                            return site ? site.name : v;
                          }}
                        </SelectValue>
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {hospitalSites.length === 0 ? (
                        <div className="px-3 py-2 text-sm text-muted-foreground">
                          No hospitals configured. Add one in Admin → Sites.
                        </div>
                      ) : (
                        hospitalSites.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name}
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
              name="escalation_notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Escalation notes (optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={3}
                      placeholder="Why is this patient being escalated?"
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
                {submitting ? "Sending…" : "Send to hospital"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
