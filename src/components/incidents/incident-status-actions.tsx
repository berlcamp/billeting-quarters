"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { updateIncidentStatus } from "@/lib/actions/incidents";
import type { Database } from "@/types/database";

type IncidentStatus = Database["palaro"]["Enums"]["incident_status"];

interface IncidentStatusActionsProps {
  incidentId: string;
  currentStatus: IncidentStatus;
  canUpdate: boolean;
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

export function IncidentStatusActions({
  incidentId,
  currentStatus,
  canUpdate,
}: IncidentStatusActionsProps) {
  const [busy, setBusy] = useState<IncidentStatus | null>(null);
  const [notes, setNotes] = useState("");
  const router = useRouter();

  if (!canUpdate) return null;
  const options = NEXT_OPTIONS[currentStatus];
  if (options.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        This incident is closed. No further updates allowed.
      </p>
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
    </div>
  );
}
