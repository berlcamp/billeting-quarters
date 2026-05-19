import Link from "next/link";
import { Printer } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Forbidden } from "@/components/shared/forbidden";
import { buttonVariants } from "@/components/ui/button";
import { HeadCounterGrid } from "@/components/head-counter/head-counter-grid";
import { HeadCounterConsolidated } from "@/components/head-counter/head-counter-consolidated";
import { HeadCounterDateNav } from "@/components/head-counter/head-counter-date-nav";
import { HeadCounterDelegationNav } from "@/components/head-counter/head-counter-delegation-nav";
import {
  HeadCounterTabNav,
  type HeadCounterTab,
} from "@/components/head-counter/head-counter-tab-nav";
import { HeadCounterVenueGrid } from "@/components/head-counter/head-counter-venue-grid";
import { HeadCounterVenueConsolidated } from "@/components/head-counter/head-counter-venue-consolidated";
import { HeadCounterVenueSiteNav } from "@/components/head-counter/head-counter-venue-site-nav";
import { getCurrentProfile } from "@/lib/auth/session";
import { hasAnyPermission, hasPermission } from "@/lib/permissions";
import { getDelegations } from "@/lib/actions/delegations";
import {
  getConsolidatedHeadCounter,
  getHeadCounterCells,
} from "@/lib/actions/head-counter";
import {
  getConsolidatedHeadCounterVenue,
  getHeadCounterVenueCells,
} from "@/lib/actions/head-counter-venue";
import { getSites } from "@/lib/actions/sites";
import {
  HEAD_COUNT_WINDOW_END,
  HEAD_COUNT_WINDOW_START,
  clampToHeadCountWindow,
  isInHeadCountWindow,
} from "@/lib/schemas/head-counter";
import { manilaDateLabel, todayInManila } from "@/lib/timezone";

const ALL_DELEGATIONS = "all";
const ALL_SITES = "all";

interface PageProps {
  searchParams: Promise<{
    date?: string;
    delegation?: string;
    site?: string;
    tab?: string;
  }>;
}

function defaultDate(): string {
  const today = todayInManila();
  return clampToHeadCountWindow(today);
}

export default async function HeadCounterPage({ searchParams }: PageProps) {
  const profile = await getCurrentProfile();
  const canBq = profile
    ? hasAnyPermission(profile, [
        "head_count.encode_own",
        "head_count.view_all",
      ])
    : false;
  const canVenue = profile
    ? hasAnyPermission(profile, [
        "head_count.venue_encode",
        "head_count.venue_view_all",
      ])
    : false;

  if (!profile || (!canBq && !canVenue)) {
    return (
      <Forbidden message="Head Counter requires BQ or Venue head-count permissions." />
    );
  }

  const sp = await searchParams;

  const requestedTab = sp.tab === "venue" ? "venue" : sp.tab === "bq" ? "bq" : null;
  const activeTab: HeadCounterTab =
    requestedTab && (requestedTab === "bq" ? canBq : canVenue)
      ? requestedTab
      : canBq
        ? "bq"
        : "venue";

  const tabOptions: { value: HeadCounterTab; label: string }[] = [];
  if (canBq) tabOptions.push({ value: "bq", label: "BQ" });
  if (canVenue) tabOptions.push({ value: "venue", label: "Venue" });

  const dateParam =
    sp.date && isInHeadCountWindow(sp.date) ? sp.date : defaultDate();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Head Counter"
        description={`Daily IN / OUT tally · window ${HEAD_COUNT_WINDOW_START} → ${HEAD_COUNT_WINDOW_END}. Today: ${manilaDateLabel(dateParam)}.`}
        actions={
          (activeTab === "bq" && hasPermission(profile, "head_count.view_all")) ||
          (activeTab === "venue" &&
            hasPermission(profile, "head_count.venue_view_all")) ? (
            <PrintLink activeTab={activeTab} sp={sp} />
          ) : null
        }
      />

      {tabOptions.length > 1 ? (
        <HeadCounterTabNav active={activeTab} options={tabOptions} />
      ) : null}

      {activeTab === "bq" ? (
        <BqTab profile={profile} dateParam={dateParam} delegationParam={sp.delegation} />
      ) : (
        <VenueTab profile={profile} dateParam={dateParam} siteParam={sp.site} />
      )}
    </div>
  );
}

// ===== BQ tab =====

interface BqTabProps {
  profile: Awaited<ReturnType<typeof getCurrentProfile>>;
  dateParam: string;
  delegationParam: string | undefined;
}

async function BqTab({ profile, dateParam, delegationParam }: BqTabProps) {
  if (!profile) return null;
  const isAdmin = hasPermission(profile, "head_count.view_all");

  const delegationsRes = await getDelegations(false);
  const delegationsAll = delegationsRes.error ? [] : (delegationsRes.data ?? []);
  const delegationOpts = delegationsAll.map((d) => ({
    id: d.id,
    region_code: d.region_code,
    region_name: d.region_name,
  }));

  const visibleDelegations = isAdmin
    ? delegationOpts
    : delegationOpts.filter((d) => d.id === profile.delegation_id);

  const selectedDelegationId = isAdmin
    ? delegationParam ?? ALL_DELEGATIONS
    : profile.delegation_id ?? null;

  if (!isAdmin && !profile.delegation_id) {
    return (
      <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-800 dark:text-amber-200">
        Your account isn&rsquo;t linked to a delegation yet. Ask an admin to
        set it under <span className="font-mono">Admin → Users</span> on your
        profile so you can start encoding.
      </div>
    );
  }

  let consolidatedCells: Awaited<
    ReturnType<typeof getConsolidatedHeadCounter>
  > | null = null;
  let singleCells: Awaited<ReturnType<typeof getHeadCounterCells>> | null = null;

  if (isAdmin && selectedDelegationId === ALL_DELEGATIONS) {
    consolidatedCells = await getConsolidatedHeadCounter(dateParam);
  } else if (selectedDelegationId) {
    singleCells = await getHeadCounterCells({
      delegationId: selectedDelegationId,
      dateYmd: dateParam,
    });
  }

  const selectedDelegation =
    selectedDelegationId && selectedDelegationId !== ALL_DELEGATIONS
      ? delegationOpts.find((d) => d.id === selectedDelegationId) ?? null
      : null;

  return (
    <>
      <div className="flex flex-wrap items-end gap-3">
        <HeadCounterDateNav
          selectedDate={dateParam}
          min={HEAD_COUNT_WINDOW_START}
          max={HEAD_COUNT_WINDOW_END}
        />
        {isAdmin ? (
          <HeadCounterDelegationNav
            selectedId={selectedDelegationId ?? ALL_DELEGATIONS}
            delegations={delegationOpts}
            allValue={ALL_DELEGATIONS}
          />
        ) : selectedDelegation ? (
          <div className="text-sm">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">
              Delegation
            </span>
            <div className="font-medium">
              {selectedDelegation.region_code} — {selectedDelegation.region_name}
            </div>
          </div>
        ) : null}
      </div>

      {isAdmin && selectedDelegationId === ALL_DELEGATIONS ? (
        consolidatedCells?.error ? (
          <ErrorBox message={consolidatedCells.error} />
        ) : (
          <HeadCounterConsolidated
            dateYmd={dateParam}
            delegations={visibleDelegations}
            cells={consolidatedCells?.data ?? []}
          />
        )
      ) : selectedDelegation ? (
        singleCells?.error ? (
          <ErrorBox message={singleCells.error} />
        ) : (
          <HeadCounterGrid
            delegationId={selectedDelegation.id}
            delegationLabel={`${selectedDelegation.region_code} — ${selectedDelegation.region_name}`}
            dateYmd={dateParam}
            initialCells={singleCells?.data ?? []}
            readOnly={
              !hasPermission(profile, "head_count.encode_own") ||
              (!isAdmin && profile.delegation_id !== selectedDelegation.id)
            }
          />
        )
      ) : (
        <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          Pick a delegation above to view or encode their tally.
        </div>
      )}
    </>
  );
}

// ===== Venue tab =====

interface VenueTabProps {
  profile: Awaited<ReturnType<typeof getCurrentProfile>>;
  dateParam: string;
  siteParam: string | undefined;
}

async function VenueTab({ profile, dateParam, siteParam }: VenueTabProps) {
  if (!profile) return null;

  const canViewAll = hasPermission(profile, "head_count.venue_view_all");
  const canEncode = hasPermission(profile, "head_count.venue_encode");

  const sitesRes = await getSites(false);
  const sitesAll = sitesRes.error ? [] : (sitesRes.data ?? []);
  const playingVenues = sitesAll
    .filter((s) => s.site_type === "playing_venue")
    .map((s) => ({ id: s.id, name: s.name }));

  const selectedSiteId = siteParam ?? ALL_SITES;

  let consolidated: Awaited<
    ReturnType<typeof getConsolidatedHeadCounterVenue>
  > | null = null;
  let single: Awaited<ReturnType<typeof getHeadCounterVenueCells>> | null =
    null;

  if (selectedSiteId === ALL_SITES) {
    if (canViewAll) {
      consolidated = await getConsolidatedHeadCounterVenue(dateParam);
    }
  } else {
    single = await getHeadCounterVenueCells({
      siteId: selectedSiteId,
      dateYmd: dateParam,
    });
  }

  const selectedSite =
    selectedSiteId !== ALL_SITES
      ? playingVenues.find((s) => s.id === selectedSiteId) ?? null
      : null;

  return (
    <>
      <div className="flex flex-wrap items-end gap-3">
        <HeadCounterDateNav
          selectedDate={dateParam}
          min={HEAD_COUNT_WINDOW_START}
          max={HEAD_COUNT_WINDOW_END}
        />
        <HeadCounterVenueSiteNav
          selectedId={selectedSiteId}
          sites={playingVenues}
          allValue={ALL_SITES}
        />
      </div>

      {playingVenues.length === 0 ? (
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-800 dark:text-amber-200">
          No active playing venues found. Add or activate playing-venue sites
          under <span className="font-mono">Admin → Sites</span> first.
        </div>
      ) : selectedSiteId === ALL_SITES ? (
        canViewAll ? (
          consolidated?.error ? (
            <ErrorBox message={consolidated.error} />
          ) : (
            <HeadCounterVenueConsolidated
              dateYmd={dateParam}
              sites={playingVenues}
              cells={consolidated?.data ?? []}
            />
          )
        ) : (
          <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            Pick a venue above to view or encode its tally.
          </div>
        )
      ) : selectedSite ? (
        single?.error ? (
          <ErrorBox message={single.error} />
        ) : (
          <HeadCounterVenueGrid
            siteId={selectedSite.id}
            siteLabel={selectedSite.name}
            dateYmd={dateParam}
            initialCells={single?.data ?? []}
            readOnly={!canEncode}
          />
        )
      ) : (
        <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          Venue not found.
        </div>
      )}
    </>
  );
}

// ===== Helpers =====

function PrintLink({
  activeTab,
  sp,
}: {
  activeTab: HeadCounterTab;
  sp: { delegation?: string; site?: string };
}) {
  const qs = new URLSearchParams();
  qs.set("tab", activeTab);
  if (activeTab === "bq" && sp.delegation && sp.delegation !== ALL_DELEGATIONS) {
    qs.set("delegation", sp.delegation);
  }
  if (activeTab === "venue" && sp.site && sp.site !== ALL_SITES) {
    qs.set("site", sp.site);
  }
  return (
    <Link
      href={`/dashboard/personnel/head-counter/print?${qs.toString()}`}
      className={buttonVariants({ variant: "outline", size: "sm" })}
      target="_blank"
    >
      <Printer className="size-4" />
      Print
    </Link>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
      {message}
    </div>
  );
}
