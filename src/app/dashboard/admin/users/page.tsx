import { Forbidden } from "@/components/shared/forbidden";
import { PageHeader } from "@/components/layout/page-header";
import { InviteUserDialog } from "@/components/admin/users/invite-user-dialog";
import { UsersTable } from "@/components/admin/users/users-table";
import { getUsers } from "@/lib/actions/profiles";
import { requireRole } from "@/lib/auth/session";

export default async function AdminUsersPage() {
  const { allowed, profile } = await requireRole([
    "super_admin",
    "command_center",
  ]);
  if (!allowed || !profile) return <Forbidden />;

  const result = await getUsers();
  const users = result.error ? [] : (result.data ?? []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        description="Invite and manage system users."
        actions={<InviteUserDialog currentRole={profile.role} />}
      />
      {result.error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          Failed to load users: {result.error}
        </div>
      ) : (
        <UsersTable
          users={users}
          currentProfileId={profile.id}
          currentRole={profile.role}
        />
      )}
    </div>
  );
}
