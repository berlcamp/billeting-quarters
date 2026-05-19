"use client";

import Link from "next/link";
import {
  AlertTriangle,
  Crown,
  MessageSquareWarning,
  Pill,
  Trash2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  INCIDENT_CATEGORIES,
  INCIDENT_CATEGORY_LABELS,
  type IncidentCategory,
} from "@/lib/labels";
import { cn } from "@/lib/utils";

const CATEGORY_ICON: Record<
  IncidentCategory,
  React.ComponentType<{ className?: string }>
> = {
  medical: Pill,
  utility: AlertTriangle,
  vip_status: Crown,
  security: AlertTriangle,
  facility: Trash2,
  other: MessageSquareWarning,
};

interface Props {
  byCategory: Record<IncidentCategory, number>;
  canOpen?: boolean;
}

export function IncidentsByCategoryCard({ byCategory, canOpen = true }: Props) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Incidents by category</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {INCIDENT_CATEGORIES.map((c) => {
            const Icon = CATEGORY_ICON[c];
            const count = byCategory[c] ?? 0;
            const cardClass = cn(
              "rounded-md border p-3",
              canOpen && "transition hover:bg-muted/40",
              count > 0 && "border-foreground/30",
            );
            const inner = (
              <>
                <div className="flex items-center justify-between">
                  <Icon className="size-4 text-muted-foreground" />
                  <span className="text-2xl font-bold tabular-nums">
                    {count}
                  </span>
                </div>
                <div className="mt-1 text-xs font-medium">
                  {INCIDENT_CATEGORY_LABELS[c]}
                </div>
              </>
            );
            return canOpen ? (
              <Link
                key={c}
                href={`/dashboard/incidents?category=${c}`}
                className={cardClass}
              >
                {inner}
              </Link>
            ) : (
              <div key={c} className={cardClass}>
                {inner}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
