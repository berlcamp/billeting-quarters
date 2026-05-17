import { Forbidden } from "@/components/shared/forbidden";
import { PageHeader } from "@/components/layout/page-header";
import { InviteUserDialog } from "@/components/admin/users/invite-user-dialog";
import { UsersTable } from "@/components/admin/users/users-table";
import { getUsers } from "@/lib/actions/profiles";
import { getDelegations } from "@/lib/actions/delegations";
import { requireRole } from "@/lib/auth/session";

export default async function AdminUsersPage() {
  const { allowed, profile } = await requireRole(["super_admin"]);
  if (!allowed || !profile) return <Forbidden />;

  const [usersRes, delegationsRes] = await Promise.all([
    getUsers(),
    getDelegations(false),
  ]);
  const users = usersRes.error ? [] : (usersRes.data ?? []);
  const delegations = delegationsRes.error ? [] : (delegationsRes.data ?? []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Users"
        description="Invite and manage system users."
        actions={<InviteUserDialog currentRoles={profile.roles} />}
      />
      {usersRes.error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          Failed to load users: {usersRes.error}
        </div>
      ) : (
        <UsersTable
          users={users}
          currentProfileId={profile.id}
          currentRoles={profile.roles}
          delegations={delegations.map((d) => ({
            id: d.id,
            region_code: d.region_code,
            region_name: d.region_name,
          }))}
        />
      )}
    </div>
  );
}
