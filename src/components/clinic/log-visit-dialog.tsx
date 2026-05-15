"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Stethoscope } from "lucide-react";
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
import { createVisit } from "@/lib/actions/clinic";
import {
  createVisitSchema,
  type CreateVisitInput,
} from "@/lib/schemas/clinic";
import type { Database } from "@/types/database";

type Patient = Pick<
  Database["palaro"]["Tables"]["clinic_patients"]["Row"],
  "id" | "full_name" | "patient_number" | "medical_history"
>;
type Site = Pick<
  Database["palaro"]["Tables"]["sites"]["Row"],
  "id" | "name" | "site_type"
>;

interface Props {
  patients: Patient[];
  clinicSites: Site[];
  /** Pre-fill patient_id (from row action). */
  patientId?: string;
}

export function LogVisitDialog({ patients, clinicSites, patientId }: Props) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  const initialHistory =
    patientId
      ? (patients.find((p) => p.id === patientId)?.medical_history ?? "")
      : "";

  const form = useForm<CreateVisitInput>({
    resolver: zodResolver(createVisitSchema),
    defaultValues: {
      patient_id: patientId ?? "",
      site_id: clinicSites[0]?.id ?? "",
      vital_signs: {},
      chief_complaint: undefined,
      diagnosis: undefined,
      prescription: undefined,
      notes: undefined,
      medical_history: initialHistory,
    },
  });

  async function onSubmit(values: CreateVisitInput) {
    setSubmitting(true);
    const result = await createVisit(values);
    setSubmitting(false);

    if (result.error) {
      toast.error("Failed to log visit", { description: result.error });
      return;
    }
    toast.success("Visit logged");
    form.reset({
      patient_id: patientId ?? "",
      site_id: clinicSites[0]?.id ?? "",
      vital_signs: {},
      chief_complaint: undefined,
      diagnosis: undefined,
      prescription: undefined,
      notes: undefined,
      medical_history: initialHistory,
    });
    setOpen(false);
    router.refresh();
  }

  const triggerNode = patientId ? (
    <Button size="sm" variant="outline">
      <Stethoscope className="size-3.5" />
      Log visit
    </Button>
  ) : (
    <Button>
      <Stethoscope className="size-4" />
      Log visit
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={triggerNode} />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Log clinic visit</DialogTitle>
          <DialogDescription>
            Records a walk-in visit. Vitals and notes are stored in the
            patient&apos;s record.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="patient_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Patient</FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={(v) => {
                        field.onChange(v);
                        const p = patients.find((x) => x.id === v);
                        form.setValue(
                          "medical_history",
                          p?.medical_history ?? "",
                        );
                      }}
                      disabled={!!patientId}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue>
                            {(v: string | null) => {
                              const p = patients.find((x) => x.id === v);
                              return p ? (
                                p.full_name
                              ) : (
                                <span className="text-muted-foreground">
                                  Select patient
                                </span>
                              );
                            }}
                          </SelectValue>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {patients.map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.full_name} · {p.patient_number}
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
                    <FormLabel>Clinic site</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue>
                            {(v: string | null) => {
                              const s = clinicSites.find((x) => x.id === v);
                              return s ? (
                                s.name
                              ) : (
                                <span className="text-muted-foreground">
                                  Pick a clinic
                                </span>
                              );
                            }}
                          </SelectValue>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {clinicSites.length === 0 ? (
                          <div className="p-2 text-xs text-muted-foreground">
                            No clinic sites configured. Add one under Admin →
                            Sites.
                          </div>
                        ) : (
                          clinicSites.map((s) => (
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
            </div>

            <fieldset className="rounded-md border p-3">
              <legend className="px-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Vitals
              </legend>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <FormField
                  control={form.control}
                  name="vital_signs.bp"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">BP</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="120/80"
                          {...field}
                          value={field.value ?? ""}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="vital_signs.hr"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">HR</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="bpm"
                          {...field}
                          value={field.value ?? ""}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="vital_signs.temp_c"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">Temp °C</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="36.5"
                          {...field}
                          value={field.value ?? ""}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="vital_signs.spo2"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs">SpO₂ %</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="98"
                          {...field}
                          value={field.value ?? ""}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
              </div>
            </fieldset>

            <FormField
              control={form.control}
              name="chief_complaint"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Chief complaint</FormLabel>
                  <FormControl>
                    <Textarea rows={2} {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="diagnosis"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Diagnosis</FormLabel>
                  <FormControl>
                    <Textarea rows={2} {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="prescription"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Prescription</FormLabel>
                  <FormControl>
                    <Textarea rows={2} {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="medical_history"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Medical history</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={3}
                      placeholder="Chronic conditions, prior surgeries…"
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
                Save visit
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
