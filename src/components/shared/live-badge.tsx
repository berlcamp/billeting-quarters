import { cn } from "@/lib/utils";

interface LiveBadgeProps {
  label?: string;
  className?: string;
}

export function LiveBadge({ label = "Live", className }: LiveBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground",
        className,
      )}
    >
      <span className="relative flex size-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
        <span className="relative inline-flex size-2 rounded-full bg-green-500" />
      </span>
      {label}
    </span>
  );
}
