import { Forbidden } from "@/components/shared/forbidden";
import { PrintFormToolbar } from "@/components/medical/print-form-toolbar";
import { HeadCounterPrintSheet } from "@/components/head-counter/head-counter-print-sheet";
import { HeadCounterVenuePrintSheet } from "@/components/head-counter/head-counter-venue-print-sheet";
import { getCurrentProfile } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions";
import { getDelegations } from "@/lib/actions/delegations";
import { getHeadCounterCellsForRange } from "@/lib/actions/head-counter";
import { getHeadCounterVenueCellsForRange } from "@/lib/actions/head-counter-venue";
import { getSites } from "@/lib/actions/sites";
import {
  HEAD_COUNT_WINDOW_END,
  HEAD_COUNT_WINDOW_START,
  isInHeadCountWindow,
} from "@/lib/schemas/head-counter";
import { dateRangeManilaYmd } from "@/lib/timezone";

interface PageProps {
  searchParams: Promise<{
    date?: string;
    from?: string;
    to?: string;
    delegation?: string;
    site?: string;
    tab?: string;
    auto?: string;
  }>;
}

export default async function HeadCounterPrintPage({ searchParams }: PageProps) {
  const profile = await getCurrentProfile();
  if (!profile) {
    return <Forbidden message="Sign in to print the consolidated report." />;
  }

  const sp = await searchParams;
  const tab: "bq" | "venue" = sp.tab === "venue" ? "venue" : "bq";

  const requiredPerm =
    tab === "venue" ? "head_count.venue_view_all" : "head_count.view_all";
  if (!hasPermission(profile, requiredPerm)) {
    return (
      <Forbidden
        message={`Printing the consolidated ${tab === "venue" ? "venue" : "BQ"} report requires ${requiredPerm}.`}
      />
    );
  }

  const autoPrint = false;

  const fromYmd =
    (sp.from && isInHeadCountWindow(sp.from) && sp.from) ||
    (sp.date && isInHeadCountWindow(sp.date) && sp.date) ||
    HEAD_COUNT_WINDOW_START;
  const toYmd =
    (sp.to && isInHeadCountWindow(sp.to) && sp.to) ||
    (sp.date && isInHeadCountWindow(sp.date) && sp.date) ||
    HEAD_COUNT_WINDOW_END;

  const dates = dateRangeManilaYmd(fromYmd, toYmd);

  if (tab === "venue") {
    return (
      <VenuePrint
        fromYmd={fromYmd}
        toYmd={toYmd}
        dates={dates}
        siteFilter={sp.site}
        autoPrint={autoPrint}
      />
    );
  }

  return (
    <BqPrint
      fromYmd={fromYmd}
      toYmd={toYmd}
      dates={dates}
      delegationFilter={sp.delegation}
      autoPrint={autoPrint}
    />
  );
}

async function BqPrint({
  fromYmd,
  toYmd,
  dates,
  delegationFilter,
  autoPrint,
}: {
  fromYmd: string;
  toYmd: string;
  dates: string[];
  delegationFilter: string | undefined;
  autoPrint: boolean;
}) {
  const delegationsRes = await getDelegations(false);
  let delegations = delegationsRes.error ? [] : (delegationsRes.data ?? []);
  if (delegationFilter) {
    delegations = delegations.filter((d) => d.id === delegationFilter);
  }
  const delegationIds = delegations.map((d) => d.id);

  const cellsRes = await getHeadCounterCellsForRange({
    fromYmd,
    toYmd,
    delegationIds: delegationIds.length > 0 ? delegationIds : undefined,
  });
  const allCells = cellsRes.error ? [] : (cellsRes.data ?? []);

  return (
    <div className="space-y-4 print:space-y-0">
      <div className="mx-auto w-[297mm] max-w-full print:hidden">
        <PrintFormToolbar
          backHref={`/dashboard/personnel/head-counter?tab=bq&date=${fromYmd}${delegationFilter ? `&delegation=${delegationFilter}` : ""}`}
          autoPrint={autoPrint}
        />
      </div>

      {cellsRes.error ? (
        <div className="mx-auto w-[297mm] max-w-full rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive print:hidden">
          Failed to load cells: {cellsRes.error}
        </div>
      ) : null}

      {delegations.length === 0 ? (
        <div className="mx-auto w-[297mm] max-w-full rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground print:hidden">
          No delegations in scope.
        </div>
      ) : (
        delegations.map((d, i) => (
          <HeadCounterPrintSheet
            key={d.id}
            delegation={{
              id: d.id,
              region_code: d.region_code,
              region_name: d.region_name,
            }}
            dates={dates}
            cells={allCells.filter((c) => c.delegation_id === d.id)}
            isLast={i === delegations.length - 1}
          />
        ))
      )}

      <div className="mx-auto w-[297mm] max-w-full text-center text-[10pt] text-muted-foreground print:hidden">
        Event window {HEAD_COUNT_WINDOW_START} → {HEAD_COUNT_WINDOW_END}
      </div>

      <PrintStyles />
    </div>
  );
}

async function VenuePrint({
  fromYmd,
  toYmd,
  dates,
  siteFilter,
  autoPrint,
}: {
  fromYmd: string;
  toYmd: string;
  dates: string[];
  siteFilter: string | undefined;
  autoPrint: boolean;
}) {
  const sitesRes = await getSites(false);
  let sites = sitesRes.error ? [] : (sitesRes.data ?? []);
  sites = sites.filter((s) => s.site_type === "playing_venue");
  if (siteFilter) {
    sites = sites.filter((s) => s.id === siteFilter);
  }
  const siteIds = sites.map((s) => s.id);

  const cellsRes = await getHeadCounterVenueCellsForRange({
    fromYmd,
    toYmd,
    siteIds: siteIds.length > 0 ? siteIds : undefined,
  });
  const allCells = cellsRes.error ? [] : (cellsRes.data ?? []);

  return (
    <div className="space-y-4 print:space-y-0">
      <div className="mx-auto w-[297mm] max-w-full print:hidden">
        <PrintFormToolbar
          backHref={`/dashboard/personnel/head-counter?tab=venue&date=${fromYmd}${siteFilter ? `&site=${siteFilter}` : ""}`}
          autoPrint={autoPrint}
        />
      </div>

      {cellsRes.error ? (
        <div className="mx-auto w-[297mm] max-w-full rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive print:hidden">
          Failed to load cells: {cellsRes.error}
        </div>
      ) : null}

      {sites.length === 0 ? (
        <div className="mx-auto w-[297mm] max-w-full rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground print:hidden">
          No playing venues in scope.
        </div>
      ) : (
        sites.map((s, i) => (
          <HeadCounterVenuePrintSheet
            key={s.id}
            site={{ id: s.id, name: s.name }}
            dates={dates}
            cells={allCells.filter((c) => c.site_id === s.id)}
            isLast={i === sites.length - 1}
          />
        ))
      )}

      <div className="mx-auto w-[297mm] max-w-full text-center text-[10pt] text-muted-foreground print:hidden">
        Event window {HEAD_COUNT_WINDOW_START} → {HEAD_COUNT_WINDOW_END}
      </div>

      <PrintStyles />
    </div>
  );
}

function PrintStyles() {
  return (
    <style>{`
      @media print {
        @page { size: A4 landscape; margin: 8mm; }
        html, body { background: white !important; }
        .hc-print-sheet {
          width: auto !important;
          max-width: 281mm !important;
          padding: 0 !important;
          margin: 0 auto !important;
          box-sizing: border-box !important;
          break-inside: avoid;
          page-break-inside: avoid;
        }
        .hc-print-sheet table { break-inside: avoid; page-break-inside: avoid; }
      }
    `}</style>
  );
}
