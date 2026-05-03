import { Forbidden } from "@/components/shared/forbidden";
import { PageHeader } from "@/components/layout/page-header";
import { CreateFieldReferralDialog } from "@/components/medical/field/create-field-referral-dialog";
import { FieldReferralsTable } from "@/components/medical/field/field-referrals-table";
import { getCurrentProfile } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions";
import { getMyFieldReferrals } from "@/lib/actions/referrals";
import { getSites } from "@/lib/actions/sites";
import { getDelegations } from "@/lib/actions/delegations";

export default async function MedicalFieldPage() {
  const profile = await getCurrentProfile();
  if (!profile || !hasPermission(profile, "referral.create_field_to_ucf")) {
    return (
      <Forbidden message="Field medic role required to use this view." />
    );
  }

  const [referralsResult, sitesResult, delegationsResult] = await Promise.all([
    getMyFieldReferrals(),
    getSites(),
    getDelegations(),
  ]);

  const referrals = referralsResult.error ? [] : (referralsResult.data ?? []);
  const allSites = sitesResult.error ? [] : (sitesResult.data ?? []);
  const delegations = delegationsResult.error
    ? []
    : (delegationsResult.data ?? []);

  const ucfSites = allSites
    .filter((s) => s.site_type === "urgent_care_facility")
    .map((s) => ({ id: s.id, name: s.name, site_type: s.site_type }));
  const delegationOptions = delegations.map((d) => ({
    id: d.id,
    region_code: d.region_code,
    region_name: d.region_name,
  }));
  const siteLookup = new Map(allSites.map((s) => [s.id, s.name]));
  const delegationLookup = new Map(
    delegations.map((d) => [
      d.id,
      { code: d.region_code, name: d.region_name },
    ]),
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Medical Field"
        description="Field medic intake. Create a referral to escalate a patient to an Urgent Care Facility."
        actions={
          <CreateFieldReferralDialog
            ucfSites={ucfSites}
            delegations={delegationOptions}
          />
        }
      />
      {referralsResult.error ? (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          Failed to load referrals: {referralsResult.error}
        </div>
      ) : (
        <FieldReferralsTable
          referrals={referrals}
          siteLookup={siteLookup}
          delegationLookup={delegationLookup}
        />
      )}
    </div>
  );
}
