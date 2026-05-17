"use client";

import { useMemo, useState } from "react";
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
import { formatManila } from "@/lib/timezone";
import type { Database } from "@/types/database";

type Patient = Pick<
  Database["palaro"]["Tables"]["clinic_patients"]["Row"],
  "id" | "full_name" | "patient_number" | "allergies"
>;
type Site = Pick<
  Database["palaro"]["Tables"]["sites"]["Row"],
  "id" | "name" | "site_type"
>;
type VisitHistoryEntry = Pick<
  Database["palaro"]["Tables"]["clinic_visits"]["Row"],
  "id" | "patient_id" | "visit_date" | "history" | "physical_examination"
>;

interface Props {
  patients: Patient[];
  clinicSites: Site[];
  /** Pre-fill patient_id (from row action). */
  patientId?: string;
  /**
   * Past visits for any patient that may be selected. The dialog filters by
   * the currently selected patient_id to show their History and Physical
   * Examination running record.
   */
  visits?: VisitHistoryEntry[];
}

export function LogVisitDialog({
  patients,
  clinicSites,
  patientId,
  visits = [],
}: Props) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  const initialPatient = patientId
    ? patients.find((p) => p.id === patientId)
    : undefined;
  const initialAllergies = initialPatient?.allergies ?? "";

  const form = useForm<CreateVisitInput>({
    resolver: zodResolver(createVisitSchema),
    defaultValues: {
      patient_id: patientId ?? "",
      site_id: clinicSites[0]?.id ?? "",
      vital_signs: {},
      chief_complaint: undefined,
      history: undefined,
      physical_examination: undefined,
      diagnosis: undefined,
      treatment_given: undefined,
      notes: undefined,
      allergies: initialAllergies,
    },
  });

  const selectedPatientId = form.watch("patient_id");

  const priorVisits = useMemo(() => {
    if (!selectedPatientId) return [] as VisitHistoryEntry[];
    return visits
      .filter((v) => v.patient_id === selectedPatientId)
      .sort(
        (a, b) =>
          new Date(b.visit_date).getTime() - new Date(a.visit_date).getTime(),
      );
  }, [visits, selectedPatientId]);

  const priorHistory = useMemo(
    () =>
      priorVisits
        .filter((v) => v.history && v.history.trim().length > 0)
        .map((v) => ({
          id: v.id,
          date: v.visit_date,
          text: v.history as string,
        })),
    [priorVisits],
  );
  const priorPE = useMemo(
    () =>
      priorVisits
        .filter(
          (v) =>
            v.physical_examination &&
            v.physical_examination.trim().length > 0,
        )
        .map((v) => ({
          id: v.id,
          date: v.visit_date,
          text: v.physical_examination as string,
        })),
    [priorVisits],
  );

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
      history: undefined,
      physical_examination: undefined,
      diagnosis: undefined,
      treatment_given: undefined,
      notes: undefined,
      allergies: initialAllergies,
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
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
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
                        form.setValue("allergies", p?.allergies ?? "");
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
                  <FormLabel>Chief complaint (current visit)</FormLabel>
                  <FormControl>
                    <Textarea rows={2} {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="history"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Medical history</FormLabel>
                  {priorHistory.length > 0 ? (
                    <PriorEntriesList entries={priorHistory} />
                  ) : null}
                  <FormControl>
                    <Textarea
                      rows={3}
                      placeholder="Medical history for this visit…"
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
              name="physical_examination"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Physical examination</FormLabel>
                  {priorPE.length > 0 ? (
                    <PriorEntriesList entries={priorPE} />
                  ) : null}
                  <FormControl>
                    <Textarea
                      rows={3}
                      placeholder="PE findings for this visit…"
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
              name="treatment_given"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Treatment given</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={2}
                      placeholder="What was administered at the clinic…"
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
              name="allergies"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Allergies</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={2}
                      placeholder="Drug, food, environmental…"
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

function PriorEntriesList({
  entries,
}: {
  entries: { id: string; date: string; text: string }[];
}) {
  return (
    <div className="rounded-md border bg-muted/30 p-2 text-xs">
      <div className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        Prior visits ({entries.length})
      </div>
      <ul className="space-y-1">
        {entries.map((e) => (
          <li key={e.id} className="flex gap-2">
            <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
              {formatManila(e.date, "MMM d")}
            </span>
            <span className="whitespace-pre-wrap break-words">{e.text}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
