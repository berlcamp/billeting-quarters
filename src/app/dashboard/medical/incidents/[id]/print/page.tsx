import { notFound } from "next/navigation";
import { Forbidden } from "@/components/shared/forbidden";
import { PatientReferralForm } from "@/components/medical/patient-referral-form";
import { PrintFormToolbar } from "@/components/medical/print-form-toolbar";
import { getIncident } from "@/lib/actions/incidents";
import { getReferralsByIncident } from "@/lib/actions/referrals";
import { getSites } from "@/lib/actions/sites";
import { getDelegations } from "@/lib/actions/delegations";
import { getCurrentProfile } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ auto?: string }>;
}

export default async function MedicalIncidentPrintPage({
  params,
  searchParams,
}: PageProps) {
  const { id } = await params;
  const sp = searchParams ? await searchParams : undefined;
  const autoPrint = sp?.auto !== "0";

  const profile = await getCurrentProfile();
  if (!profile || !hasPermission(profile, "incident.view")) {
    return (
      <Forbidden message="You don't have permission to view this form." />
    );
  }

  const [incidentResult, referralsResult, sitesResult, delegationsResult] =
    await Promise.all([
      getIncident(id),
      getReferralsByIncident(id),
      getSites(true),
      getDelegations(true),
    ]);

  if (incidentResult.error) {
    if (incidentResult.error.toLowerCase().includes("no rows")) notFound();
    return (
      <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
        Failed to load incident: {incidentResult.error}
      </div>
    );
  }

  const incident = incidentResult.data!;
  const referrals = referralsResult.error ? [] : (referralsResult.data ?? []);
  const sites = sitesResult.error ? [] : (sitesResult.data ?? []);
  const delegations = delegationsResult.error
    ? []
    : (delegationsResult.data ?? []);

  const site = incident.site_id
    ? sites.find((s) => s.id === incident.site_id) ?? null
    : null;
  const delegation = incident.delegation_id
    ? delegations.find((d) => d.id === incident.delegation_id) ?? null
    : null;

  return (
    <div className="space-y-4 print:space-y-0">
      <PrintFormToolbar
        backHref={`/dashboard/medical/incidents`}
        autoPrint={autoPrint}
      />
      <PatientReferralForm
        incident={incident}
        referrals={referrals}
        site={site}
        delegation={delegation}
      />
      {/* Print rules: A4 portrait, no app chrome. We let content flow to a
          second page when the medical fields push past 297mm — the previous
          rule height-clipped the box and chopped off the signature row. The
          signature row itself uses break-inside: avoid so it always stays
          intact on whichever page it lands on. */}
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 8mm; }
          html, body { background: white !important; }
          .patient-referral-form {
            width: auto !important;
            max-width: 194mm !important;
            padding: 0 !important;
            margin: 0 auto !important;
            box-sizing: border-box !important;
          }
          .patient-referral-form .signature-row {
            break-inside: avoid;
            page-break-inside: avoid;
          }
        }
      `}</style>
    </div>
  );
}
