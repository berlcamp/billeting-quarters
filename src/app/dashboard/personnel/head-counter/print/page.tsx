import { Forbidden } from "@/components/shared/forbidden";
import { PrintFormToolbar } from "@/components/medical/print-form-toolbar";
import { HeadCounterPrintSheet } from "@/components/head-counter/head-counter-print-sheet";
import { getCurrentProfile } from "@/lib/auth/session";
import { hasPermission } from "@/lib/permissions";
import { getDelegations } from "@/lib/actions/delegations";
import { getHeadCounterCellsForRange } from "@/lib/actions/head-counter";
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
    auto?: string;
  }>;
}

export default async function HeadCounterPrintPage({ searchParams }: PageProps) {
  const profile = await getCurrentProfile();
  if (!profile || !hasPermission(profile, "head_count.view_all")) {
    return (
      <Forbidden message="Printing the consolidated report requires head_count.view_all." />
    );
  }

  const sp = await searchParams;
  const autoPrint = sp.auto !== "0";

  const fromYmd =
    (sp.from && isInHeadCountWindow(sp.from) && sp.from) ||
    (sp.date && isInHeadCountWindow(sp.date) && sp.date) ||
    HEAD_COUNT_WINDOW_START;
  const toYmd =
    (sp.to && isInHeadCountWindow(sp.to) && sp.to) ||
    (sp.date && isInHeadCountWindow(sp.date) && sp.date) ||
    fromYmd;

  const delegationsRes = await getDelegations(false);
  let delegations = delegationsRes.error ? [] : (delegationsRes.data ?? []);
  if (sp.delegation) {
    delegations = delegations.filter((d) => d.id === sp.delegation);
  }
  const delegationIds = delegations.map((d) => d.id);

  const cellsRes = await getHeadCounterCellsForRange({
    fromYmd,
    toYmd,
    delegationIds: delegationIds.length > 0 ? delegationIds : undefined,
  });
  const allCells = cellsRes.error ? [] : (cellsRes.data ?? []);

  const dates = dateRangeManilaYmd(fromYmd, toYmd);

  // (date, delegation) pairs in chronological-then-region order.
  const pairs: { date: string; delegation: (typeof delegations)[number] }[] = [];
  for (const date of dates) {
    for (const d of delegations) {
      pairs.push({ date, delegation: d });
    }
  }

  return (
    <div className="space-y-4 print:space-y-0">
      <div className="mx-auto w-[297mm] max-w-full print:hidden">
        <PrintFormToolbar
          backHref={`/dashboard/personnel/head-counter?date=${fromYmd}${sp.delegation ? `&delegation=${sp.delegation}` : ""}`}
          autoPrint={autoPrint}
        />
      </div>

      {cellsRes.error ? (
        <div className="mx-auto w-[297mm] max-w-full rounded-md border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive print:hidden">
          Failed to load cells: {cellsRes.error}
        </div>
      ) : null}

      {pairs.length === 0 ? (
        <div className="mx-auto w-[297mm] max-w-full rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground print:hidden">
          No (date, delegation) pairs in range {fromYmd} → {toYmd}.
        </div>
      ) : (
        pairs.map((p, i) => (
          <HeadCounterPrintSheet
            key={`${p.date}:${p.delegation.id}`}
            dateYmd={p.date}
            delegation={{
              id: p.delegation.id,
              region_code: p.delegation.region_code,
              region_name: p.delegation.region_name,
            }}
            cells={allCells.filter(
              (c) =>
                c.count_date === p.date && c.delegation_id === p.delegation.id,
            )}
            isLast={i === pairs.length - 1}
          />
        ))
      )}

      <div className="mx-auto w-[297mm] max-w-full text-center text-[10pt] text-muted-foreground print:hidden">
        Event window {HEAD_COUNT_WINDOW_START} → {HEAD_COUNT_WINDOW_END}
      </div>

      {/* Print rules: A4 landscape (so the IN/OUT tables sit comfortably
          side-by-side), strip app chrome, fit each sheet inside the @page
          margins. A4 landscape usable width = 297mm − 2 × 8mm = 281mm. */}
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
    </div>
  );
}
