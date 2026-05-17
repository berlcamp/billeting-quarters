"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus, Pencil } from "lucide-react";
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
import { createRaffle, updateRaffle } from "@/lib/actions/raffle";
import {
  createRaffleSchema,
  type CreateRaffleInput,
} from "@/lib/schemas/raffle";
import type { Database } from "@/types/database";

type Raffle = Database["palaro"]["Tables"]["raffles"]["Row"];

interface Props {
  raffle?: Raffle;
  trigger?: ReactNode;
}

export function RaffleFormDialog({ raffle, trigger }: Props) {
  const isEdit = !!raffle;
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  const form = useForm<CreateRaffleInput>({
    resolver: zodResolver(createRaffleSchema),
    defaultValues: {
      name: raffle?.name ?? "",
      description: raffle?.description ?? undefined,
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        name: raffle?.name ?? "",
        description: raffle?.description ?? undefined,
      });
    }
  }, [open, raffle, form]);

  async function onSubmit(values: CreateRaffleInput) {
    setSubmitting(true);
    const result = isEdit
      ? await updateRaffle({ ...values, id: raffle!.id })
      : await createRaffle(values);
    setSubmitting(false);

    if (result.error) {
      toast.error(isEdit ? "Update failed" : "Create failed", {
        description: result.error,
      });
      return;
    }
    toast.success(isEdit ? "Raffle updated" : "Raffle created");
    setOpen(false);
    router.refresh();
  }

  const defaultTrigger = isEdit ? (
    <Button variant="outline" size="sm">
      <Pencil className="size-3.5" />
      Edit
    </Button>
  ) : (
    <Button>
      <Plus className="size-4" />
      New raffle
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={(trigger ?? defaultTrigger) as React.ReactElement} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit raffle" : "New raffle"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update raffle name and description."
              : "Give your raffle a name. You'll add departments and entries on the next page."}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="e.g. Welcome Night 2026"
                      {...field}
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
                      placeholder="Optional context shown on the admin list."
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
                {isEdit ? "Save" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
