import { PageHeader } from "@/components/layout/page-header";
import { Forbidden } from "@/components/shared/forbidden";
import { EventsList } from "@/components/personnel/event-attendance/events-list";
import { EventFormDialog } from "@/components/personnel/event-attendance/event-form-dialog";
import { getEvents } from "@/lib/actions/event-attendance";
import { getCurrentProfile } from "@/lib/auth/session";
import { hasAnyPermission, hasPermission } from "@/lib/permissions";

export default async function EventAttendanceListPage() {
  const profile = await getCurrentProfile();
  if (
    !profile ||
    !hasAnyPermission(profile, [
      "event_attendance.record",
      "event_attendance.manage",
    ])
  ) {
    return (
      <Forbidden message="Event Attendance requires the event_attendance.record permission." />
    );
  }

  const canManage = hasPermission(profile, "event_attendance.manage");
  const result = await getEvents();
  const events = result.error ? [] : result.data ?? [];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Event Attendance"
        description="Create events and log time-in attendance by scanning personnel QR codes."
        actions={canManage ? <EventFormDialog /> : null}
      />

      {result.error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          Failed to load events: {result.error}
        </div>
      ) : (
        <EventsList events={events} canManage={canManage} />
      )}
    </div>
  );
}
