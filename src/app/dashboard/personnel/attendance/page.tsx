import { PageHeader } from "@/components/layout/page-header";
import { Forbidden } from "@/components/shared/forbidden";
import { ManualAttendanceDialog } from "@/components/personnel/manual-attendance-dialog";
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

export default async function AttendancePage() {
  const profile = await getCurrentProfile();
  if (
    !profile ||
    !hasAnyPermission(profile, ["attendance.record", "personnel.manage"])
  ) {
    return (
      <Forbidden message="Attendance requires the attendance.record permission." />
    );
  }

  const today = todayInManila();
  const { startUtc, endUtc } = manilaDayBoundsUtc(today);

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
        description={`Time-in / time-out logging for ${today} (Asia/Manila).`}
        actions={
          <div className="flex items-center gap-2">
            <ManualAttendanceDialog personnel={personnel} sites={sites} />
            <ScanAttendanceDialog sites={sites} />
          </div>
        }
      />
      <AttendanceTable logs={logs} personnel={personnel} sites={sites} />
    </div>
  );
}
