import {
  HEAD_COUNT_DIRECTIONS,
  HEAD_COUNT_DIRECTION_LABELS,
  HEAD_COUNT_ROLES,
  type HeadCountDirection,
  type HeadCountRole,
} from "@/lib/schemas/head-counter";
import type { Database } from "@/types/database";

type HeadCounterCell =
  Database["palaro"]["Tables"]["head_counter_cells"]["Row"];

// Print-sheet row labels follow the source spreadsheet's vocabulary, not the
// internal enum labels. "Chaperons" (plural) and "TWG" (no "Delegation"
// prefix) keep visual parity with the existing Excel form.
const PRINT_ROLE_LABELS: Record<HeadCountRole, string> = {
  athlete: "Athlete",
  chaperon: "Chaperons",
  coach: "Coach",
  delegation_twg: "TWG",
  rd: "RD",
  ard: "ARD",
  sds: "SDS",
  asds: "ASDS",
};

interface Props {
  delegation: { id: string; region_code: string; region_name: string };
  dates: string[]; // YYYY-MM-DD, already filtered to the print window
  cells: HeadCounterCell[]; // already filtered to this delegation
  isLast?: boolean;
}

function cellKey(
  dateYmd: string,
  direction: HeadCountDirection,
  role: HeadCountRole,
): string {
  return `${dateYmd}:${direction}:${role}`;
}

function buildMap(cells: HeadCounterCell[]): Record<string, number> {
  const m: Record<string, number> = {};
  for (const c of cells) {
    if (c.role === "technical_officials") continue;
    m[cellKey(c.count_date, c.direction, c.role)] = c.count;
  }
  return m;
}

const SHORT_MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

// "2026-05-18" → "18-May"
function dayMon(ymd: string): string {
  const [, m, d] = ymd.split("-").map(Number);
  return `${d}-${SHORT_MONTHS[m - 1]}`;
}

export function HeadCounterPrintSheet({
  delegation,
  dates,
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
      <div className="mb-1 text-[11pt] font-bold tracking-wide">
        DELEGATION: {delegation.region_name}
      </div>

      <table className="w-full border-collapse text-[8.5pt]">
        <colgroup>
          <col className="w-[18mm]" />
        </colgroup>
        <thead>
          {/* Row 1 — IN / OUT band labels centered above their date columns
              (plus a trailing "Total" column per band for the all-dates sum). */}
          <tr>
            <th className="border border-black bg-white px-1 py-0.5" />
            {HEAD_COUNT_DIRECTIONS.map((dir) => (
              <th
                key={`band-${dir}`}
                colSpan={dates.length + 1}
                className="border border-black bg-white px-1 py-0.5 text-center font-bold"
              >
                {HEAD_COUNT_DIRECTION_LABELS[dir]}
              </th>
            ))}
          </tr>
          {/* Row 2 — date column headers per direction, then "Total". */}
          <tr>
            <th className="border border-black bg-white px-1 py-0.5" />
            {HEAD_COUNT_DIRECTIONS.flatMap((dir) => [
              ...dates.map((d) => (
                <th
                  key={`${dir}-${d}`}
                  className="border border-black bg-[#f5f5f5] px-0.5 py-0.5 text-center font-medium"
                >
                  {dayMon(d)}
                </th>
              )),
              <th
                key={`${dir}-total-h`}
                className="border border-black bg-[#e5e5e5] px-0.5 py-0.5 text-center font-bold"
              >
                Total
              </th>,
            ])}
          </tr>
        </thead>
        <tbody>
          {HEAD_COUNT_ROLES.map((role) => (
            <tr key={role}>
              <td className="border border-black px-1 py-0.5 text-left">
                {PRINT_ROLE_LABELS[role]}
              </td>
              {HEAD_COUNT_DIRECTIONS.flatMap((dir) => {
                const roleTotal = dates.reduce(
                  (acc, d) => acc + (map[cellKey(d, dir, role)] ?? 0),
                  0,
                );
                return [
                  ...dates.map((d) => {
                    const v = map[cellKey(d, dir, role)] ?? 0;
                    return (
                      <td
                        key={`${dir}-${d}-${role}`}
                        className="border border-black px-0.5 py-0.5 text-right tabular-nums"
                      >
                        {v || ""}
                      </td>
                    );
                  }),
                  <td
                    key={`${dir}-total-${role}`}
                    className="border border-black bg-[#f5f5f5] px-0.5 py-0.5 text-right font-semibold tabular-nums"
                  >
                    {roleTotal || ""}
                  </td>,
                ];
              })}
            </tr>
          ))}
          {/* Bottom TOTAL row — per-date sum across roles, plus the overall
              all-dates × all-roles total in the rightmost cell of each band. */}
          <tr className="font-bold">
            <td className="border border-black bg-[#e5e5e5] px-1 py-0.5 text-left">
              TOTAL
            </td>
            {HEAD_COUNT_DIRECTIONS.flatMap((dir) => {
              const overall = dates.reduce(
                (acc, d) =>
                  acc +
                  HEAD_COUNT_ROLES.reduce(
                    (a, r) => a + (map[cellKey(d, dir, r)] ?? 0),
                    0,
                  ),
                0,
              );
              return [
                ...dates.map((d) => {
                  const v = HEAD_COUNT_ROLES.reduce(
                    (acc, r) => acc + (map[cellKey(d, dir, r)] ?? 0),
                    0,
                  );
                  return (
                    <td
                      key={`total-${dir}-${d}`}
                      className="border border-black bg-[#f5f5f5] px-0.5 py-0.5 text-right tabular-nums"
                    >
                      {v || ""}
                    </td>
                  );
                }),
                <td
                  key={`total-${dir}-overall`}
                  className="border border-black bg-[#d9d9d9] px-0.5 py-0.5 text-right tabular-nums"
                >
                  {overall || ""}
                </td>,
              ];
            })}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
