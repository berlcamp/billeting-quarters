import {
  HEAD_COUNT_DIRECTIONS,
  HEAD_COUNT_DIRECTION_LABELS,
  HEAD_COUNT_ROLES,
  HEAD_COUNT_ROLE_LABELS,
  HEAD_COUNT_ROW_LABELS,
  type HeadCountDirection,
  type HeadCountRole,
} from "@/lib/schemas/head-counter";
import { manilaDateLabel } from "@/lib/timezone";
import type { Database } from "@/types/database";

type HeadCounterCell =
  Database["palaro"]["Tables"]["head_counter_cells"]["Row"];

interface Props {
  dateYmd: string;
  delegation: { id: string; region_code: string; region_name: string };
  cells: HeadCounterCell[];
  isLast?: boolean;
}

type CellMap = Record<string, number>;

function buildMap(cells: HeadCounterCell[]): CellMap {
  const m: CellMap = {};
  for (const c of cells) {
    m[`${c.direction}:${c.row_index}:${c.role}`] = c.count;
  }
  return m;
}

function cellValue(
  m: CellMap,
  direction: HeadCountDirection,
  rowIndex: number,
  role: HeadCountRole,
): number {
  return m[`${direction}:${rowIndex}:${role}`] ?? 0;
}

export function HeadCounterPrintSheet({
  dateYmd,
  delegation,
  cells,
  isLast = false,
}: Props) {
  const map = buildMap(cells);

  return (
    <div
      className="hc-print-sheet mx-auto w-[297mm] bg-white p-[8mm] text-black [font-family:'Times_New_Roman',Times,serif]"
      style={{
        printColorAdjust: "exact",
        WebkitPrintColorAdjust: "exact",
        breakAfter: isLast ? "auto" : "page",
        pageBreakAfter: isLast ? "auto" : "always",
      }}
    >
      <div className="text-center">
        <div className="text-[14pt] font-bold tracking-wide">
          PALARO 2026 — DAILY HEAD COUNT
        </div>
        <div className="mt-0.5 text-[11pt] font-semibold">
          {delegation.region_code} — {delegation.region_name}
        </div>
        <div className="text-[10pt]">{manilaDateLabel(dateYmd)}</div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 print:grid-cols-2">
        {HEAD_COUNT_DIRECTIONS.map((dir) => (
          <SectionTable key={dir} direction={dir} map={map} />
        ))}
      </div>

      <div className="mt-6 grid grid-cols-2 gap-8 text-[10pt] print:grid-cols-2">
        <SignatureLine label="Encoded by" />
        <SignatureLine label="Verified by" />
      </div>
    </div>
  );
}

function SectionTable({
  direction,
  map,
}: {
  direction: HeadCountDirection;
  map: CellMap;
}) {
  // Per-row, per-col, and grand totals.
  const rowTotals = HEAD_COUNT_ROW_LABELS.map((_, rowIdx) =>
    HEAD_COUNT_ROLES.reduce(
      (acc, role) => acc + cellValue(map, direction, rowIdx, role),
      0,
    ),
  );
  const colTotals: Record<HeadCountRole, number> = {} as Record<
    HeadCountRole,
    number
  >;
  for (const role of HEAD_COUNT_ROLES) {
    colTotals[role] = HEAD_COUNT_ROW_LABELS.reduce(
      (acc, _, rowIdx) => acc + cellValue(map, direction, rowIdx, role),
      0,
    );
  }
  const grand = rowTotals.reduce((a, b) => a + b, 0);

  return (
    <div className="border border-black">
      <div className="border-b border-black bg-[#eee] px-1 py-0.5 text-center text-[10pt] font-bold">
        {HEAD_COUNT_DIRECTION_LABELS[direction]}
      </div>
      <table className="w-full border-collapse text-[8.5pt]">
        <thead>
          <tr className="bg-[#f5f5f5]">
            <th className="border border-black px-1 py-0.5 text-left">Row</th>
            {HEAD_COUNT_ROLES.map((role) => (
              <th
                key={role}
                className="border border-black px-0.5 py-0.5 text-center"
              >
                {HEAD_COUNT_ROLE_LABELS[role]}
              </th>
            ))}
            <th className="border border-black px-0.5 py-0.5 text-right">Σ</th>
          </tr>
        </thead>
        <tbody>
          {HEAD_COUNT_ROW_LABELS.map((label, rowIdx) => (
            <tr key={label} className={rowIdx === 0 ? "bg-[#f5f5f5]" : ""}>
              <td className="border border-black px-1 py-0.5 text-left">
                {label}
              </td>
              {HEAD_COUNT_ROLES.map((role) => {
                const v = cellValue(map, direction, rowIdx, role);
                return (
                  <td
                    key={role}
                    className="border border-black px-0.5 py-0.5 text-right tabular-nums"
                  >
                    {v || ""}
                  </td>
                );
              })}
              <td className="border border-black px-0.5 py-0.5 text-right font-semibold tabular-nums">
                {rowTotals[rowIdx] || ""}
              </td>
            </tr>
          ))}
          <tr className="bg-[#eee] font-bold">
            <td className="border border-black px-1 py-0.5 text-left">
              Total
            </td>
            {HEAD_COUNT_ROLES.map((role) => (
              <td
                key={role}
                className="border border-black px-0.5 py-0.5 text-right tabular-nums"
              >
                {colTotals[role] || ""}
              </td>
            ))}
            <td className="border border-black px-0.5 py-0.5 text-right tabular-nums">
              {grand || ""}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function SignatureLine({ label }: { label: string }) {
  return (
    <div>
      <div className="border-b border-black pb-6" />
      <div className="mt-1 text-[8.5pt] uppercase tracking-wider text-[#444]">
        {label}
      </div>
    </div>
  );
}
