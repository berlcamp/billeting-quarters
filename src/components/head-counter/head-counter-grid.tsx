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

type CellKey = `${HeadCountDirection}:${HeadCountRole}`;
type CellMap = Record<CellKey, number>;

function cellKey(direction: HeadCountDirection, role: HeadCountRole): CellKey {
  return `${direction}:${role}`;
}

function buildInitial(cells: HeadCounterCell[]): CellMap {
  const map: CellMap = {} as CellMap;
  for (const c of cells) {
    // Skip values from the venue-only bucket — they can't appear in BQ data,
    // but the DB enum is shared so TS keeps the wider union here.
    if (c.role === "technical_officials") continue;
    map[cellKey(c.direction, c.role)] = c.count;
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
    role: HeadCountRole,
    raw: string,
  ) {
    if (readOnly) return;
    const key = cellKey(direction, role);
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

  function getCell(direction: HeadCountDirection, role: HeadCountRole): number {
    return values[cellKey(direction, role)] ?? 0;
  }

  const totals = useMemo(() => {
    const out: Record<HeadCountDirection, number> = { in: 0, out: 0 };
    for (const dir of HEAD_COUNT_DIRECTIONS) {
      for (const role of HEAD_COUNT_ROLES) {
        out[dir] += getCell(dir, role);
      }
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [values]);

  async function handleSave() {
    if (readOnly) return;
    setSubmitting(true);

    const changedCells: {
      direction: HeadCountDirection;
      role: HeadCountRole;
      count: number;
    }[] = [];
    for (const dir of HEAD_COUNT_DIRECTIONS) {
      for (const role of HEAD_COUNT_ROLES) {
        const key = cellKey(dir, role);
        const curr = values[key] ?? 0;
        const prev = originalValues[key] ?? 0;
        if (curr !== prev) {
          changedCells.push({ direction: dir, role, count: curr });
        }
      }
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
    toast.success(`Saved ${changedCells.length} row(s)`);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SummaryCard label="Total IN" value={totals.in} />
        <SummaryCard label="Total OUT" value={totals.out} />
        <SummaryCard label="Net (IN − OUT)" value={totals.in - totals.out} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {HEAD_COUNT_DIRECTIONS.map((dir) => (
          <SectionTable
            key={dir}
            direction={dir}
            getCell={getCell}
            setCell={setCell}
            total={totals[dir]}
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
  total,
  readOnly,
}: {
  direction: HeadCountDirection;
  getCell: (direction: HeadCountDirection, role: HeadCountRole) => number;
  setCell: (
    direction: HeadCountDirection,
    role: HeadCountRole,
    raw: string,
  ) => void;
  total: number;
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
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-muted/50">
            <th className="border px-2 py-1.5 text-left font-medium">Type</th>
            <th className="border px-2 py-1.5 text-right font-medium">Count</th>
          </tr>
        </thead>
        <tbody>
          {HEAD_COUNT_ROLES.map((role) => {
            const v = getCell(direction, role);
            return (
              <tr key={role}>
                <td className="border px-2 py-1 text-left">
                  {HEAD_COUNT_ROLE_LABELS[role]}
                </td>
                <td className="border p-0">
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={99999}
                    value={v === 0 ? "" : v}
                    onChange={(e) => setCell(direction, role, e.target.value)}
                    disabled={readOnly}
                    className="h-8 w-full bg-transparent px-2 text-right tabular-nums outline-none focus:bg-background focus:ring-1 focus:ring-ring disabled:opacity-60"
                  />
                </td>
              </tr>
            );
          })}
          <tr className="bg-muted/60 font-semibold">
            <td className="border px-2 py-1 text-left">Total</td>
            <td className="border px-2 py-1 text-right tabular-nums">
              {total || ""}
            </td>
          </tr>
        </tbody>
      </table>
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
