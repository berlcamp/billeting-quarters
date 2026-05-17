import Link from "next/link";
import { Printer } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Forbidden } from "@/components/shared/forbidden";
import { buttonVariants } from "@/components/ui/button";
import { HeadCounterGrid } from "@/components/head-counter/head-counter-grid";
import { HeadCounterConsolidated } from "@/components/head-counter/head-counter-consolidated";
import { HeadCounterDateNav } from "@/components/head-counter/head-counter-date-nav";
import { HeadCounterDelegationNav } from "@/components/head-counter/head-counter-delegation-nav";
import { getCurrentProfile } from "@/lib/auth/session";
import { hasAnyPermission, hasPermission } from "@/lib/permissions";
import { getDelegations } from "@/lib/actions/delegations";
import {
  getConsolidatedHeadCounter,
  getHeadCounterCells,
} from "@/lib/actions/head-counter";
import {
  HEAD_COUNT_WINDOW_END,
  HEAD_COUNT_WINDOW_START,
  clampToHeadCountWindow,
  isInHeadCountWindow,
} from "@/lib/schemas/head-counter";
import { manilaDateLabel, todayInManila } from "@/lib/timezone";

const ALL_DELEGATIONS = "all";

interface PageProps {
  searchParams: Promise<{ date?: string; delegation?: string }>;
}

function defaultDate(): string {
  const today = todayInManila();
  return clampToHeadCountWindow(today);
}

export default async function HeadCounterPage({ searchParams }: PageProps) {
  const profile = await getCurrentProfile();
  if (
    !profile ||
    !hasAnyPermission(profile, [
      "head_count.encode_own",
      "head_count.view_all",
    ])
  ) {
    return (
      <Forbidden message="Head Counter requires head_count.encode_own or head_count.view_all." />
    );
  }

  const sp = await searchParams;
  const isAdmin = hasPermission(profile, "head_count.view_all");

  const dateParam = sp.date && isInHeadCountWindow(sp.date) ? sp.date : defaultDate();

  const delegationsRes = await getDelegations(false);
  const delegationsAll = delegationsRes.error ? [] : (delegationsRes.data ?? []);
  const delegationOpts = delegationsAll.map((d) => ({
    id: d.id,
    region_code: d.region_code,
    region_name: d.region_name,
  }));

  // Encoders see only their own delegation; admins see all.
  const visibleDelegations = isAdmin
    ? delegationOpts
    : delegationOpts.filter((d) => d.id === profile.delegation_id);

  // Selected delegation. Encoder is locked to their own; admin chooses, with
  // "all" → consolidated read-only summary.
  const selectedDelegationId = isAdmin
    ? sp.delegation ?? ALL_DELEGATIONS
    : profile.delegation_id ?? null;

  // Encoder onboarding gap.
  if (!isAdmin && !profile.delegation_id) {
    return (
      <div className="space-y-6">
        <PageHeader
          title="Head Counter"
          description="Daily IN / OUT tally for your delegation."
        />
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-800 dark:text-amber-200">
          Your account isn&rsquo;t linked to a delegation yet. Ask an admin to
          set it under <span className="font-mono">Admin → Users</span> on your
          profile so you can start encoding.
        </div>
      </div>
    );
  }

  const printQuery = new URLSearchParams({ date: dateParam });
  if (
    isAdmin &&
    selectedDelegationId &&
    selectedDelegationId !== ALL_DELEGATIONS
  ) {
    printQuery.set("delegation", selectedDelegationId);
  }
  const printHref = `/dashboard/personnel/head-counter/print?${printQuery.toString()}`;

  // ---- Data fetching ----
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
    <div className="space-y-6">
      <PageHeader
        title="Head Counter"
        description={`Daily IN / OUT tally · window ${HEAD_COUNT_WINDOW_START} → ${HEAD_COUNT_WINDOW_END}. Today: ${manilaDateLabel(dateParam)}.`}
        actions={
          isAdmin ? (
            <Link
              href={printHref}
              className={buttonVariants({ variant: "outline", size: "sm" })}
              target="_blank"
            >
              <Printer className="size-4" />
              Print
            </Link>
          ) : null
        }
      />

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
            readOnly={!hasPermission(profile, "head_count.encode_own") || (
              !isAdmin && profile.delegation_id !== selectedDelegation.id
            )}
          />
        )
      ) : (
        <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
          Pick a delegation above to view or encode their tally.
        </div>
      )}
    </div>
  );
}

function ErrorBox({ message }: { message: string }) {
  return (
    <div className="rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
      {message}
    </div>
  );
}
