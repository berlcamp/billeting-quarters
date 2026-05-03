import { Forbidden } from "@/components/shared/forbidden";
import { PageHeader } from "@/components/layout/page-header";
import { NotificationsTable } from "@/components/notifications/notifications-table";
import { getCurrentProfile } from "@/lib/auth/session";
import { getMyNotifications } from "@/lib/actions/notifications";

export default async function NotificationsPage() {
  const profile = await getCurrentProfile();
  if (!profile) return <Forbidden message="Sign in to view notifications." />;

  const result = await getMyNotifications(200);
  const notifications = result.error ? [] : (result.data ?? []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        description="Everything addressed to you or your role."
      />
      {result.error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          Failed to load notifications: {result.error}
        </div>
      ) : (
        <NotificationsTable
          initial={notifications}
          profileId={profile.id}
          role={profile.role}
        />
      )}
    </div>
  );
}
