"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Pause, Play } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { EditUserDialog } from "./edit-user-dialog";
import { updateUserStatus } from "@/lib/actions/profiles";
import {
  PROFILE_STATUS_LABELS,
  ROLE_LABELS,
  USER_ROLES,
  type ProfileStatus,
  type UserRole,
} from "@/lib/permissions";
import type { Database } from "@/types/database";

type Profile = Database["palaro"]["Tables"]["profiles"]["Row"];

interface UsersTableProps {
  users: Profile[];
  currentProfileId: string;
  currentRole: UserRole | null;
}

function initialsOf(profile: Profile): string {
  const source = profile.full_name?.trim() || profile.email;
  const parts = source.split(/\s+/);
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function UsersTable({
  users,
  currentProfileId,
  currentRole,
}: UsersTableProps) {
  const [editing, setEditing] = useState<Profile | null>(null);
  const [roleFilter, setRoleFilter] = useState<UserRole | "all">("all");
  const [statusFilter, setStatusFilter] = useState<ProfileStatus | "all">(
    "all",
  );
  const [pendingStatusFor, setPendingStatusFor] = useState<string | null>(null);
  const router = useRouter();

  const filtered = useMemo(() => {
    return users.filter((u) => {
      if (roleFilter !== "all" && u.role !== roleFilter) return false;
      if (statusFilter !== "all" && u.status !== statusFilter) return false;
      return true;
    });
  }, [users, roleFilter, statusFilter]);

  async function toggleStatus(user: Profile, e: React.MouseEvent) {
    e.stopPropagation();
    const next: ProfileStatus =
      user.status === "active" ? "suspended" : "active";
    setPendingStatusFor(user.id);
    const result = await updateUserStatus({ user_id: user.id, status: next });
    setPendingStatusFor(null);
    if (result.error) {
      toast.error("Status change failed", { description: result.error });
      return;
    }
    toast.success(`User ${next === "active" ? "activated" : "suspended"}`);
    router.refresh();
  }

  const columns: DataTableColumn<Profile>[] = [
    {
      id: "user",
      header: "User",
      cell: (row) => (
        <div className="flex items-center gap-3">
          <Avatar className="size-8">
            {row.avatar_url ? (
              <AvatarImage src={row.avatar_url} alt={row.full_name ?? row.email} />
            ) : null}
            <AvatarFallback className="text-xs">
              {initialsOf(row)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">
              {row.full_name ?? "—"}
            </div>
            <div className="truncate text-xs text-muted-foreground font-mono">
              {row.email}
            </div>
          </div>
        </div>
      ),
    },
    {
      id: "role",
      header: "Role",
      cell: (row) => (
        <span className="text-sm">
          {row.role ? ROLE_LABELS[row.role] : "—"}
        </span>
      ),
    },
    {
      id: "status",
      header: "Status",
      cell: (row) => <StatusBadge variant="profile" status={row.status} />,
    },
    {
      id: "agency",
      header: "Agency",
      cell: (row) => (
        <span className="text-sm text-muted-foreground">
          {row.agency ?? "—"}
        </span>
      ),
    },
    {
      id: "activity",
      header: "Last activity",
      cell: (row) => (
        <span className="text-xs text-muted-foreground">
          {format(new Date(row.updated_at), "MMM d, yyyy")}
        </span>
      ),
    },
    {
      id: "actions",
      header: "",
      className: "w-32 text-right",
      cell: (row) => {
        const isSelf = row.id === currentProfileId;
        const isSuperAdmin = row.role === "super_admin";
        const cannotChange =
          isSelf ||
          (isSuperAdmin && currentRole !== "super_admin");
        return (
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              disabled={cannotChange || pendingStatusFor === row.id}
              onClick={(e) => toggleStatus(row, e)}
            >
              {row.status === "active" ? (
                <>
                  <Pause className="size-3.5" />
                  Suspend
                </>
              ) : (
                <>
                  <Play className="size-3.5" />
                  Activate
                </>
              )}
            </Button>
          </div>
        );
      },
    },
  ];

  return (
    <>
      <DataTable
        data={filtered}
        columns={columns}
        rowKey={(row) => row.id}
        searchable={{
          placeholder: "Search by name or email…",
          predicate: (row, q) =>
            (row.full_name ?? "").toLowerCase().includes(q) ||
            row.email.toLowerCase().includes(q),
        }}
        filters={
          <>
            <Select
              value={roleFilter}
              onValueChange={(v) => setRoleFilter(v as UserRole | "all")}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue>
                  {(v: string | null) =>
                    !v || v === "all"
                      ? "All roles"
                      : v in ROLE_LABELS
                        ? ROLE_LABELS[v as UserRole]
                        : v
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All roles</SelectItem>
                {USER_ROLES.map((role) => (
                  <SelectItem key={role} value={role}>
                    {ROLE_LABELS[role]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as ProfileStatus | "all")}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue>
                  {(v: string | null) =>
                    !v || v === "all"
                      ? "All statuses"
                      : v in PROFILE_STATUS_LABELS
                        ? PROFILE_STATUS_LABELS[v as ProfileStatus]
                        : v
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="suspended">Suspended</SelectItem>
              </SelectContent>
            </Select>
          </>
        }
        empty={{
          title: "No users yet",
          description: "Invite the first user to get started.",
        }}
        onRowClick={(row) => setEditing(row)}
      />
      <EditUserDialog
        user={editing}
        currentProfileId={currentProfileId}
        currentRole={currentRole}
        onClose={() => setEditing(null)}
      />
    </>
  );
}
