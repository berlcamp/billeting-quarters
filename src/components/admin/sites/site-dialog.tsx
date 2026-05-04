"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
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
import { createSite, updateSite } from "@/lib/actions/sites";
import { createSiteSchema, type CreateSiteInput } from "@/lib/schemas/sites";
import { SITE_TYPES, SITE_TYPE_LABELS, type SiteType } from "@/lib/labels";
import type { Database } from "@/types/database";

type Site = Database["palaro"]["Tables"]["sites"]["Row"];

interface SiteDialogProps {
  /** Provided in edit mode, omitted in create mode (which uses the trigger button). */
  site?: Site | null;
  /** Controls the dialog when in edit mode. Ignored when no `site` prop is set. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onOpenChangeComplete?: (open: boolean) => void;
}

const emptyValues: CreateSiteInput = {
  name: "",
  site_type: "billeting_quarter",
  address: undefined,
  contact_person: undefined,
  contact_number: undefined,
  capacity: undefined,
  latitude: undefined,
  longitude: undefined,
  notes: undefined,
};

function siteToValues(site: Site): CreateSiteInput {
  return {
    name: site.name,
    site_type: site.site_type,
    address: site.address ?? undefined,
    contact_person: site.contact_person ?? undefined,
    contact_number: site.contact_number ?? undefined,
    capacity: site.capacity ?? undefined,
    latitude: site.latitude ?? undefined,
    longitude: site.longitude ?? undefined,
    notes: site.notes ?? undefined,
  };
}

export function SiteDialog({ site, open: controlledOpen, onOpenChange, onOpenChangeComplete }: SiteDialogProps) {
  const isEdit = !!site;
  const [internalOpen, setInternalOpen] = useState(false);
  const open = isEdit ? !!controlledOpen : internalOpen;
  const setOpen = (next: boolean) => {
    if (isEdit) onOpenChange?.(next);
    else setInternalOpen(next);
  };

  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  const form = useForm<CreateSiteInput>({
    resolver: zodResolver(createSiteSchema),
    defaultValues: site ? siteToValues(site) : emptyValues,
  });

  useEffect(() => {
    if (open) {
      form.reset(site ? siteToValues(site) : emptyValues);
    }
  }, [open, site, form]);

  async function onSubmit(values: CreateSiteInput) {
    setSubmitting(true);
    const result = isEdit
      ? await updateSite({ id: site!.id, ...values })
      : await createSite(values);
    setSubmitting(false);

    if (result.error) {
      toast.error(isEdit ? "Update failed" : "Create failed", {
        description: result.error,
      });
      return;
    }
    toast.success(isEdit ? "Site updated" : "Site added");
    setOpen(false);
    router.refresh();
  }

  const dialog = (
    <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{isEdit ? "Edit site" : "Add site"}</DialogTitle>
        <DialogDescription>
          {isEdit
            ? "Update this site's details."
            : "Add a Billeting Quarter, Playing Venue, UCF, hospital, clinic, or command center."}
        </DialogDescription>
      </DialogHeader>
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Name</FormLabel>
                <FormControl>
                  <Input placeholder="Tagum City Sports Complex" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="site_type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Type</FormLabel>
                <Select value={field.value ?? ""} onValueChange={field.onChange}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue>
                        {(v: string | null) =>
                          v && v in SITE_TYPE_LABELS ? (
                            SITE_TYPE_LABELS[v as SiteType]
                          ) : (
                            <span className="text-muted-foreground">Select a type</span>
                          )
                        }
                      </SelectValue>
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {SITE_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {SITE_TYPE_LABELS[t]}
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
            name="address"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Address</FormLabel>
                <FormControl>
                  <Input
                    placeholder="Street, Barangay, City, Province"
                    {...field}
                    value={field.value ?? ""}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="grid grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="contact_person"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contact person</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="contact_number"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contact number</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <FormField
              control={form.control}
              name="capacity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Capacity</FormLabel>
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
              name="latitude"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Latitude</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      step="0.0000001"
                      placeholder="7.4470"
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
                      placeholder="125.8094"
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
          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Notes</FormLabel>
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
              {submitting ? "Saving…" : isEdit ? "Save changes" : "Add site"}
            </Button>
          </DialogFooter>
        </form>
      </Form>
    </DialogContent>
  );

  if (isEdit) {
    return (
      <Dialog open={open} onOpenChange={setOpen} onOpenChangeComplete={onOpenChangeComplete}>
        {dialog}
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <Plus className="size-4" />
        Add site
      </DialogTrigger>
      {dialog}
    </Dialog>
  );
}
