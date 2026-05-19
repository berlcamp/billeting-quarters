import { Card, CardContent } from "@/components/ui/card";
import {
  HEAD_COUNT_DIRECTIONS,
  HEAD_COUNT_DIRECTION_LABELS,
  HEAD_COUNT_ROLES,
  HEAD_COUNT_ROLE_LABELS,
  type HeadCountDirection,
  type HeadCountRole,
} from "@/lib/schemas/head-counter";
import { manilaDateLabel } from "@/lib/timezone";
import type { Database } from "@/types/database";

type HeadCounterCell =
  Database["palaro"]["Tables"]["head_counter_cells"]["Row"];

interface DelegationOption {
  id: string;
  region_code: string;
  region_name: string;
}

interface Props {
  dateYmd: string;
  delegations: DelegationOption[];
  cells: HeadCounterCell[];
}

type RoleTotals = Record<HeadCountRole, number>;
type DirectionTotals = Record<HeadCountDirection, RoleTotals>;

function emptyRoleTotals(): RoleTotals {
  const r: Partial<RoleTotals> = {};
  for (const role of HEAD_COUNT_ROLES) r[role] = 0;
  return r as RoleTotals;
}

function emptyDirectionTotals(): DirectionTotals {
  return { in: emptyRoleTotals(), out: emptyRoleTotals() };
}

function totalsByDelegation(
  cells: HeadCounterCell[],
): Map<string, DirectionTotals> {
  const map = new Map<string, DirectionTotals>();
  for (const c of cells) {
    if (c.role === "technical_officials") continue;
    let bucket = map.get(c.delegation_id);
    if (!bucket) {
      bucket = emptyDirectionTotals();
      map.set(c.delegation_id, bucket);
    }
    bucket[c.direction][c.role] += c.count;
  }
  return map;
}

function sumRole(totals: RoleTotals): number {
  return HEAD_COUNT_ROLES.reduce((acc, r) => acc + totals[r], 0);
}

export function HeadCounterConsolidated({
  dateYmd,
  delegations,
  cells,
}: Props) {
  const perDelegation = totalsByDelegation(cells);

  // Grand totals across all delegations.
  const grand: DirectionTotals = emptyDirectionTotals();
  for (const [, t] of perDelegation) {
    for (const dir of HEAD_COUNT_DIRECTIONS) {
      for (const role of HEAD_COUNT_ROLES) {
        grand[dir][role] += t[dir][role];
      }
    }
  }
  const grandIn = sumRole(grand.in);
  const grandOut = sumRole(grand.out);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SummaryCard label="Total IN" value={grandIn} />
        <SummaryCard label="Total OUT" value={grandOut} />
        <SummaryCard label="Net (IN − OUT)" value={grandIn - grandOut} />
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-muted/60">
              <th rowSpan={2} className="border px-2 py-1 text-left">
                Delegation
              </th>
              <th
                colSpan={HEAD_COUNT_ROLES.length + 1}
                className="border px-2 py-1 text-center text-emerald-700 dark:text-emerald-300"
              >
                IN
              </th>
              <th
                colSpan={HEAD_COUNT_ROLES.length + 1}
                className="border px-2 py-1 text-center text-blue-700 dark:text-blue-300"
              >
                OUT
              </th>
              <th rowSpan={2} className="border px-2 py-1 text-right">
                Net
              </th>
            </tr>
            <tr className="bg-muted/40">
              {HEAD_COUNT_DIRECTIONS.map((dir) => (
                <DirectionHeaderCells key={dir} direction={dir} />
              ))}
            </tr>
          </thead>
          <tbody>
            {delegations.map((d) => {
              const totals = perDelegation.get(d.id) ?? emptyDirectionTotals();
              const ins = sumRole(totals.in);
              const outs = sumRole(totals.out);
              const hasAny = ins + outs > 0;
              return (
                <tr key={d.id} className={hasAny ? "" : "text-muted-foreground"}>
                  <td className="border px-2 py-0.5 text-left">
                    <div className="font-mono text-[11px]">{d.region_code}</div>
                    <div className="text-[10px] text-muted-foreground">
                      {d.region_name}
                    </div>
                  </td>
                  {HEAD_COUNT_DIRECTIONS.map((dir) => (
                    <DirectionDataCells
                      key={dir}
                      totals={totals[dir]}
                      total={dir === "in" ? ins : outs}
                    />
                  ))}
                  <td className="border px-2 py-0.5 text-right font-medium tabular-nums">
                    {ins - outs}
                  </td>
                </tr>
              );
            })}
            <tr className="bg-muted/60 font-semibold">
              <td className="border px-2 py-0.5 text-left">Grand totals</td>
              {HEAD_COUNT_DIRECTIONS.map((dir) => (
                <DirectionDataCells
                  key={dir}
                  totals={grand[dir]}
                  total={dir === "in" ? grandIn : grandOut}
                />
              ))}
              <td className="border px-2 py-0.5 text-right tabular-nums">
                {grandIn - grandOut}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        Consolidated for {manilaDateLabel(dateYmd)}. Read-only.
      </p>
    </div>
  );
}

function DirectionHeaderCells({ direction }: { direction: HeadCountDirection }) {
  return (
    <>
      {HEAD_COUNT_ROLES.map((role) => (
        <th
          key={`${direction}-${role}`}
          className="border px-1 py-0.5 text-center font-medium"
          title={`${HEAD_COUNT_DIRECTION_LABELS[direction]} · ${HEAD_COUNT_ROLE_LABELS[role]}`}
        >
          {HEAD_COUNT_ROLE_LABELS[role]}
        </th>
      ))}
      <th className="border px-1 py-0.5 text-right font-semibold">Σ</th>
    </>
  );
}

function DirectionDataCells({
  totals,
  total,
}: {
  totals: RoleTotals;
  total: number;
}) {
  return (
    <>
      {HEAD_COUNT_ROLES.map((role) => (
        <td
          key={role}
          className="border px-1 py-0.5 text-right tabular-nums"
        >
          {totals[role] || ""}
        </td>
      ))}
      <td className="border px-1 py-0.5 text-right font-medium tabular-nums">
        {total || ""}
      </td>
    </>
  );
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </div>
        <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
      </CardContent>
    </Card>
  );
}
