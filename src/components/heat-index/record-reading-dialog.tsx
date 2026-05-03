"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Thermometer } from "lucide-react";
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
import { recordReading } from "@/lib/actions/heat-index";
import {
  recordHeatReadingSchema,
  type RecordHeatReadingInput,
} from "@/lib/schemas/heat-index";
import {
  classifyHeatDanger,
  computeHeatIndexCelsius,
  HEAT_DANGER_BADGE,
  HEAT_DANGER_LABELS,
} from "@/lib/heat-index";
import { cn } from "@/lib/utils";
import type { Database } from "@/types/database";

type Site = Pick<
  Database["palaro"]["Tables"]["sites"]["Row"],
  "id" | "name" | "site_type"
>;

interface Props {
  sites: Site[];
}

export function RecordReadingDialog({ sites }: Props) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  const form = useForm<RecordHeatReadingInput>({
    resolver: zodResolver(recordHeatReadingSchema),
    defaultValues: {
      site_id: "",
      temperature_c: undefined as unknown as number,
      humidity_percent: undefined as unknown as number,
      notes: undefined,
    },
  });

  const watched = useWatch({
    control: form.control,
    name: ["temperature_c", "humidity_percent"],
  });
  const [tempStr, humStr] = watched ?? [];
  const previewIndex =
    typeof tempStr === "number" && typeof humStr === "number"
      ? computeHeatIndexCelsius(tempStr, humStr)
      : null;
  const previewLevel = previewIndex !== null ? classifyHeatDanger(previewIndex) : null;

  async function onSubmit(values: RecordHeatReadingInput) {
    setSubmitting(true);
    const result = await recordReading(values);
    setSubmitting(false);

    if (result.error) {
      toast.error("Failed to record reading", { description: result.error });
      return;
    }
    toast.success(
      `Reading saved · ${HEAT_DANGER_LABELS[
        result.data!.danger_level as keyof typeof HEAT_DANGER_LABELS
      ] ?? result.data!.danger_level}`,
    );
    form.reset();
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <Thermometer className="size-4" />
        Record reading
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Record heat-index reading</DialogTitle>
          <DialogDescription>
            Heat index is computed server-side using the NWS formula. Danger
            and extreme-danger readings notify Command Center automatically.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <FormField
              control={form.control}
              name="site_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Venue / site</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue>
                          {(v: string | null) => {
                            const site = sites.find((s) => s.id === v);
                            return site ? (
                              site.name
                            ) : (
                              <span className="text-muted-foreground">
                                Pick a site
                              </span>
                            );
                          }}
                        </SelectValue>
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
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

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="temperature_c"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Temperature (°C)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        inputMode="decimal"
                        step="0.1"
                        placeholder="32.5"
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
                name="humidity_percent"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Humidity (%)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        inputMode="decimal"
                        step="1"
                        placeholder="75"
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

            {previewIndex !== null && previewLevel !== null ? (
              <div className="rounded-md border bg-muted/40 p-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Computed heat index</span>
                  <span className="font-mono text-base font-semibold">
                    {previewIndex.toFixed(1)} °C
                  </span>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-muted-foreground">Danger band</span>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs font-medium",
                      HEAT_DANGER_BADGE[previewLevel],
                    )}
                  >
                    {HEAT_DANGER_LABELS[previewLevel]}
                  </span>
                </div>
                {(previewLevel === "danger" ||
                  previewLevel === "extreme_danger") && (
                  <p className="mt-2 text-xs text-red-700">
                    Game suspension will be flagged on submit.
                  </p>
                )}
              </div>
            ) : null}

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes (optional)</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={2}
                      placeholder="e.g. Reading taken at courtside, partial cloud cover"
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
                Save reading
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
