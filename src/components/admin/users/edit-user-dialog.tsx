"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import {
  PROFILE_STATUS_LABELS,
  ROLE_LABELS,
  USER_ROLES,
  type ProfileStatus,
  type UserRole,
} from "@/lib/permissions";
import {
  updateUserDetails,
  updateUserRoles,
  updateUserStatus,
} from "@/lib/actions/profiles";
import {
  userRoleSchema,
  profileStatusSchema,
} from "@/lib/schemas/profiles";
import type { Database } from "@/types/database";

type Profile = Database["palaro"]["Tables"]["profiles"]["Row"];

const NO_DELEGATION = "__none__";

const editFormSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  full_name: z.string().trim().max(200).optional(),
  agency: z.string().trim().max(200).optional(),
  designation: z.string().trim().max(200).optional(),
  roles: z.array(userRoleSchema).min(1, "Pick at least one role"),
  status: profileStatusSchema,
  delegation_id: z.string().uuid().nullable().optional(),
});
type EditFormValues = z.infer<typeof editFormSchema>;

interface DelegationOption {
  id: string;
  region_code: string;
  region_name: string;
}

interface EditUserDialogProps {
  user: Profile | null;
  currentRoles: readonly UserRole[];
  currentProfileId: string;
  delegations: DelegationOption[];
  onClose: () => void;
}

function arraysEqualUnordered<T>(a: readonly T[], b: readonly T[]): boolean {
  if (a.length !== b.length) return false;
  const sa = new Set(a);
  return b.every((v) => sa.has(v));
}

export function EditUserDialog({
  user,
  currentRoles,
  currentProfileId,
  delegations,
  onClose,
}: EditUserDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  const form = useForm<EditFormValues>({
    resolver: zodResolver(editFormSchema),
    defaultValues: {
      email: user?.email ?? "",
      full_name: user?.full_name ?? "",
      agency: user?.agency ?? "",
      designation: user?.designation ?? "",
      roles: (user?.roles ?? []) as UserRole[],
      status: user?.status === "suspended" ? "suspended" : "active",
      delegation_id: user?.delegation_id ?? null,
    },
  });

  useEffect(() => {
    if (!user) return;
    form.reset({
      email: user.email ?? "",
      full_name: user.full_name ?? "",
      agency: user.agency ?? "",
      designation: user.designation ?? "",
      roles: (user.roles ?? []) as UserRole[],
      status: user.status === "suspended" ? "suspended" : "active",
      delegation_id: user.delegation_id ?? null,
    });
  }, [user, form]);

  const watchedRoles = (form.watch("roles") ?? []) as UserRole[];
  const showDelegation =
    watchedRoles.includes("delegation_head") ||
    watchedRoles.includes("bq_head") ||
    !!user?.delegation_id;

  if (!user) return null;

  const isSelf = user.id === currentProfileId;
  const callerIsSuper = currentRoles.includes("super_admin");
  const targetWasSuper = (user.roles ?? []).includes("super_admin");
  const canEditTarget = callerIsSuper || !targetWasSuper;

  const availableRoles: readonly UserRole[] = callerIsSuper
    ? USER_ROLES
    : USER_ROLES.filter((r) => r !== "super_admin");

  async function onSubmit(values: EditFormValues) {
    if (!user) return;

    const trimmedEmail = values.email.trim().toLowerCase();
    const currentEmail = (user.email ?? "").trim().toLowerCase();
    const emailChanged = trimmedEmail !== currentEmail;

    if (emailChanged) {
      const linked = !!user.auth_user_id;
      const message = linked
        ? `Change email from ${user.email} to ${trimmedEmail}?\n\nThis will sign the user out immediately. They must sign in again with the new Google account (${trimmedEmail}) to regain access.`
        : `Change email from ${user.email} to ${trimmedEmail}?\n\nThe user must sign in with Google using ${trimmedEmail} to be linked.`;
      if (!window.confirm(message)) return;
    }

    setSubmitting(true);

    const detailsResult = await updateUserDetails({
      user_id: user.id,
      email: emailChanged ? trimmedEmail : undefined,
      full_name: values.full_name || undefined,
      agency: values.agency || undefined,
      designation: values.designation || undefined,
      delegation_id: values.delegation_id ?? null,
    });
    if (detailsResult.error) {
      setSubmitting(false);
      toast.error("Update failed", { description: detailsResult.error });
      return;
    }

    const currentTargetRoles = (user.roles ?? []) as UserRole[];
    if (!arraysEqualUnordered(values.roles, currentTargetRoles)) {
      const rolesResult = await updateUserRoles({
        user_id: user.id,
        roles: values.roles,
      });
      if (rolesResult.error) {
        setSubmitting(false);
        toast.error("Roles update failed", { description: rolesResult.error });
        return;
      }
    }

    if (values.status !== user.status) {
      const statusResult = await updateUserStatus({
        user_id: user.id,
        status: values.status,
      });
      if (statusResult.error) {
        setSubmitting(false);
        toast.error("Status update failed", { description: statusResult.error });
        return;
      }
    }

    setSubmitting(false);
    toast.success("User updated");
    router.refresh();
    onClose();
  }

  return (
    <Dialog open={!!user} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit user</DialogTitle>
          <DialogDescription>
            Changing the email signs the user out and they must re-link via
            Google.
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
                      autoComplete="off"
                      disabled={!canEditTarget || isSelf}
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  {isSelf ? (
                    <p className="text-xs text-muted-foreground">
                      You can&rsquo;t change your own email. Ask another super
                      admin.
                    </p>
                  ) : null}
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="full_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Full name</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? ""} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="agency"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Agency</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? ""} />
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
                    <Input {...field} value={field.value ?? ""} />
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
                const lockSelfDemote =
                  isSelf && callerIsSuper; // can't toggle off super_admin on self
                const toggle = (role: UserRole, checked: boolean) => {
                  if (lockSelfDemote && role === "super_admin" && !checked) {
                    return;
                  }
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
                        const disabled =
                          !canEditTarget ||
                          (lockSelfDemote && role === "super_admin");
                        return (
                          <label
                            key={role}
                            className="flex cursor-pointer items-center gap-2 text-sm"
                          >
                            <Checkbox
                              checked={checked}
                              disabled={disabled}
                              onCheckedChange={(v) => toggle(role, !!v)}
                            />
                            <span>{ROLE_LABELS[role]}</span>
                          </label>
                        );
                      })}
                    </div>
                    {lockSelfDemote ? (
                      <p className="text-xs text-muted-foreground">
                        You can&rsquo;t demote yourself from super admin.
                      </p>
                    ) : null}
                    <FormMessage />
                  </FormItem>
                );
              }}
            />
            {showDelegation ? (
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
                      disabled={!canEditTarget}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue>
                            {(v: string | null) => {
                              if (!v || v === NO_DELEGATION) {
                                return (
                                  <span className="text-muted-foreground">
                                    — None —
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
                        <SelectItem value={NO_DELEGATION}>— None —</SelectItem>
                        {delegations.map((d) => (
                          <SelectItem key={d.id} value={d.id}>
                            {d.region_code} — {d.region_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Used by Head Counter to scope a BQ Head to one
                      delegation.
                    </p>
                    <FormMessage />
                  </FormItem>
                )}
              />
            ) : null}
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select
                    value={field.value ?? ""}
                    onValueChange={field.onChange}
                    disabled={!canEditTarget || isSelf}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue>
                          {(v: string | null) =>
                            v && v in PROFILE_STATUS_LABELS ? (
                              PROFILE_STATUS_LABELS[v as ProfileStatus]
                            ) : (
                              <span className="text-muted-foreground">
                                Select a status
                              </span>
                            )
                          }
                        </SelectValue>
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="suspended">Suspended</SelectItem>
                    </SelectContent>
                  </Select>
                  {isSelf ? (
                    <p className="text-xs text-muted-foreground">
                      You can&rsquo;t suspend your own account.
                    </p>
                  ) : null}
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "Saving…" : "Save changes"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
