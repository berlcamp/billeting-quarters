"use client";

import { useMemo } from "react";
import { ArrowDownToLine, ArrowUpFromLine, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/empty-state";
import {
  SUPPLY_MOVEMENT_TYPE_BADGE,
  SUPPLY_MOVEMENT_TYPE_LABELS,
  type SupplyMovementType,
} from "@/lib/labels";
import { formatManila } from "@/lib/timezone";
import { cn } from "@/lib/utils";
import type { Database } from "@/types/database";

type Movement = Database["palaro"]["Tables"]["supply_movements"]["Row"];
type Supply = Pick<
  Database["palaro"]["Tables"]["medical_supplies"]["Row"],
  "id" | "name" | "unit"
>;

interface Props {
  movements: Movement[];
  supplies: Supply[];
}

const ICONS = {
  stock_in: ArrowDownToLine,
  stock_out: ArrowUpFromLine,
  adjustment: Pencil,
  expired: Trash2,
} as const;

export function MovementsList({ movements, supplies }: Props) {
  const supplyMap = useMemo(() => {
    const m = new Map<string, Supply>();
    for (const s of supplies) m.set(s.id, s);
    return m;
  }, [supplies]);

  if (movements.length === 0) {
    return (
      <EmptyState
        title="No movements yet"
        description="Stock in/out activity shows up here as items move."
      />
    );
  }

  return (
    <ul className="divide-y rounded-md border">
      {movements.slice(0, 50).map((m) => {
        const type = m.movement_type as SupplyMovementType;
        const supply = supplyMap.get(m.supply_id);
        const Icon = ICONS[type] ?? Pencil;
        const sign = m.quantity >= 0 ? "+" : "";
        return (
          <li key={m.id} className="flex items-center gap-3 p-3 text-sm">
            <Icon className="size-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="font-medium">{supply?.name ?? "—"}</span>
                <Badge
                  variant="secondary"
                  className={cn(
                    "border-transparent",
                    SUPPLY_MOVEMENT_TYPE_BADGE[type],
                  )}
                >
                  {SUPPLY_MOVEMENT_TYPE_LABELS[type]}
                </Badge>
              </div>
              {m.reason ? (
                <div className="text-xs text-muted-foreground">{m.reason}</div>
              ) : null}
            </div>
            <div className="flex flex-col items-end">
              <span
                className={cn(
                  "font-mono text-sm font-semibold",
                  m.quantity >= 0 ? "text-green-700" : "text-red-700",
                )}
              >
                {sign}
                {m.quantity} {supply?.unit ?? ""}
              </span>
              <span className="font-mono text-xs text-muted-foreground">
                {formatManila(m.created_at, "MMM d · HH:mm")}
              </span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
