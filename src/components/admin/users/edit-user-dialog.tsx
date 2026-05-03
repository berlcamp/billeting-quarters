"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
  updateUserRole,
  updateUserStatus,
} from "@/lib/actions/profiles";
import {
  userRoleSchema,
  profileStatusSchema,
} from "@/lib/schemas/profiles";
import type { Database } from "@/types/database";

type Profile = Database["palaro"]["Tables"]["profiles"]["Row"];

const editFormSchema = z.object({
  full_name: z.string().trim().max(200).optional(),
  agency: z.string().trim().max(200).optional(),
  designation: z.string().trim().max(200).optional(),
  role: userRoleSchema,
  status: profileStatusSchema,
});
type EditFormValues = z.infer<typeof editFormSchema>;

interface EditUserDialogProps {
  user: Profile | null;
  currentRole: UserRole | null;
  currentProfileId: string;
  onClose: () => void;
}

export function EditUserDialog({
  user,
  currentRole,
  currentProfileId,
  onClose,
}: EditUserDialogProps) {
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  const form = useForm<EditFormValues>({
    resolver: zodResolver(editFormSchema),
    defaultValues: {
      full_name: user?.full_name ?? "",
      agency: user?.agency ?? "",
      designation: user?.designation ?? "",
      role: (user?.role ?? "command_center") as UserRole,
      status: user?.status === "suspended" ? "suspended" : "active",
    },
  });

  useEffect(() => {
    if (!user) return;
    form.reset({
      full_name: user.full_name ?? "",
      agency: user.agency ?? "",
      designation: user.designation ?? "",
      role: (user.role ?? "command_center") as UserRole,
      status: user.status === "suspended" ? "suspended" : "active",
    });
  }, [user, form]);

  if (!user) return null;

  const isSelf = user.id === currentProfileId;
  const targetIsSuperAdmin = user.role === "super_admin";
  const canChangeSuperAdminBits =
    currentRole === "super_admin" || !targetIsSuperAdmin;

  async function onSubmit(values: EditFormValues) {
    if (!user) return;
    setSubmitting(true);

    const detailsResult = await updateUserDetails({
      user_id: user.id,
      full_name: values.full_name || undefined,
      agency: values.agency || undefined,
      designation: values.designation || undefined,
    });
    if (detailsResult.error) {
      setSubmitting(false);
      toast.error("Update failed", { description: detailsResult.error });
      return;
    }

    if (values.role !== user.role) {
      const roleResult = await updateUserRole({
        user_id: user.id,
        role: values.role,
      });
      if (roleResult.error) {
        setSubmitting(false);
        toast.error("Role update failed", { description: roleResult.error });
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

  const availableRoles: readonly UserRole[] =
    currentRole === "super_admin"
      ? USER_ROLES
      : USER_ROLES.filter((r) => r !== "super_admin");

  return (
    <Dialog open={!!user} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit user</DialogTitle>
          <DialogDescription className="font-mono text-xs">
            {user.email}
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
              name="role"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Role</FormLabel>
                  <Select
                    value={field.value ?? ""}
                    onValueChange={field.onChange}
                    disabled={!canChangeSuperAdminBits || (isSelf && currentRole === "super_admin")}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue>
                          {(v: string | null) =>
                            v && v in ROLE_LABELS ? (
                              ROLE_LABELS[v as UserRole]
                            ) : (
                              <span className="text-muted-foreground">
                                Select a role
                              </span>
                            )
                          }
                        </SelectValue>
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {availableRoles.map((role) => (
                        <SelectItem key={role} value={role}>
                          {ROLE_LABELS[role]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {isSelf && currentRole === "super_admin" ? (
                    <p className="text-xs text-muted-foreground">
                      You can&rsquo;t demote yourself from super admin.
                    </p>
                  ) : null}
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status</FormLabel>
                  <Select
                    value={field.value ?? ""}
                    onValueChange={field.onChange}
                    disabled={!canChangeSuperAdminBits || isSelf}
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
