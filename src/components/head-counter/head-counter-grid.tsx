"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { saveHeadCounter } from "@/lib/actions/head-counter";
import {
  HEAD_COUNT_DIRECTIONS,
  HEAD_COUNT_DIRECTION_LABELS,
  HEAD_COUNT_ROLES,
  HEAD_COUNT_ROLE_LABELS,
  HEAD_COUNT_ROW_LABELS,
  type HeadCountDirection,
  type HeadCountRole,
} from "@/lib/schemas/head-counter";
import { cn } from "@/lib/utils";
import type { Database } from "@/types/database";

type HeadCounterCell =
  Database["palaro"]["Tables"]["head_counter_cells"]["Row"];

interface Props {
  delegationId: string;
  delegationLabel: string;
  dateYmd: string;
  initialCells: HeadCounterCell[];
  readOnly?: boolean;
}

type CellKey = `${HeadCountDirection}:${number}:${HeadCountRole}`;
type CellMap = Record<CellKey, number>;

function cellKey(
  direction: HeadCountDirection,
  rowIndex: number,
  role: HeadCountRole,
): CellKey {
  return `${direction}:${rowIndex}:${role}`;
}

function buildInitial(cells: HeadCounterCell[]): CellMap {
  const map: CellMap = {} as CellMap;
  for (const c of cells) {
    map[cellKey(c.direction, c.row_index, c.role)] = c.count;
  }
  return map;
}

export function HeadCounterGrid({
  delegationId,
  delegationLabel,
  dateYmd,
  initialCells,
  readOnly = false,
}: Props) {
  const router = useRouter();
  const [values, setValues] = useState<CellMap>(() =>
    buildInitial(initialCells),
  );
  const [originalValues] = useState<CellMap>(() =>
    buildInitial(initialCells),
  );
  const [submitting, setSubmitting] = useState(false);

  function setCell(
    direction: HeadCountDirection,
    rowIndex: number,
    role: HeadCountRole,
    raw: string,
  ) {
    if (readOnly) return;
    const key = cellKey(direction, rowIndex, role);
    if (raw === "") {
      setValues((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      return;
    }
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) return;
    const clamped = Math.min(Math.floor(n), 99999);
    setValues((prev) => ({ ...prev, [key]: clamped }));
  }

  function getCell(
    direction: HeadCountDirection,
    rowIndex: number,
    role: HeadCountRole,
  ): number {
    return values[cellKey(direction, rowIndex, role)] ?? 0;
  }

  // Live totals per direction.
  const totals = useMemo(() => {
    const out: Record<
      HeadCountDirection,
      {
        rowTotals: number[];
        colTotals: Record<HeadCountRole, number>;
        grand: number;
      }
    > = {
      in: {
        rowTotals: HEAD_COUNT_ROW_LABELS.map(() => 0),
        colTotals: {} as Record<HeadCountRole, number>,
        grand: 0,
      },
      out: {
        rowTotals: HEAD_COUNT_ROW_LABELS.map(() => 0),
        colTotals: {} as Record<HeadCountRole, number>,
        grand: 0,
      },
    };
    for (const dir of HEAD_COUNT_DIRECTIONS) {
      for (const role of HEAD_COUNT_ROLES) out[dir].colTotals[role] = 0;
      HEAD_COUNT_ROW_LABELS.forEach((_, rowIdx) => {
        for (const role of HEAD_COUNT_ROLES) {
          const v = getCell(dir, rowIdx, role);
          out[dir].rowTotals[rowIdx] += v;
          out[dir].colTotals[role] += v;
          out[dir].grand += v;
        }
      });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values]);

  async function handleSave() {
    if (readOnly) return;
    setSubmitting(true);

    // Build the diff: every (dir, row, role) where current vs original differs.
    const changedCells: {
      direction: HeadCountDirection;
      row_index: number;
      role: HeadCountRole;
      count: number;
    }[] = [];
    for (const dir of HEAD_COUNT_DIRECTIONS) {
      HEAD_COUNT_ROW_LABELS.forEach((_, rowIdx) => {
        for (const role of HEAD_COUNT_ROLES) {
          const key = cellKey(dir, rowIdx, role);
          const curr = values[key] ?? 0;
          const prev = originalValues[key] ?? 0;
          if (curr !== prev) {
            changedCells.push({
              direction: dir,
              row_index: rowIdx,
              role,
              count: curr,
            });
          }
        }
      });
    }

    if (changedCells.length === 0) {
      setSubmitting(false);
      toast.info("No changes to save");
      return;
    }

    const result = await saveHeadCounter({
      delegation_id: delegationId,
      count_date: dateYmd,
      cells: changedCells,
    });
    setSubmitting(false);

    if (result.error) {
      toast.error("Save failed", { description: result.error });
      return;
    }
    toast.success(`Saved ${changedCells.length} cell(s)`);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SummaryCard label="Total IN" value={totals.in.grand} />
        <SummaryCard label="Total OUT" value={totals.out.grand} />
        <SummaryCard
          label="Net (IN − OUT)"
          value={totals.in.grand - totals.out.grand}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {HEAD_COUNT_DIRECTIONS.map((dir) => (
          <SectionTable
            key={dir}
            direction={dir}
            getCell={getCell}
            setCell={setCell}
            rowTotals={totals[dir].rowTotals}
            colTotals={totals[dir].colTotals}
            grand={totals[dir].grand}
            readOnly={readOnly}
          />
        ))}
      </div>

      {!readOnly ? (
        <div className="flex items-center justify-between border-t pt-3">
          <div className="text-xs text-muted-foreground">
            {delegationLabel} · {dateYmd}
          </div>
          <Button onClick={handleSave} disabled={submitting}>
            {submitting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            Save
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function SectionTable({
  direction,
  getCell,
  setCell,
  rowTotals,
  colTotals,
  grand,
  readOnly,
}: {
  direction: HeadCountDirection;
  getCell: (
    direction: HeadCountDirection,
    rowIndex: number,
    role: HeadCountRole,
  ) => number;
  setCell: (
    direction: HeadCountDirection,
    rowIndex: number,
    role: HeadCountRole,
    raw: string,
  ) => void;
  rowTotals: number[];
  colTotals: Record<HeadCountRole, number>;
  grand: number;
  readOnly: boolean;
}) {
  const tone =
    direction === "in"
      ? "border-emerald-600/40 bg-emerald-500/5"
      : "border-blue-600/40 bg-blue-500/5";
  return (
    <div className={cn("overflow-hidden rounded-lg border", tone)}>
      <div className="border-b bg-background px-3 py-1.5 text-sm font-semibold uppercase tracking-wider">
        {HEAD_COUNT_DIRECTION_LABELS[direction]}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-muted/50">
              <th className="border px-1.5 py-1 text-left">Row</th>
              {HEAD_COUNT_ROLES.map((r) => (
                <th key={r} className="border px-1 py-1 text-center font-medium">
                  {HEAD_COUNT_ROLE_LABELS[r]}
                </th>
              ))}
              <th className="border px-1 py-1 text-center font-semibold">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {HEAD_COUNT_ROW_LABELS.map((label, rowIdx) => {
              const isDelegationRow = rowIdx === 0;
              return (
                <tr
                  key={label}
                  className={cn(isDelegationRow && "bg-muted/30 font-medium")}
                >
                  <td className="border px-1.5 py-0.5 text-left">{label}</td>
                  {HEAD_COUNT_ROLES.map((role) => {
                    const v = getCell(direction, rowIdx, role);
                    return (
                      <td key={role} className="border p-0">
                        <input
                          type="number"
                          inputMode="numeric"
                          min={0}
                          max={99999}
                          value={v === 0 ? "" : v}
                          onChange={(e) =>
                            setCell(direction, rowIdx, role, e.target.value)
                          }
                          disabled={readOnly}
                          className="h-7 w-full bg-transparent px-1 text-right tabular-nums outline-none focus:bg-background focus:ring-1 focus:ring-ring disabled:opacity-60"
                        />
                      </td>
                    );
                  })}
                  <td className="border px-1 py-0.5 text-right font-medium tabular-nums">
                    {rowTotals[rowIdx] || ""}
                  </td>
                </tr>
              );
            })}
            <tr className="bg-muted/60 font-semibold">
              <td className="border px-1.5 py-0.5 text-left">Total</td>
              {HEAD_COUNT_ROLES.map((role) => (
                <td
                  key={role}
                  className="border px-1 py-0.5 text-right tabular-nums"
                >
                  {colTotals[role] || ""}
                </td>
              ))}
              <td className="border px-1 py-0.5 text-right tabular-nums">
                {grand || ""}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
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
