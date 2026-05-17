import { Forbidden } from "@/components/shared/forbidden";
import { PageHeader } from "@/components/layout/page-header";
import { UcfInboxTable } from "@/components/medical/ucf/ucf-inbox-table";
import { UcfDirectAdmitDialog } from "@/components/medical/ucf/direct-admit-dialog";
import { getCurrentProfile } from "@/lib/auth/session";
import { hasAnyPermission, hasPermission } from "@/lib/permissions";
import { getUcfInbox } from "@/lib/actions/referrals";
import { getSites } from "@/lib/actions/sites";
import { getDelegations } from "@/lib/actions/delegations";

export default async function UcfPage() {
  const profile = await getCurrentProfile();
  if (
    !profile ||
    !hasAnyPermission(profile, [
      "referral.accept",
      "referral.assess",
      "referral.discharge",
    ])
  ) {
    return <Forbidden message="UCF role required to use this view." />;
  }

  const [inboxResult, sitesResult, delegationsResult] = await Promise.all([
    getUcfInbox(),
    getSites(true),
    getDelegations(true),
  ]);

  const referrals = inboxResult.error ? [] : (inboxResult.data ?? []);
  const sites = sitesResult.error ? [] : (sitesResult.data ?? []);
  const delegations = delegationsResult.error
    ? []
    : (delegationsResult.data ?? []);

  const siteLookup = new Map(sites.map((s) => [s.id, s.name]));
  const delegationLookup = new Map(
    delegations.map((d) => [
      d.id,
      { code: d.region_code, name: d.region_name },
    ]),
  );

  const ucfSites = sites
    .filter((s) => s.site_type === "urgent_care_facility")
    .map((s) => ({ id: s.id, name: s.name }));
  const delegationOptions = delegations.map((d) => ({
    id: d.id,
    region_code: d.region_code,
    region_name: d.region_name,
  }));

  const defaultUcfId =
    profile.primary_assignment_site_id &&
    ucfSites.some((u) => u.id === profile.primary_assignment_site_id)
      ? profile.primary_assignment_site_id
      : undefined;

  const canDirectAdmit = hasPermission(profile, "referral.accept");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Urgent Care Facility"
        description="Receive incoming field referrals, assess, and discharge or escalate."
        actions={
          canDirectAdmit ? (
            <UcfDirectAdmitDialog
              ucfSites={ucfSites}
              delegations={delegationOptions}
              defaultUcfId={defaultUcfId}
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
        <UcfInboxTable
          referrals={referrals}
          siteLookup={siteLookup}
          delegationLookup={delegationLookup}
        />
      )}
    </div>
  );
}
