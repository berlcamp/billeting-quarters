"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { LocateFixed, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { PhotoUploader, type UploadedPhoto } from "./photo-uploader";
import { SeverityPicker } from "./severity-picker";
import { createIncident } from "@/lib/actions/incidents";
import {
  createIncidentSchema,
  type CreateIncidentInput,
} from "@/lib/schemas/incidents";
import {
  AFFECTED_PERSON_ROLES,
  INCIDENT_CATEGORIES,
  INCIDENT_CATEGORY_LABELS,
  type IncidentCategory,
} from "@/lib/labels";
import type { Database } from "@/types/database";

type Site = Pick<Database["palaro"]["Tables"]["sites"]["Row"], "id" | "name" | "site_type">;
type Delegation = Pick<
  Database["palaro"]["Tables"]["delegations"]["Row"],
  "id" | "region_code" | "region_name"
>;

const NO_DELEGATION = "__none__";
const NO_SITE = "__none__";

interface IncidentFormProps {
  sites: Site[];
  delegations: Delegation[];
}

const emptyValues: CreateIncidentInput = {
  category: "medical",
  severity: "low",
  title: "",
  description: undefined,
  site_id: null,
  location_details: undefined,
  latitude: undefined,
  longitude: undefined,
  delegation_id: null,
  affected_person_name: undefined,
  affected_person_age: undefined,
  affected_person_role: undefined,
  photo_paths: [],
};

export function IncidentForm({ sites, delegations }: IncidentFormProps) {
  const [submitting, setSubmitting] = useState(false);
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  const [geoBusy, setGeoBusy] = useState(false);
  const router = useRouter();

  const form = useForm<CreateIncidentInput>({
    resolver: zodResolver(createIncidentSchema),
    defaultValues: emptyValues,
  });

  function captureLocation() {
    if (!navigator.geolocation) {
      toast.error("Geolocation isn't available on this device.");
      return;
    }
    setGeoBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        form.setValue("latitude", Number(pos.coords.latitude.toFixed(7)));
        form.setValue("longitude", Number(pos.coords.longitude.toFixed(7)));
        setGeoBusy(false);
        toast.success("Location captured");
      },
      (err) => {
        setGeoBusy(false);
        toast.error("Location unavailable", { description: err.message });
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }

  async function onSubmit(values: CreateIncidentInput) {
    setSubmitting(true);
    const result = await createIncident({
      ...values,
      photo_paths: photos.map((p) => p.path),
    });
    setSubmitting(false);

    if (result.error) {
      toast.error("Submit failed", { description: result.error });
      return;
    }
    toast.success(`Incident reported: ${result.data!.incident_number}`);
    // Clean up object URLs before redirect
    photos.forEach((p) => URL.revokeObjectURL(p.previewUrl));
    router.push(`/dashboard/incidents/${result.data!.id}`);
    router.refresh();
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">What happened?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <FormField
              control={form.control}
              name="category"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category</FormLabel>
                  <Select
                    value={field.value ?? ""}
                    onValueChange={field.onChange}
                  >
                    <FormControl>
                      <SelectTrigger className="w-full h-12">
                        <SelectValue>
                          {(v: string | null) =>
                            v && v in INCIDENT_CATEGORY_LABELS ? (
                              INCIDENT_CATEGORY_LABELS[v as IncidentCategory]
                            ) : (
                              <span className="text-muted-foreground">Pick a category</span>
                            )
                          }
                        </SelectValue>
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {INCIDENT_CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {INCIDENT_CATEGORY_LABELS[c]}
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
              name="severity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Severity</FormLabel>
                  <FormControl>
                    <SeverityPicker
                      value={field.value}
                      onChange={field.onChange}
                      disabled={submitting}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="Brief summary (e.g. Athlete collapse at Court A)"
                      className="h-12 text-base"
                      autoFocus
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      rows={3}
                      placeholder="What's happening? Be specific."
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Where?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <FormField
              control={form.control}
              name="site_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Site</FormLabel>
                  <Select
                    value={field.value ?? NO_SITE}
                    onValueChange={(v) =>
                      field.onChange(v === NO_SITE ? null : v)
                    }
                  >
                    <FormControl>
                      <SelectTrigger className="w-full h-12">
                        <SelectValue>
                          {(v: string | null) => {
                            if (!v || v === NO_SITE) {
                              return (
                                <span className="text-muted-foreground">
                                  Pick a site
                                </span>
                              );
                            }
                            const site = sites.find((s) => s.id === v);
                            return site ? site.name : v;
                          }}
                        </SelectValue>
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={NO_SITE}>—</SelectItem>
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
              name="location_details"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Location details</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g. Court A, Bleacher Section 3"
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
              <FormField
                control={form.control}
                name="latitude"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Latitude</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.0000001"
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
                name="longitude"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Longitude</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.0000001"
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
              <Button
                type="button"
                variant="outline"
                onClick={captureLocation}
                disabled={geoBusy}
                className="self-end h-10"
              >
                {geoBusy ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <LocateFixed className="size-4" />
                )}
                Use current
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Who is involved?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
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
                      <SelectTrigger className="w-full h-12">
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
            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="affected_person_name"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Affected person</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Full name"
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
                name="affected_person_age"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Age</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
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
                name="affected_person_role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
                    <Select
                      value={field.value ?? ""}
                      onValueChange={field.onChange}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue>
                            {(v: string | null) =>
                              v ? (
                                v
                              ) : (
                                <span className="text-muted-foreground">
                                  Pick a role
                                </span>
                              )
                            }
                          </SelectValue>
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {AFFECTED_PERSON_ROLES.map((r) => (
                          <SelectItem key={r} value={r}>
                            {r}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Photos (optional)</CardTitle>
          </CardHeader>
          <CardContent>
            <PhotoUploader
              value={photos}
              onChange={setPhotos}
              disabled={submitting}
            />
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2 sticky bottom-0 bg-background py-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={submitting} className="h-12 px-6 text-base">
            {submitting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Submitting…
              </>
            ) : (
              "Report incident"
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}
