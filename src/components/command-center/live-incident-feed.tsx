"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { StatusBadge } from "@/components/shared/status-badge";
import { LiveBadge } from "@/components/shared/live-badge";
import { cn } from "@/lib/utils";
import {
  INCIDENT_CATEGORY_LABELS,
  type IncidentSeverity,
} from "@/lib/labels";
import type { Database } from "@/types/database";

type Incident = Database["palaro"]["Tables"]["incidents"]["Row"];

interface LiveIncidentFeedProps {
  incidents: Incident[];
  siteLookup: Map<string, string>;
  limit?: number;
}

const STRIPE: Record<IncidentSeverity, string> = {
  low: "bg-gray-300",
  medium: "bg-yellow-400",
  high: "bg-orange-500",
  critical: "bg-red-500",
};

export function LiveIncidentFeed({
  incidents,
  siteLookup,
  limit = 20,
}: LiveIncidentFeedProps) {
  const visible = [...incidents]
    .sort((a, b) => b.reported_at.localeCompare(a.reported_at))
    .slice(0, limit);

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">Live incident feed</CardTitle>
        <LiveBadge label="Live" />
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden p-0">
        {visible.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No incidents reported yet.
          </div>
        ) : (
          <ul className="divide-y max-h-[480px] overflow-y-auto">
            {visible.map((i) => (
              <li key={i.id}>
                <Link
                  href={`/dashboard/incidents/${i.id}`}
                  className="flex gap-3 px-4 py-3 hover:bg-accent/40 transition-colors"
                >
                  <span
                    className={cn("w-1 self-stretch rounded-full", STRIPE[i.severity])}
                    aria-hidden
                  />
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-sm font-medium line-clamp-1">
                        {i.title}
                      </span>
                      <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                        {formatDistanceToNow(new Date(i.reported_at), {
                          addSuffix: true,
                        })}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span className="font-mono text-[10px]">
                        {i.incident_number}
                      </span>
                      <span>·</span>
                      <span>{INCIDENT_CATEGORY_LABELS[i.category]}</span>
                      {i.site_id ? (
                        <>
                          <span>·</span>
                          <span className="line-clamp-1">
                            {siteLookup.get(i.site_id) ?? "—"}
                          </span>
                        </>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <StatusBadge variant="severity" status={i.severity} />
                      <StatusBadge variant="incident" status={i.status} />
                    </div>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
