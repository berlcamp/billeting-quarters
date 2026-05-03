import { CalendarPlus } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Forbidden } from "@/components/shared/forbidden";
import { Button } from "@/components/ui/button";
import { DutyFormDialog } from "@/components/personnel/duty-form-dialog";
import { DutyTable } from "@/components/personnel/duty-table";
import { getCurrentProfile } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions";
import {
  getDutySchedules,
  getPersonnel,
} from "@/lib/actions/personnel";
import { getSites } from "@/lib/actions/sites";

export default async function DutySchedulePage() {
  const profile = await getCurrentProfile();
  if (!profile || !hasPermission(profile, "personnel.manage")) {
    return (
      <Forbidden message="Duty schedule requires the personnel.manage permission." />
    );
  }

  const [dutyRes, personnelRes, sitesRes] = await Promise.all([
    getDutySchedules(),
    getPersonnel(),
    getSites(false),
  ]);

  const duties = dutyRes.error ? [] : (dutyRes.data ?? []);
  const personnel = personnelRes.error ? [] : (personnelRes.data ?? []);
  const sites = sitesRes.error ? [] : (sitesRes.data ?? []);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Duty Schedule"
        description="Personnel assignments and shift rosters across all sites."
        actions={
          <DutyFormDialog
            personnel={personnel}
            sites={sites}
            trigger={
              <Button>
                <CalendarPlus className="size-4" />
                Schedule shift
              </Button>
            }
          />
        }
      />
      <DutyTable duties={duties} personnel={personnel} sites={sites} />
    </div>
  );
}
