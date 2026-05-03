import { Forbidden } from "@/components/shared/forbidden";
import { PageHeader } from "@/components/layout/page-header";
import { UcfInboxTable } from "@/components/medical/ucf/ucf-inbox-table";
import { getCurrentProfile } from "@/lib/auth/session";
import { hasAnyPermission } from "@/lib/permissions";
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Urgent Care Facility"
        description="Receive incoming field referrals, assess, and discharge or escalate."
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
