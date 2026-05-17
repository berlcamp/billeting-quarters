import { Forbidden } from "@/components/shared/forbidden";
import { PageHeader } from "@/components/layout/page-header";
import { HospitalInboxTable } from "@/components/medical/hospital/hospital-inbox-table";
import { DirectAdmitDialog } from "@/components/medical/hospital/direct-admit-dialog";
import { getCurrentProfile } from "@/lib/auth/session";
import { hasAnyPermission, hasPermission } from "@/lib/permissions";
import { getHospitalInbox } from "@/lib/actions/referrals";
import { getSites } from "@/lib/actions/sites";
import { getDelegations } from "@/lib/actions/delegations";

export default async function HospitalPage() {
  const profile = await getCurrentProfile();
  if (
    !profile ||
    !hasAnyPermission(profile, [
      "referral.accept",
      "referral.assess",
      "referral.discharge",
    ])
  ) {
    return <Forbidden message="Hospital role required to use this view." />;
  }

  const [inboxResult, sitesResult, delegationsResult] = await Promise.all([
    getHospitalInbox(),
    getSites(true),
    getDelegations(true),
  ]);

  const referrals = inboxResult.error ? [] : (inboxResult.data ?? []);
  const sites = sitesResult.error ? [] : (sitesResult.data ?? []);
  const delegations = delegationsResult.error
    ? []
    : (delegationsResult.data ?? []);

  const hospitalSites = sites
    .filter((s) => s.site_type === "hospital")
    .map((s) => ({ id: s.id, name: s.name }));
  const delegationOptions = delegations.map((d) => ({
    id: d.id,
    region_code: d.region_code,
    region_name: d.region_name,
  }));
  const siteLookup = new Map(sites.map((s) => [s.id, s.name]));
  const delegationLookup = new Map(
    delegations.map((d) => [
      d.id,
      { code: d.region_code, name: d.region_name },
    ]),
  );

  // If staff have a primary assignment that's a hospital, default the direct-admit dialog to it.
  const defaultHospitalId =
    profile.primary_assignment_site_id &&
    hospitalSites.some((h) => h.id === profile.primary_assignment_site_id)
      ? profile.primary_assignment_site_id
      : undefined;

  const canDirectAdmit = hasPermission(profile, "referral.accept");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Hospital"
        description="Reception, assessment, admission, discharge, and direct admits."
        actions={
          canDirectAdmit ? (
            <DirectAdmitDialog
              hospitalSites={hospitalSites}
              delegations={delegationOptions}
              defaultHospitalId={defaultHospitalId}
              priorReferrals={referrals.map((r) => ({
                id: r.id,
                patient_name: r.patient_name,
                referred_at: r.referred_at,
                history: r.history,
                physical_examination: r.physical_examination,
              }))}
            />
          ) : null
        }
      />
      {inboxResult.error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          Failed to load inbox: {inboxResult.error}
        </div>
      ) : (
        <HospitalInboxTable
          referrals={referrals}
          siteLookup={siteLookup}
          delegationLookup={delegationLookup}
        />
      )}
    </div>
  );
}
