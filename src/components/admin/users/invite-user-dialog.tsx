"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import { inviteUser } from "@/lib/actions/profiles";
import { inviteUserSchema, type InviteUserInput } from "@/lib/schemas/profiles";
import { ROLE_LABELS, USER_ROLES, type UserRole } from "@/lib/permissions";

interface InviteUserDialogProps {
  /** The current user's roles — used to gate the super_admin option. */
  currentRoles: readonly UserRole[];
}

export function InviteUserDialog({ currentRoles }: InviteUserDialogProps) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  const form = useForm<InviteUserInput>({
    resolver: zodResolver(inviteUserSchema),
    defaultValues: {
      email: "",
      full_name: "",
      roles: [],
      agency: "",
    },
  });

  async function onSubmit(values: InviteUserInput) {
    setSubmitting(true);
    const result = await inviteUser(values);
    setSubmitting(false);

    if (result.error) {
      toast.error("Invite failed", { description: result.error });
      return;
    }

    toast.success("Invitation created", {
      description: `${values.email} can now sign in with Google.`,
    });
    form.reset();
    setOpen(false);
    router.refresh();
  }

  // Hide super_admin from the role list unless current user is super_admin.
  const callerIsSuper = currentRoles.includes("super_admin");
  const availableRoles: readonly UserRole[] = callerIsSuper
    ? USER_ROLES
    : USER_ROLES.filter((r) => r !== "super_admin");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger render={<Button />}>
        <Plus className="size-4" />
        Invite user
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite user</DialogTitle>
          <DialogDescription>
            Pre-create a profile so this email can sign in with Google. Access is
            granted instantly when they complete OAuth.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="user@example.com"
                      autoComplete="off"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="full_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full name (optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="Juan Dela Cruz" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="roles"
              render={({ field }) => {
                const selected = (field.value ?? []) as UserRole[];
                const toggle = (role: UserRole, checked: boolean) => {
                  const next = checked
                    ? Array.from(new Set([...selected, role]))
                    : selected.filter((r) => r !== role);
                  field.onChange(next);
                };
                return (
                  <FormItem>
                    <FormLabel>Roles</FormLabel>
                    <div className="grid grid-cols-1 gap-2 rounded-md border p-3 sm:grid-cols-2">
                      {availableRoles.map((role) => {
                        const checked = selected.includes(role);
                        return (
                          <label
                            key={role}
                            className="flex cursor-pointer items-center gap-2 text-sm"
                          >
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(v) => toggle(role, !!v)}
                            />
                            <span>{ROLE_LABELS[role]}</span>
                          </label>
                        );
                      })}
                    </div>
                    <FormMessage />
                  </FormItem>
                );
              }}
            />
            <FormField
              control={form.control}
              name="agency"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Agency (optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="DepEd, BFP, PNP, …" {...field} />
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
                {submitting ? "Sending…" : "Send invite"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
