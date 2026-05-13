"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  forceIncidentStatus,
  updateIncidentStatus,
} from "@/lib/actions/incidents";
import { INCIDENT_STATUS_LABELS } from "@/lib/labels";
import type { Database } from "@/types/database";

type IncidentStatus = Database["palaro"]["Enums"]["incident_status"];

interface IncidentStatusActionsProps {
  incidentId: string;
  currentStatus: IncidentStatus;
  canUpdate: boolean;
  // Super-admin override — adds an inline status selector that bypasses
  // the transition map and the closed-state lockout.
  canForceStatus?: boolean;
}

const NEXT_OPTIONS: Record<IncidentStatus, IncidentStatus[]> = {
  open: ["in_progress", "resolved"],
  in_progress: ["resolved", "open"],
  referred: ["resolved"],
  resolved: ["closed", "in_progress"],
  closed: [],
};

const LABEL: Record<IncidentStatus, string> = {
  open: "Reopen",
  in_progress: "Mark in progress",
  referred: "Mark referred",
  resolved: "Mark resolved",
  closed: "Close",
};

const FORCE_STATUS_OPTIONS: readonly IncidentStatus[] = [
  "open",
  "in_progress",
  "referred",
  "resolved",
  "closed",
] as const;

function ForceStatusOverride({
  incidentId,
  currentStatus,
}: {
  incidentId: string;
  currentStatus: IncidentStatus;
}) {
  const [forcing, setForcing] = useState(false);
  const router = useRouter();

  async function force(next: IncidentStatus) {
    if (next === currentStatus) return;
    setForcing(true);
    const result = await forceIncidentStatus({ id: incidentId, status: next });
    setForcing(false);
    if (result.error) {
      toast.error("Status change failed", { description: result.error });
      return;
    }
    toast.success(`Status set to ${INCIDENT_STATUS_LABELS[next]}`);
    router.refresh();
  }

  return (
    <div className="space-y-1.5 rounded-md border border-dashed border-amber-300/70 bg-amber-50/50 p-3">
      <div className="text-sm font-medium text-amber-900">
        Super admin: change status
      </div>
      <p className="text-xs text-amber-800/80">
        Force any status, including reopening a closed incident. Audit-logged.
      </p>
      <Select
        value={currentStatus}
        onValueChange={(v) => force(v as IncidentStatus)}
        disabled={forcing}
      >
        <SelectTrigger className="w-56 bg-background">
          <SelectValue>
            {(v: string | null) =>
              INCIDENT_STATUS_LABELS[(v ?? currentStatus) as IncidentStatus]
            }
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {FORCE_STATUS_OPTIONS.map((s) => (
            <SelectItem key={s} value={s}>
              {INCIDENT_STATUS_LABELS[s]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function IncidentStatusActions({
  incidentId,
  currentStatus,
  canUpdate,
  canForceStatus = false,
}: IncidentStatusActionsProps) {
  const [busy, setBusy] = useState<IncidentStatus | null>(null);
  const [notes, setNotes] = useState("");
  const router = useRouter();

  if (!canUpdate && !canForceStatus) return null;
  const options = canUpdate ? NEXT_OPTIONS[currentStatus] : [];
  const forceOverride = canForceStatus ? (
    <ForceStatusOverride
      incidentId={incidentId}
      currentStatus={currentStatus}
    />
  ) : null;

  if (options.length === 0) {
    return (
      <div className="space-y-3">
        {canUpdate ? (
          <p className="text-sm text-muted-foreground">
            This incident is closed. No further updates allowed.
          </p>
        ) : null}
        {forceOverride}
      </div>
    );
  }

  async function update(next: IncidentStatus) {
    setBusy(next);
    const requiresNotes = next === "resolved" || next === "closed";
    if (requiresNotes && !notes.trim()) {
      toast.error("Resolution notes are required to resolve or close.");
      setBusy(null);
      return;
    }
    const result = await updateIncidentStatus({
      id: incidentId,
      status: next,
      resolution_notes: requiresNotes ? notes.trim() : undefined,
    });
    setBusy(null);
    if (result.error) {
      toast.error("Update failed", { description: result.error });
      return;
    }
    toast.success(`Status updated to ${LABEL[next].toLowerCase()}`);
    setNotes("");
    router.refresh();
  }

  const showNotesField = options.includes("resolved") || options.includes("closed");

  return (
    <div className="space-y-3">
      {showNotesField ? (
        <div className="space-y-1.5">
          <label htmlFor="resolution-notes" className="text-sm font-medium">
            Resolution notes
          </label>
          <Textarea
            id="resolution-notes"
            rows={3}
            placeholder="What happened, how it was resolved, follow-up needed…"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Required when resolving or closing.
          </p>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {options.map((next) => {
          const isResolution = next === "resolved" || next === "closed";
          return (
            <Button
              key={next}
              variant={isResolution ? "default" : "outline"}
              disabled={busy !== null}
              onClick={() => update(next)}
            >
              {busy === next ? "Working…" : LABEL[next]}
            </Button>
          );
        })}
      </div>
      {forceOverride}
    </div>
  );
}
