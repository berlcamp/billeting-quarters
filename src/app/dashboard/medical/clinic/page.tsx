import { UserPlus } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Forbidden } from "@/components/shared/forbidden";
import { Button } from "@/components/ui/button";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { LogVisitDialog } from "@/components/clinic/log-visit-dialog";
import { PatientFormDialog } from "@/components/clinic/patient-form-dialog";
import { PatientsTable } from "@/components/clinic/patients-table";
import { VisitsTable } from "@/components/clinic/visits-table";
import { getCurrentProfile } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions";
import { getPatients, getVisits } from "@/lib/actions/clinic";
import { getDelegations } from "@/lib/actions/delegations";
import { getSites } from "@/lib/actions/sites";

export default async function MedicalClinicPage() {
  const profile = await getCurrentProfile();
  if (!profile || !hasPermission(profile, "clinic.manage")) {
    return (
      <Forbidden message="Open Clinic requires the clinic.manage permission." />
    );
  }

  const [patientsRes, visitsRes, sitesRes, delegationsRes] = await Promise.all([
    getPatients(),
    getVisits(200),
    getSites(false),
    getDelegations(false),
  ]);

  const patients = patientsRes.error ? [] : (patientsRes.data ?? []);
  const visits = visitsRes.error ? [] : (visitsRes.data ?? []);
  const sites = sitesRes.error ? [] : (sitesRes.data ?? []);
  const delegations = delegationsRes.error
    ? []
    : (delegationsRes.data ?? []);

  const clinicSites = sites.filter((s) => s.site_type === "clinic");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Open Clinic"
        description="Walk-in patient registry and visit logging for clinic sites."
        actions={
          <div className="flex items-center gap-2">
            <PatientFormDialog
              delegations={delegations}
              trigger={
                <Button variant="outline">
                  <UserPlus className="size-4" />
                  Add patient
                </Button>
              }
            />
            <LogVisitDialog
              patients={patients}
              clinicSites={clinicSites}
            />
          </div>
        }
      />

      {clinicSites.length === 0 ? (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-800 dark:text-amber-200">
          No clinic sites configured yet. Add one under{" "}
          <span className="font-mono">Admin → Sites</span> with type{" "}
          <span className="font-mono">clinic</span> before logging visits.
        </div>
      ) : null}

      <Tabs defaultValue="visits">
        <TabsList>
          <TabsTrigger value="visits">Visits</TabsTrigger>
          <TabsTrigger value="patients">
            Patients ({patients.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="visits" className="mt-4">
          <VisitsTable visits={visits} patients={patients} sites={sites} />
        </TabsContent>

        <TabsContent value="patients" className="mt-4">
          <PatientsTable
            patients={patients}
            visits={visits}
            delegations={delegations}
            clinicSites={clinicSites}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
