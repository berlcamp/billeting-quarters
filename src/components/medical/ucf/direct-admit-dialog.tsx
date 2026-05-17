"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronDown, ChevronUp, UserPlus } from "lucide-react";
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
import { createUcfAdmit } from "@/lib/actions/referrals";
import {
  createUcfAdmitSchema,
  type CreateUcfAdmitInput,
} from "@/lib/schemas/referrals";
import {
  PATIENT_GENDERS,
  PATIENT_GENDER_LABELS,
  type PatientGender,
} from "@/lib/labels";
import { formatManila } from "@/lib/timezone";
import type { Database } from "@/types/database";

type Site = Pick<Database["palaro"]["Tables"]["sites"]["Row"], "id" | "name">;
type Delegation = Pick<
  Database["palaro"]["Tables"]["delegations"]["Row"],
  "id" | "region_code" | "region_name"
>;
type PriorReferral = Pick<
  Database["palaro"]["Tables"]["referrals"]["Row"],
  "id" | "patient_name" | "referred_at" | "history" | "physical_examination"
>;

const NO_DELEGATION = "__none__";

interface UcfDirectAdmitDialogProps {
  ucfSites: Site[];
  delegations: Delegation[];
  /** If UCF staff have a primary assignment, default to it. */
  defaultUcfId?: string;
  /**
   * Past referrals visible to the caller. Filtered client-side by typed
   * patient_name to show a running History / Physical Examination list.
   */
  priorReferrals?: PriorReferral[];
}

const emptyValues: CreateUcfAdmitInput = {
  to_site_id: "",
  patient_name: "",
  patient_age: undefined,
  patient_gender: undefined,
  delegation_id: null,
  chief_complaint: undefined,
  history: undefined,
  physical_examination: undefined,
  initial_diagnosis: undefined,
  treatment_given: undefined,
  allergies: undefined,
  notes: undefined,
  vital_signs: undefined,
};

function normalizeName(s: string | null | undefined): string {
  return (s ?? "").trim().toLowerCase();
}

export function UcfDirectAdmitDialog({
  ucfSites,
  delegations,
  defaultUcfId,
  priorReferrals = [],
}: UcfDirectAdmitDialogProps) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showVitals, setShowVitals] = useState(false);
  const router = useRouter();

  const form = useForm<CreateUcfAdmitInput>({
    resolver: zodResolver(createUcfAdmitSchema),
    defaultValues: {
      ...emptyValues,
      to_site_id: defaultUcfId ?? "",
    },
  });

  const typedName = form.watch("patient_name");

  const priorForPatient = useMemo(() => {
    const key = normalizeName(typedName);
    if (!key) return [] as PriorReferral[];
    return priorReferrals
      .filter((r) => normalizeName(r.patient_name) === key)
      .sort(
        (a, b) =>
          new Date(b.referred_at).getTime() - new Date(a.referred_at).getTime(),
      );
  }, [priorReferrals, typedName]);

  const priorHistory = useMemo(
    () =>
      priorForPatient
        .filter((r) => r.history && r.history.trim().length > 0)
        .map((r) => ({
          id: r.id,
          date: r.referred_at,
          text: r.history as string,
        })),
    [priorForPatient],
  );
  const priorPE = useMemo(
    () =>
      priorForPatient
        .filter(
          (r) =>
            r.physical_examination && r.physical_examination.trim().length > 0,
        )
        .map((r) => ({
          id: r.id,
          date: r.referred_at,
          text: r.physical_examination as string,
        })),
    [priorForPatient],
  );

  async function onSubmit(values: CreateUcfAdmitInput) {
    setSubmitting(true);
    const result = await createUcfAdmit(values);
    setSubmitting(false);
    if (result.error) {
      toast.error("Direct admit failed", { description: result.error });
      return;
    }
    toast.success(`Direct admit logged: ${result.data!.referral_number}`);
    form.reset({ ...emptyValues, to_site_id: defaultUcfId ?? "" });
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <UserPlus className="size-4" />
        Direct admit
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Direct UCF admission</DialogTitle>
          <DialogDescription>
            Log a Palaro-related case that arrived at the UCF without coming
            through the field referral chain.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <FormField
              control={form.control}
              name="to_site_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>UCF site</FormLabel>
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
                  <FormLabel>Chief complaint (current visit)</FormLabel>
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
              name="initial_diagnosis"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Diagnosis</FormLabel>
                  <FormControl>
                    <Input
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
                  <FormLabel>Treatment given</FormLabel>
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
                    name="vital_signs.spo2"
                    render={({ field }) => (
                      <FormItem>
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
                {submitting ? "Logging…" : "Log admission"}
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
