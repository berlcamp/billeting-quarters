import type { ReactNode } from "react";
import { Circle } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export interface TimelineEntry {
  id: string;
  at: string | Date;
  title: ReactNode;
  description?: ReactNode;
  /** Optional accent class for the dot — defaults to muted. */
  dotClassName?: string;
}

interface TimelineLogProps {
  entries: TimelineEntry[];
  empty?: ReactNode;
}

export function TimelineLog({ entries, empty }: TimelineLogProps) {
  if (entries.length === 0) {
    return (
      <div className="text-xs text-muted-foreground">
        {empty ?? "No activity yet."}
      </div>
    );
  }
  return (
    <ol className="space-y-3">
      {entries.map((entry, idx) => {
        const isLast = idx === entries.length - 1;
        return (
          <li key={entry.id} className="relative flex gap-3">
            {!isLast ? (
              <span
                aria-hidden
                className="absolute left-2 top-3 h-full w-px bg-border"
              />
            ) : null}
            <Circle
              className={cn(
                "relative z-10 size-4 shrink-0 fill-current text-muted-foreground bg-background",
                entry.dotClassName,
              )}
            />
            <div className="flex-1 pb-1 -mt-0.5">
              <div className="text-sm">{entry.title}</div>
              {entry.description ? (
                <div className="text-xs text-muted-foreground mt-0.5">
                  {entry.description}
                </div>
              ) : null}
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1 font-mono">
                {format(new Date(entry.at), "MMM d, yyyy · HH:mm")}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
