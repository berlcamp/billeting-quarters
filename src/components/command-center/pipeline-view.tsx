"use client";

import { ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  INCIDENT_STATUS_LABELS,
  type IncidentStatus,
} from "@/lib/labels";
import type { Database } from "@/types/database";

type Incident = Database["palaro"]["Tables"]["incidents"]["Row"];

interface PipelineViewProps {
  incidents: Incident[];
}

const STAGES: IncidentStatus[] = [
  "open",
  "in_progress",
  "referred",
  "resolved",
  "closed",
];

const STAGE_ACCENT: Record<IncidentStatus, string> = {
  open: "text-yellow-700 dark:text-yellow-300",
  in_progress: "text-blue-700 dark:text-blue-300",
  referred: "text-violet-700 dark:text-violet-300",
  resolved: "text-green-700 dark:text-green-300",
  closed: "text-muted-foreground",
};

export function PipelineView({ incidents }: PipelineViewProps) {
  const counts: Record<IncidentStatus, number> = {
    open: 0,
    in_progress: 0,
    referred: 0,
    resolved: 0,
    closed: 0,
  };
  for (const i of incidents) counts[i.status]++;

  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex items-center gap-2 overflow-x-auto">
          {STAGES.map((stage, idx) => (
            <div key={stage} className="flex items-center gap-2 shrink-0">
              <div className="flex flex-col items-center px-3 py-2 rounded-md border bg-card min-w-[100px]">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  {INCIDENT_STATUS_LABELS[stage]}
                </span>
                <span
                  className={cn(
                    "text-2xl font-bold tabular-nums",
                    STAGE_ACCENT[stage],
                  )}
                >
                  {counts[stage]}
                </span>
              </div>
              {idx < STAGES.length - 1 ? (
                <ChevronRight className="size-4 text-muted-foreground shrink-0" />
              ) : null}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
