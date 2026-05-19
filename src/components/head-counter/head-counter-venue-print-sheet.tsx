import {
  HEAD_COUNT_DIRECTIONS,
  HEAD_COUNT_DIRECTION_LABELS,
  HEAD_COUNT_VENUE_ROLES,
  HEAD_COUNT_VENUE_ROLE_LABELS,
  type HeadCountDirection,
  type HeadCountVenueRole,
} from "@/lib/schemas/head-counter";
import type { Database } from "@/types/database";

type HeadCounterVenueCell =
  Database["palaro"]["Tables"]["head_counter_venue_cells"]["Row"];

interface Props {
  site: { id: string; name: string };
  dates: string[];
  cells: HeadCounterVenueCell[];
  isLast?: boolean;
}

function cellKey(
  dateYmd: string,
  direction: HeadCountDirection,
  role: HeadCountVenueRole,
): string {
  return `${dateYmd}:${direction}:${role}`;
}

function buildMap(cells: HeadCounterVenueCell[]): Record<string, number> {
  const m: Record<string, number> = {};
  for (const c of cells) {
    if (c.role !== "technical_officials") continue;
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

function dayMon(ymd: string): string {
  const [, m, d] = ymd.split("-").map(Number);
  return `${d}-${SHORT_MONTHS[m - 1]}`;
}

export function HeadCounterVenuePrintSheet({
  site,
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
        PLAYING VENUE: {site.name}
      </div>

      <table className="w-full border-collapse text-[8.5pt]">
        <colgroup>
          <col className="w-[18mm]" />
        </colgroup>
        <thead>
          <tr>
            <th className="border border-black bg-white px-1 py-0.5" />
            {HEAD_COUNT_DIRECTIONS.map((dir) => (
              <th
                key={`band-${dir}`}
                colSpan={dates.length}
                className="border border-black bg-white px-1 py-0.5 text-center font-bold"
              >
                {HEAD_COUNT_DIRECTION_LABELS[dir]}
              </th>
            ))}
          </tr>
          <tr>
            <th className="border border-black bg-white px-1 py-0.5" />
            {HEAD_COUNT_DIRECTIONS.flatMap((dir) =>
              dates.map((d) => (
                <th
                  key={`${dir}-${d}`}
                  className="border border-black bg-[#f5f5f5] px-0.5 py-0.5 text-center font-medium"
                >
                  {dayMon(d)}
                </th>
              )),
            )}
          </tr>
        </thead>
        <tbody>
          {HEAD_COUNT_VENUE_ROLES.map((role) => (
            <tr key={role}>
              <td className="border border-black px-1 py-0.5 text-left">
                {HEAD_COUNT_VENUE_ROLE_LABELS[role]}
              </td>
              {HEAD_COUNT_DIRECTIONS.flatMap((dir) =>
                dates.map((d) => {
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
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
