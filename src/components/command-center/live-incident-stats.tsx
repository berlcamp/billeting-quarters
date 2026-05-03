"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LiveBadge } from "@/components/shared/live-badge";
import { useRealtimeIncidents } from "@/lib/hooks/use-realtime-incidents";
import { cn } from "@/lib/utils";
import type { Database } from "@/types/database";

type Incident = Database["palaro"]["Tables"]["incidents"]["Row"];

interface LiveIncidentStatsProps {
  initial: Incident[];
}

export function LiveIncidentStats({ initial }: LiveIncidentStatsProps) {
  useRealtimeIncidents();
  const incidents = initial;

  const open = incidents.filter(
    (i) => i.status === "open" || i.status === "in_progress",
  ).length;
  const critical = incidents.filter(
    (i) =>
      i.severity === "critical" &&
      i.status !== "resolved" &&
      i.status !== "closed",
  ).length;
  const referred = incidents.filter((i) => i.status === "referred").length;
  const resolvedToday = incidents.filter((i) => {
    if (!i.resolved_at) return false;
    const resolved = new Date(i.resolved_at);
    const now = new Date();
    return (
      resolved.getFullYear() === now.getFullYear() &&
      resolved.getMonth() === now.getMonth() &&
      resolved.getDate() === now.getDate()
    );
  }).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-muted-foreground">
          Live operational state
        </h2>
        <LiveBadge label="Live" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Open incidents" value={open} />
        <StatCard
          label="Critical (active)"
          value={critical}
          accent={critical > 0 ? "critical" : undefined}
        />
        <StatCard label="In medical referral" value={referred} />
        <StatCard label="Resolved today" value={resolvedToday} />
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: "critical";
}) {
  return (
    <Card className={cn(accent === "critical" && "border-destructive/50")}>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div
          className={cn(
            "text-3xl font-bold tabular-nums",
            accent === "critical" && value > 0 && "text-destructive animate-pulse",
          )}
        >
          {value}
        </div>
      </CardContent>
    </Card>
  );
}
