"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SEVERITIES, SEVERITY_LABELS, type IncidentSeverity } from "@/lib/labels";

const SEVERITY_RING: Record<IncidentSeverity, string> = {
  low: "bg-gray-100 text-gray-800 ring-gray-300 dark:bg-gray-800 dark:text-gray-200 dark:ring-gray-600",
  medium:
    "bg-yellow-100 text-yellow-800 ring-yellow-300 dark:bg-yellow-950 dark:text-yellow-200 dark:ring-yellow-700",
  high: "bg-orange-100 text-orange-800 ring-orange-300 dark:bg-orange-950 dark:text-orange-200 dark:ring-orange-700",
  critical:
    "bg-red-100 text-red-800 ring-red-300 dark:bg-red-950 dark:text-red-200 dark:ring-red-700",
};

interface SeverityPickerProps {
  value: IncidentSeverity | undefined;
  onChange: (next: IncidentSeverity) => void;
  disabled?: boolean;
}

export function SeverityPicker({ value, onChange, disabled }: SeverityPickerProps) {
  return (
    <div
      role="radiogroup"
      aria-label="Severity"
      className="grid grid-cols-4 gap-2"
    >
      {SEVERITIES.map((sev) => {
        const selected = value === sev;
        return (
          <Button
            key={sev}
            type="button"
            variant="outline"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(sev)}
            className={cn(
              "h-12 capitalize ring-2 ring-transparent transition-all",
              selected ? SEVERITY_RING[sev] : "text-muted-foreground",
            )}
          >
            {SEVERITY_LABELS[sev]}
          </Button>
        );
      })}
    </div>
  );
}
