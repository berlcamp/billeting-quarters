"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import { submitUcfAssessment } from "@/lib/actions/referrals";
import {
  submitUcfAssessmentSchema,
  type SubmitUcfAssessmentInput,
} from "@/lib/schemas/referrals";

interface UcfAssessmentFormProps {
  referralId: string;
  initialDiagnosis?: string | null;
  treatmentPlan?: string | null;
  assessmentNotes?: string | null;
}

export function UcfAssessmentForm({
  referralId,
  initialDiagnosis,
  treatmentPlan,
  assessmentNotes,
}: UcfAssessmentFormProps) {
  const [submitting, setSubmitting] = useState(false);
  const [showVitals, setShowVitals] = useState(false);
  const router = useRouter();

  const form = useForm<SubmitUcfAssessmentInput>({
    resolver: zodResolver(submitUcfAssessmentSchema),
    defaultValues: {
      id: referralId,
      initial_diagnosis: initialDiagnosis ?? undefined,
      treatment_plan: treatmentPlan ?? undefined,
      assessment_notes: assessmentNotes ?? undefined,
      vitals_on_arrival: undefined,
    },
  });

  async function onSubmit(values: SubmitUcfAssessmentInput) {
    setSubmitting(true);
    const result = await submitUcfAssessment(values);
    setSubmitting(false);
    if (result.error) {
      toast.error("Assessment failed", { description: result.error });
      return;
    }
    toast.success("Assessment saved");
    router.refresh();
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        <FormField
          control={form.control}
          name="initial_diagnosis"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Initial diagnosis</FormLabel>
              <FormControl>
                <Input
                  placeholder="e.g. Heat exhaustion"
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
          name="treatment_plan"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Treatment plan</FormLabel>
              <FormControl>
                <Textarea
                  rows={3}
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
          name="assessment_notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes</FormLabel>
              <FormControl>
                <Textarea
                  rows={2}
                  placeholder="Additional observations…"
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
            Vitals on arrival (optional)
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
                name="vitals_on_arrival.bp"
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
                name="vitals_on_arrival.hr"
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
                name="vitals_on_arrival.temp"
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
                name="vitals_on_arrival.rr"
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
                name="vitals_on_arrival.spo2"
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

        <div className="flex justify-end">
          <Button type="submit" disabled={submitting}>
            {submitting ? "Saving…" : "Save assessment"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
