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
import { createVisit, updateVisit } from "@/lib/actions/site-monitoring";
import {
  createVisitSchema,
  type CreateVisitInput,
} from "@/lib/schemas/site-monitoring";
import type { Database } from "@/types/database";

type Site = Pick<Database["palaro"]["Tables"]["sites"]["Row"], "id" | "name">;
type Visit = Database["palaro"]["Tables"]["site_monitoring_visits"]["Row"];

function isoToLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

function nowLocal(): string {
  return isoToLocal(new Date().toISOString());
}

// "Juan Dela Cruz, Maria Santos" or one-per-line → ["Juan Dela Cruz", "Maria Santos"]
function parseIndividuals(raw: string): string[] {
  return raw
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function formatIndividuals(list: unknown): string {
  if (!Array.isArray(list)) return "";
  return list.filter((s): s is string => typeof s === "string").join(", ");
}

interface Props {
  trigger: ReactNode;
  sites: Site[];
  visit?: Visit;
}

export function VisitFormDialog({ trigger, sites, visit }: Props) {
  const isEdit = !!visit;
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [individualsRaw, setIndividualsRaw] = useState(
    visit ? formatIndividuals(visit.individuals) : "",
  );
  const router = useRouter();

  const form = useForm<CreateVisitInput>({
    resolver: zodResolver(createVisitSchema),
    defaultValues: {
      site_id: visit?.site_id ?? "",
      visit_title: visit?.visit_title ?? "",
      individuals: visit ? formatIndividuals(visit.individuals).split(",").map((s) => s.trim()).filter(Boolean) : [],
      visited_at: visit ? isoToLocal(visit.visited_at) : nowLocal(),
      observations: visit?.observations ?? undefined,
      notes_to_admin: visit?.notes_to_admin ?? undefined,
    },
  });

  useEffect(() => {
    if (open) {
      setIndividualsRaw(visit ? formatIndividuals(visit.individuals) : "");
      form.reset({
        site_id: visit?.site_id ?? "",
        visit_title: visit?.visit_title ?? "",
        individuals: visit
          ? formatIndividuals(visit.individuals)
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
          : [],
        visited_at: visit ? isoToLocal(visit.visited_at) : nowLocal(),
        observations: visit?.observations ?? undefined,
        notes_to_admin: visit?.notes_to_admin ?? undefined,
      });
    }
  }, [open, visit, form]);

  async function onSubmit(values: CreateVisitInput) {
    setSubmitting(true);
    const payload = {
      ...values,
      individuals: parseIndividuals(individualsRaw),
      visited_at: new Date(values.visited_at).toISOString(),
    };
    const result = isEdit
      ? await updateVisit({ ...payload, id: visit!.id })
      : await createVisit(payload);
    setSubmitting(false);

    if (result.error) {
      toast.error(isEdit ? "Update failed" : "Save failed", {
        description: result.error,
      });
      return;
    }
    toast.success(isEdit ? "Visit updated" : "Visit logged");
    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={trigger as React.ReactElement} />
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit site visit" : "Log site visit"}
          </DialogTitle>
          <DialogDescription>
            Log non-incident visits, monitoring trips, or roving check-ups.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="site_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Site</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue>
                          {(v: string | null) => {
                            const s = sites.find((x) => x.id === v);
                            return s ? (
                              s.name
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
            <FormField
              control={form.control}
              name="visit_title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Visit title</FormLabel>
                  <FormControl>
                    <Input
                      placeholder='e.g. "DOH Province monitoring on garbage disposal"'
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="visited_at"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Date & time (PHT)</FormLabel>
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
            <FormItem>
              <FormLabel>Individuals who came</FormLabel>
              <FormControl>
                <Textarea
                  rows={2}
                  placeholder="Comma-separated, e.g. Dr. Cruz, Engr. Reyes"
                  value={individualsRaw}
                  onChange={(e) => setIndividualsRaw(e.target.value)}
                />
              </FormControl>
            </FormItem>
            <FormField
              control={form.control}
              name="observations"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observations / recommendations</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={3}
                      placeholder="What was observed; recommendations given."
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
              name="notes_to_admin"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Notes to Command Center</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={2}
                      placeholder="Anything Command Center should know."
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
                {isEdit ? "Save" : "Log visit"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
