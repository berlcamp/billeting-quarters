import { PageHeader } from "@/components/layout/page-header";
import { Forbidden } from "@/components/shared/forbidden";
import { ScanAttendanceDialog } from "@/components/personnel/scan-attendance-dialog";
import { AttendanceTable } from "@/components/personnel/attendance-table";
import { getCurrentProfile } from "@/lib/auth/session";
import { hasAnyPermission } from "@/lib/permissions";
import {
  getAttendanceLogs,
  getPersonnelForAttendance,
} from "@/lib/actions/personnel";
import { getSites } from "@/lib/actions/sites";
import { manilaDayBoundsUtc, todayInManila } from "@/lib/timezone";

const YMD = /^\d{4}-\d{2}-\d{2}$/;

interface PageProps {
  searchParams: Promise<{ date?: string }>;
}

export default async function AttendancePage({ searchParams }: PageProps) {
  const profile = await getCurrentProfile();
  if (
    !profile ||
    !hasAnyPermission(profile, ["attendance.record", "personnel.manage"])
  ) {
    return (
      <Forbidden message="Attendance requires the attendance.record permission." />
    );
  }

  const { date: dateParam } = await searchParams;
  const today = todayInManila();
  const selectedDate = dateParam && YMD.test(dateParam) ? dateParam : today;
  const { startUtc, endUtc } = manilaDayBoundsUtc(selectedDate);

  const [logsRes, personnelRes, sitesRes] = await Promise.all([
    getAttendanceLogs(startUtc, endUtc),
    getPersonnelForAttendance(),
    getSites(false),
  ]);

  const logs = logsRes.error ? [] : (logsRes.data ?? []);
  const personnel = personnelRes.error ? [] : (personnelRes.data ?? []);
  const sites = sitesRes.error ? [] : (sitesRes.data ?? []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Attendance"
        description="Time-in / time-out logging (Asia/Manila)."
        actions={<ScanAttendanceDialog sites={sites} />}
      />
      <AttendanceTable
        logs={logs}
        personnel={personnel}
        sites={sites}
        selectedDate={selectedDate}
        today={today}
      />
    </div>
  );
}
