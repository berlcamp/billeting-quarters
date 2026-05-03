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
import { createPatient, updatePatient } from "@/lib/actions/clinic";
import {
  createPatientSchema,
  PATIENT_GENDERS,
  type CreatePatientInput,
  type PatientGender,
} from "@/lib/schemas/clinic";
import {
  PATIENT_GENDER_LABELS,
} from "@/lib/labels";
import type { Database } from "@/types/database";

type Patient = Database["palaro"]["Tables"]["clinic_patients"]["Row"];
type Delegation = Pick<
  Database["palaro"]["Tables"]["delegations"]["Row"],
  "id" | "region_code" | "region_name"
>;

const NO_DELEGATION = "__none__";
const NO_GENDER = "__none__";

interface Props {
  trigger: ReactNode;
  delegations: Delegation[];
  patient?: Patient;
}

export function PatientFormDialog({ trigger, delegations, patient }: Props) {
  const isEdit = !!patient;
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  const form = useForm<CreatePatientInput>({
    resolver: zodResolver(createPatientSchema),
    defaultValues: {
      full_name: patient?.full_name ?? "",
      age: patient?.age ?? undefined,
      gender: (patient?.gender as PatientGender | undefined) ?? undefined,
      delegation_id: patient?.delegation_id ?? null,
      phone: patient?.phone ?? undefined,
      emergency_contact: patient?.emergency_contact ?? undefined,
      allergies: patient?.allergies ?? undefined,
      medical_history: patient?.medical_history ?? undefined,
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        full_name: patient?.full_name ?? "",
        age: patient?.age ?? undefined,
        gender: (patient?.gender as PatientGender | undefined) ?? undefined,
        delegation_id: patient?.delegation_id ?? null,
        phone: patient?.phone ?? undefined,
        emergency_contact: patient?.emergency_contact ?? undefined,
        allergies: patient?.allergies ?? undefined,
        medical_history: patient?.medical_history ?? undefined,
      });
    }
  }, [open, patient, form]);

  async function onSubmit(values: CreatePatientInput) {
    setSubmitting(true);
    const result = isEdit
      ? await updatePatient({ ...values, id: patient!.id })
      : await createPatient(values);
    setSubmitting(false);

    if (result.error) {
      toast.error(isEdit ? "Update failed" : "Add failed", {
        description: result.error,
      });
      return;
    }
    toast.success(
      isEdit
        ? "Patient updated"
        : `Patient added — ${result.data!.patient_number}`,
    );
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger as React.ReactElement} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit patient" : "Add patient"}</DialogTitle>
          <DialogDescription>
            Patient records are reusable across multiple visits. PT-number is
            auto-assigned on save.
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
                    <Input placeholder="Juan Dela Cruz" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="age"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Age</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={150}
                        placeholder="—"
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
                name="gender"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Gender</FormLabel>
                    <Select
                      value={field.value ?? NO_GENDER}
                      onValueChange={(v) =>
                        field.onChange(v === NO_GENDER ? undefined : v)
                      }
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue>
                            {(v: string | null) => {
                              if (!v || v === NO_GENDER)
                                return (
                                  <span className="text-muted-foreground">
                                    —
                                  </span>
                                );
                              return (
                                PATIENT_GENDER_LABELS[v as PatientGender] ?? v
                              );
                            }}
                          </SelectValue>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value={NO_GENDER}>—</SelectItem>
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
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
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
                name="emergency_contact"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Emergency contact</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Name + number"
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
                {isEdit ? "Save" : "Add patient"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
