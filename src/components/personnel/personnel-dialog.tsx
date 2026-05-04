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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createPersonnel, updatePersonnel } from "@/lib/actions/personnel";
import {
  createPersonnelSchema,
  type CreatePersonnelInput,
} from "@/lib/schemas/personnel";
import { PhotoUploadField } from "./photo-upload-field";
import type { Database } from "@/types/database";

type Personnel = Database["palaro"]["Tables"]["personnel"]["Row"];
type Site = Pick<
  Database["palaro"]["Tables"]["sites"]["Row"],
  "id" | "name" | "site_type"
>;

interface Props {
  /** Provided in edit mode, omitted in create mode (which uses the trigger button). */
  personnel?: Personnel | null;
  sites: Site[];
  /** Controls the dialog when in edit mode. Ignored in create mode. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onOpenChangeComplete?: (open: boolean) => void;
}

const NO_SITE = "__none__";

const emptyValues: CreatePersonnelInput = {
  full_name: "",
  designation: undefined,
  committee: "",
  area_assigned: undefined,
  site_id: null,
  agency: undefined,
  contact_number: undefined,
  photo_url: undefined,
  is_active: true,
};

function personnelToValues(p: Personnel): CreatePersonnelInput {
  return {
    full_name: p.full_name,
    designation: p.designation ?? undefined,
    committee: p.committee,
    area_assigned: p.area_assigned ?? undefined,
    site_id: p.site_id,
    agency: p.agency ?? undefined,
    contact_number: p.contact_number ?? undefined,
    photo_url: p.photo_url ?? undefined,
    is_active: p.is_active,
  };
}

export function PersonnelDialog({
  personnel,
  sites,
  open: controlledOpen,
  onOpenChange,
  onOpenChangeComplete,
}: Props) {
  const isEdit = !!personnel;
  const [internalOpen, setInternalOpen] = useState(false);
  const open = isEdit ? !!controlledOpen : internalOpen;
  const setOpen = (next: boolean) => {
    if (isEdit) onOpenChange?.(next);
    else setInternalOpen(next);
  };

  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  const form = useForm<CreatePersonnelInput>({
    resolver: zodResolver(createPersonnelSchema),
    defaultValues: personnel ? personnelToValues(personnel) : emptyValues,
  });

  useEffect(() => {
    if (open) {
      form.reset(personnel ? personnelToValues(personnel) : emptyValues);
    }
  }, [open, personnel, form]);

  async function onSubmit(values: CreatePersonnelInput) {
    setSubmitting(true);
    const result = isEdit
      ? await updatePersonnel({ id: personnel!.id, ...values })
      : await createPersonnel(values);
    setSubmitting(false);

    if (result.error) {
      toast.error(isEdit ? "Update failed" : "Create failed", {
        description: result.error,
      });
      return;
    }
    toast.success(isEdit ? "Personnel updated" : "Personnel added");
    setOpen(false);
    router.refresh();
  }

  const dialog = (
    <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{isEdit ? "Edit personnel" : "Add personnel"}</DialogTitle>
        <DialogDescription>
          Personnel records power ID generation, QR scan attendance, and DTRs.
          They are not system users and cannot sign in.
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
              name="committee"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Committee</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Medical Committee"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="designation"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Designation</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Lifeguard, Marshal…"
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="site_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Assigned site</FormLabel>
                  <Select
                    value={field.value ?? NO_SITE}
                    onValueChange={(v) =>
                      field.onChange(v === NO_SITE ? null : v)
                    }
                  >
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue>
                          {(v: string | null) => {
                            if (!v || v === NO_SITE) return "None";
                            const s = sites.find((x) => x.id === v);
                            return s ? s.name : "None";
                          }}
                        </SelectValue>
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value={NO_SITE}>None</SelectItem>
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
              name="area_assigned"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Area assigned</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Court 3, Backstage…"
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <FormField
              control={form.control}
              name="agency"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Agency / Office</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="DepEd RXIII, PRC…"
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
              name="contact_number"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Contact number</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="0917…"
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
            name="photo_url"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Photo</FormLabel>
                <FormControl>
                  <PhotoUploadField
                    value={field.value}
                    onChange={field.onChange}
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
              {submitting ? "Saving…" : isEdit ? "Save changes" : "Add personnel"}
            </Button>
          </DialogFooter>
        </form>
      </Form>
    </DialogContent>
  );

  if (isEdit) {
    return (
      <Dialog
        open={open}
        onOpenChange={setOpen}
        onOpenChangeComplete={onOpenChangeComplete}
      >
        {dialog}
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <Plus className="size-4" />
        Add personnel
      </DialogTrigger>
      {dialog}
    </Dialog>
  );
}
