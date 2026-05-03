"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronDown, ChevronUp, Plus } from "lucide-react";
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
import { createFieldReferral } from "@/lib/actions/referrals";
import {
  createFieldReferralSchema,
  type CreateFieldReferralInput,
} from "@/lib/schemas/referrals";
import {
  PATIENT_GENDERS,
  PATIENT_GENDER_LABELS,
  type PatientGender,
} from "@/lib/labels";
import type { Database } from "@/types/database";

type Site = Pick<Database["palaro"]["Tables"]["sites"]["Row"], "id" | "name" | "site_type">;
type Delegation = Pick<
  Database["palaro"]["Tables"]["delegations"]["Row"],
  "id" | "region_code" | "region_name"
>;

const NO_DELEGATION = "__none__";

interface PrefillFromIncident {
  incidentId: string;
  patientName?: string | null;
  patientAge?: number | null;
  delegationId?: string | null;
}

interface CreateFieldReferralDialogProps {
  ucfSites: Site[];
  delegations: Delegation[];
  /** When provided, the dialog is "controlled" via this trigger element instead of the default button. */
  trigger?: ReactNode;
  /** Pre-fill values when opened from an incident detail page. */
  prefill?: PrefillFromIncident;
}

const emptyValues: CreateFieldReferralInput = {
  incident_id: null,
  patient_name: "",
  patient_age: undefined,
  patient_gender: undefined,
  delegation_id: null,
  chief_complaint: undefined,
  treatment_given: undefined,
  vital_signs: undefined,
  to_site_id: "",
  from_site_id: null,
};

export function CreateFieldReferralDialog({
  ucfSites,
  delegations,
  trigger,
  prefill,
}: CreateFieldReferralDialogProps) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showVitals, setShowVitals] = useState(false);
  const router = useRouter();

  const form = useForm<CreateFieldReferralInput>({
    resolver: zodResolver(createFieldReferralSchema),
    defaultValues: emptyValues,
  });

  useEffect(() => {
    if (open) {
      form.reset({
        ...emptyValues,
        incident_id: prefill?.incidentId ?? null,
        patient_name: prefill?.patientName ?? "",
        patient_age: prefill?.patientAge ?? undefined,
        delegation_id: prefill?.delegationId ?? null,
      });
    }
  }, [open, prefill, form]);

  async function onSubmit(values: CreateFieldReferralInput) {
    setSubmitting(true);
    const result = await createFieldReferral(values);
    setSubmitting(false);
    if (result.error) {
      toast.error("Referral failed", { description: result.error });
      return;
    }
    toast.success(`Referral created: ${result.data!.referral_number}`, {
      description: "The receiving UCF has been notified.",
    });
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? (
        <DialogTrigger render={trigger as React.ReactElement<Record<string, unknown>>} />
      ) : (
        <DialogTrigger render={<Button />}>
          <Plus className="size-4" />
          Create referral
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Field → UCF referral</DialogTitle>
          <DialogDescription>
            The receiving UCF will be notified immediately and can begin assessment.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <div className="grid grid-cols-[2fr_1fr_1fr] gap-3">
              <FormField
                control={form.control}
                name="patient_name"
                render={({ field }) => (
                  <FormItem className="col-span-3 sm:col-span-1">
                    <FormLabel>Patient name</FormLabel>
                    <FormControl>
                      <Input {...field} autoFocus />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="patient_age"
                render={({ field }) => (
                  <FormItem className="col-span-1">
                    <FormLabel>Age</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        max={150}
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
              <FormField
                control={form.control}
                name="patient_gender"
                render={({ field }) => (
                  <FormItem className="col-span-2 sm:col-span-1">
                    <FormLabel>Gender</FormLabel>
                    <Select
                      value={field.value ?? ""}
                      onValueChange={(v) =>
                        field.onChange(v === "" ? undefined : (v as PatientGender))
                      }
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue>
                            {(v: string | null) =>
                              v && v in PATIENT_GENDER_LABELS ? (
                                PATIENT_GENDER_LABELS[v as PatientGender]
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )
                            }
                          </SelectValue>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {PATIENT_GENDERS.map((g) => (
                          <SelectItem key={g} value={g}>
                            {PATIENT_GENDER_LABELS[g]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                  <FormLabel>Delegation</FormLabel>
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
                            if (!v || v === NO_DELEGATION) {
                              return (
                                <span className="text-muted-foreground">
                                  No delegation
                                </span>
                              );
                            }
                            const d = delegations.find((dd) => dd.id === v);
                            return d
                              ? `${d.region_code} — ${d.region_name}`
                              : v;
                          }}
                        </SelectValue>
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={NO_DELEGATION}>No delegation</SelectItem>
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
              name="chief_complaint"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Chief complaint</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={2}
                      placeholder="What's the main reason for referral?"
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
              name="treatment_given"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Treatment given on field</FormLabel>
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

            <div className="space-y-2">
              <Button
                type="button"
                variant="outline"
                className="w-full justify-between"
                onClick={() => setShowVitals((s) => !s)}
              >
                Vitals (optional)
                {showVitals ? (
                  <ChevronUp className="size-4" />
                ) : (
                  <ChevronDown className="size-4" />
                )}
              </Button>
              {showVitals ? (
                <div className="grid grid-cols-2 gap-3 rounded-md border p-3">
                  <FormField
                    control={form.control}
                    name="vital_signs.bp"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>BP</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="120/80"
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
                    name="vital_signs.hr"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>HR (bpm)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={0}
                            max={300}
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
                  <FormField
                    control={form.control}
                    name="vital_signs.temp"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Temp (°C)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.1"
                            min={0}
                            max={50}
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
                  <FormField
                    control={form.control}
                    name="vital_signs.rr"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>RR (/min)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={0}
                            max={80}
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
                  <FormField
                    control={form.control}
                    name="vital_signs.spo2"
                    render={({ field }) => (
                      <FormItem className="col-span-2">
                        <FormLabel>SpO₂ (%)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={0}
                            max={100}
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
              ) : null}
            </div>

            <FormField
              control={form.control}
              name="to_site_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Refer to UCF</FormLabel>
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
                                  Pick a UCF
                                </span>
                              );
                            }
                            const site = ucfSites.find((s) => s.id === v);
                            return site ? site.name : v;
                          }}
                        </SelectValue>
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {ucfSites.length === 0 ? (
                        <div className="px-3 py-2 text-sm text-muted-foreground">
                          No UCFs configured. Add one in Admin → Sites.
                        </div>
                      ) : (
                        ucfSites.map((s) => (
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
                {submitting ? "Sending…" : "Send referral"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
