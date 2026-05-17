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
import { createDepartment, updateDepartment } from "@/lib/actions/raffle";
import {
  createDepartmentSchema,
  updateDepartmentSchema,
  type CreateDepartmentInput,
  type UpdateDepartmentInput,
} from "@/lib/schemas/raffle";
import type { Database } from "@/types/database";

type Department = Database["palaro"]["Tables"]["raffle_departments"]["Row"];

interface Props {
  raffleId: string;
  department?: Department;
  trigger?: ReactNode;
}

export function DepartmentFormDialog({ raffleId, department, trigger }: Props) {
  const isEdit = !!department;
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  const form = useForm<CreateDepartmentInput | UpdateDepartmentInput>({
    resolver: zodResolver(
      isEdit ? updateDepartmentSchema : createDepartmentSchema,
    ),
    defaultValues: isEdit
      ? { id: department.id, name: department.name }
      : { raffle_id: raffleId, name: "" },
  });

  useEffect(() => {
    if (open) {
      form.reset(
        isEdit
          ? { id: department!.id, name: department!.name }
          : { raffle_id: raffleId, name: "" },
      );
    }
  }, [open, isEdit, department, raffleId, form]);

  async function onSubmit(values: CreateDepartmentInput | UpdateDepartmentInput) {
    setSubmitting(true);
    const result = isEdit
      ? await updateDepartment(values)
      : await createDepartment(values);
    setSubmitting(false);

    if (result.error) {
      toast.error(isEdit ? "Update failed" : "Create failed", {
        description: result.error,
      });
      return;
    }
    toast.success(isEdit ? "Department updated" : "Department added");
    setOpen(false);
    router.refresh();
  }

  const defaultTrigger = isEdit ? (
    <Button variant="ghost" size="sm">
      <Pencil className="size-3.5" />
      Rename
    </Button>
  ) : (
    <Button variant="outline">
      <Plus className="size-4" />
      Add department
    </Button>
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={(trigger ?? defaultTrigger) as React.ReactElement} />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Rename department" : "Add department"}
          </DialogTitle>
          <DialogDescription>
            Departments group raffle entries (e.g. DepEd, LGU, Medical).
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
                    <Input placeholder="e.g. DepEd" {...field} autoFocus />
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
                {isEdit ? "Save" : "Add"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
