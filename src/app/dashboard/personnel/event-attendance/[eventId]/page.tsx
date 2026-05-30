import Link from "next/link";
import { ArrowLeft, MapPin } from "lucide-react";
import { Forbidden } from "@/components/shared/forbidden";
import { PageHeader } from "@/components/layout/page-header";
import { EventFormDialog } from "@/components/personnel/event-attendance/event-form-dialog";
import { ScanEventAttendanceDialog } from "@/components/personnel/event-attendance/scan-event-attendance-dialog";
import { ManualEventAttendanceDialog } from "@/components/personnel/event-attendance/manual-event-attendance-dialog";
import { EventAttendanceTable } from "@/components/personnel/event-attendance/event-attendance-table";
import {
  getEvent,
  getEventAttendanceLogs,
} from "@/lib/actions/event-attendance";
import { getCurrentProfile } from "@/lib/auth/session";
import { hasAnyPermission, hasPermission } from "@/lib/permissions";
import { formatManila } from "@/lib/timezone";

export default async function EventAttendanceDetailPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
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

  const [eventRes, logsRes] = await Promise.all([
    getEvent(eventId),
    getEventAttendanceLogs(eventId),
  ]);

  if (eventRes.error || !eventRes.data) {
    return (
      <div className="space-y-6">
        <Link
          href="/dashboard/personnel/event-attendance"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-3.5" />
          All events
        </Link>
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          {eventRes.error ?? "Event not found."}
        </div>
      </div>
    );
  }

  const event = eventRes.data;
  const logs = logsRes.error ? [] : logsRes.data ?? [];

  const descriptionParts: string[] = [];
  if (event.event_date) descriptionParts.push(formatManila(event.event_date));
  if (event.location) descriptionParts.push(event.location);

  return (
    <div className="space-y-6">
      <Link
        href="/dashboard/personnel/event-attendance"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        All events
      </Link>

      <PageHeader
        title={event.name}
        description={
          descriptionParts.length > 0
            ? descriptionParts.join(" · ")
            : event.description ?? "Time-in only attendance."
        }
        actions={
          <div className="flex items-center gap-2">
            {canManage ? <EventFormDialog event={event} /> : null}
            <ManualEventAttendanceDialog eventId={event.id} />
            <ScanEventAttendanceDialog eventId={event.id} />
          </div>
        }
      />

      {event.location ? (
        <p className="flex items-center gap-1 text-sm text-muted-foreground">
          <MapPin className="size-4" />
          {event.location}
        </p>
      ) : null}

      <EventAttendanceTable logs={logs} />
    </div>
  );
}
